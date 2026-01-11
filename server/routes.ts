import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { z } from "zod";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { AuthService } from "./auth";
import { setupGoogleAuth } from "./googleAuth";
import { loginSchema, insertUserSchema, type SafeUser, requestLoginCodeSchema, verifyLoginCodeSchema } from "@shared/schema";
import { sendEmailVerificationEmail, sendLoginCodeEmail, sendJobConfirmationEmail, sendPasswordResetEmail, sendTeamInviteEmail, sendJobAssignmentEmail, sendJobCompletionNotificationEmail, sendWelcomeEmail } from "./emailService";
import { FreemiumService } from "./freemiumService";
import { DEMO_USER } from "./demoData";
import { ownerOnly, ownerOrManagerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext, hasPermission, canAssignJobTo, getWorkerPermissionContext } from "./permissions";
import {
  insertBusinessSettingsSchema,
  insertIntegrationSettingsSchema,
  insertNotificationSchema,
  insertClientSchema,
  insertJobSchema,
  insertQuoteSchema,
  updateQuoteSchema,
  insertQuoteLineItemSchema,
  insertInvoiceSchema,
  updateInvoiceSchema,
  insertInvoiceLineItemSchema,
  insertDocumentTemplateSchema,
  insertLineItemCatalogSchema,
  insertRateCardSchema,
  // Advanced features schemas
  insertTimeEntrySchema,
  insertTimesheetSchema,
  insertExpenseCategorySchema,
  insertExpenseSchema,
  insertInventoryCategorySchema,
  insertInventoryItemSchema,
  insertInventoryTransactionSchema,
  insertUserRoleSchema,
  insertTeamMemberSchema,
  insertStaffScheduleSchema,
  insertLocationTrackingSchema,
  insertRouteSchema,
  // Checklist schemas
  insertChecklistItemSchema,
  updateChecklistItemSchema,
  // Chat schemas
  insertJobChatSchema,
  insertTeamChatSchema,
  // SMS Template schema
  insertSmsTemplateSchema,
  // Business Templates schema
  insertBusinessTemplateSchema,
  // Team Presence & Activity Feed schemas
  insertTeamPresenceSchema,
  insertActivityFeedSchema,
  updateBusinessTemplateSchema,
  BUSINESS_TEMPLATE_FAMILIES,
  isValidPurposeForFamily,
  getValidPurposesForFamily,
  type BusinessTemplateFamily,
  type BusinessTemplatePurpose,
  // Recurring contracts schema
  insertRecurringContractSchema,
  // Leads schema
  insertLeadSchema,
  // Types
  type InsertTimeEntry,
  // Location tracking tables
  locationTracking,
  tradieStatus,
  // Digital signatures
  digitalSignatures,
  // Tables for admin dashboard
  users,
  jobs,
  invoices,
  quotes,
  clients,
  businessSettings,
  businessTemplates,
  // Advanced team management tables
  teamMembers,
  teamMemberSkills,
  teamMemberAvailability,
  teamMemberTimeOff,
  teamMemberMetrics,
} from "@shared/schema";
import { db } from "./storage";
import { eq, sql, desc, and } from "drizzle-orm";
import { 
  ObjectStorageService, 
  ObjectNotFoundError,
  objectStorageClient,
} from "./objectStorage";
import { parseObjectPath } from "./objectStorage";
import { 
  tradieQuoteTemplates, 
  tradieLineItems, 
  tradieRateCards 
} from "./tradieTemplates";
import { getSafetyFormTemplates, getSafetyFormTemplate } from "./safetyTemplates";
import { generateAISuggestions, chatWithAI, type BusinessContext } from "./ai";
import { notifyQuoteSent, notifyInvoiceSent, notifyInvoicePaid, notifyJobScheduled, notifyJobStarted, notifyJobCompleted } from "./notifications";
import { notifyJobAssigned, notifyJobUpdate, notifyPaymentReceived, notifyQuoteAccepted, notifyQuoteRejected, notifyTeamMessage, notifyInvoiceOverdue } from "./pushNotifications";
import { getEmailIntegration, getGmailConnectionStatus } from "./emailIntegrationService";
import { getUncachableStripeClient, getStripePublishableKey, isStripeInitialized } from "./stripeClient";
import { checkTwilioAvailability, sendSMS } from "./twilioClient";
import { geocodeAddress, haversineDistance } from "./geocoding";
import { processStatusChangeAutomation, processPaymentReceivedAutomation, processTimeBasedAutomations } from "./automationService";
import * as xeroService from "./xeroService";
import * as myobService from "./myobService";
import { getProductionBaseUrl, getQuotePublicUrl, getInvoicePublicUrl, getReceiptPublicUrl } from './urlHelper';

// Environment check for development-only endpoints
const isDevelopment = process.env.NODE_ENV !== 'production';

// Rate limiting configurations for security-sensitive endpoints
// Strict limiter for auth endpoints (prevent brute force attacks)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Less strict limiter for password reset (prevent email spam)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for payment endpoints (prevent abuse)
const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many payment requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to log activity events for dashboard feed
type ActivityType = 'job_created' | 'job_status_changed' | 'job_completed' | 'job_scheduled' | 'job_started' |
  'quote_created' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' |
  'invoice_created' | 'invoice_sent' | 'invoice_paid' | 'payment_received';

async function logActivity(
  userId: string,
  type: ActivityType,
  title: string,
  description: string | null,
  entityType: 'job' | 'quote' | 'invoice' | null,
  entityId: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await storage.createActivityLog({
      userId,
      type,
      title,
      description,
      entityType,
      entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Utility function for formatting relative time
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return past.toLocaleDateString();
  }
}

// Helper function to resolve job.assignedTo to a valid user ID
// The assignedTo field can contain either a user ID or a team member record ID
async function resolveAssigneeUserId(assignedTo: string | null | undefined, businessOwnerId: string): Promise<string | null> {
  if (!assignedTo) return null;
  
  try {
    // First try to look up as a direct user ID
    const directUser = await storage.getUser(assignedTo);
    if (directUser) {
      return directUser.id;
    }
    
    // If not found, try to find a team member with this ID and get their user ID
    const teamMembers = await storage.getTeamMembers(businessOwnerId);
    const member = teamMembers.find((m: any) => m.id === assignedTo || m.memberId === assignedTo);
    if (member?.memberId) {
      return member.memberId; // memberId references users.id
    }
    
    console.log(`[resolveAssigneeUserId] Could not resolve assignedTo: ${assignedTo}`);
    return null;
  } catch (error) {
    console.error('[resolveAssigneeUserId] Error resolving assignee:', error);
    return null;
  }
}

// Helper function to gather rich business context for AI
async function gatherAIContext(userId: string, storage: any): Promise<BusinessContext> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all data in parallel
  const [
    businessSettings,
    user,
    allJobs,
    allInvoices,
    allQuotes,
    allClients,
    emailIntegration,
    gmailStatus
  ] = await Promise.all([
    storage.getBusinessSettings(userId),
    storage.getUser(userId),
    storage.getJobs(userId),
    storage.getInvoices(userId),
    storage.getQuotes(userId),
    storage.getClients(userId),
    getEmailIntegration(userId),
    getGmailConnectionStatus()
  ]);

  // Process jobs - open jobs count
  const openJobs = allJobs.filter((j: any) => j.status !== 'done' && j.status !== 'cancelled').length;
  
  // Completed jobs this month
  const completedJobsThisMonth = allJobs.filter((j: any) => {
    if (j.status !== 'done') return false;
    const completedDate = j.completedAt ? new Date(j.completedAt) : null;
    return completedDate && completedDate >= startOfMonth;
  }).length;

  // Today's jobs with full details
  const todaysJobs = allJobs
    .filter((j: any) => {
      if (!j.scheduledAt) return false;
      const jobDate = new Date(j.scheduledAt);
      return jobDate >= today && jobDate < tomorrow;
    })
    .map((j: any) => {
      const client = allClients.find((c: any) => c.id === j.clientId);
      return {
        id: j.id,
        title: j.title || 'Untitled Job',
        clientName: client?.name || 'Unknown Client',
        clientId: j.clientId,
        address: j.address || j.location,
        time: j.scheduledAt ? new Date(j.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : undefined,
        status: j.status
      };
    });

  // Upcoming jobs (next 7 days)
  const upcomingJobs = allJobs
    .filter((j: any) => {
      if (!j.scheduledAt) return false;
      const jobDate = new Date(j.scheduledAt);
      return jobDate >= tomorrow && jobDate < weekFromNow && j.status !== 'done' && j.status !== 'cancelled';
    })
    .map((j: any) => {
      const client = allClients.find((c: any) => c.id === j.clientId);
      return {
        id: j.id,
        title: j.title || 'Untitled Job',
        clientName: client?.name || 'Unknown Client',
        clientId: j.clientId,
        scheduledDate: new Date(j.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        status: j.status
      };
    })
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  // Process invoices - overdue list with full details
  const overdueInvoicesList = allInvoices
    .filter((i: any) => {
      if (i.status === 'paid') return false;
      if (!i.dueDate) return false;
      return new Date(i.dueDate) < now;
    })
    .map((i: any) => {
      const client = allClients.find((c: any) => c.id === i.clientId);
      const daysPastDue = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: i.id,
        clientName: client?.name || 'Unknown Client',
        clientId: i.clientId,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        amount: parseFloat(i.total || '0'),
        daysPastDue,
        invoiceNumber: i.number
      };
    })
    .sort((a: any, b: any) => b.daysPastDue - a.daysPastDue);

  const unpaidInvoicesTotal = overdueInvoicesList.reduce((sum: number, i: any) => sum + i.amount, 0);

  // Paid this month
  const paidThisMonth = allInvoices
    .filter((i: any) => {
      if (i.status !== 'paid') return false;
      const paidDate = i.paidAt ? new Date(i.paidAt) : null;
      return paidDate && paidDate >= startOfMonth;
    })
    .reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);

  // Recent invoices
  const recentInvoices = allInvoices
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10)
    .map((i: any) => {
      const client = allClients.find((c: any) => c.id === i.clientId);
      return {
        id: i.id,
        clientName: client?.name || 'Unknown Client',
        amount: parseFloat(i.total || '0'),
        status: i.status,
        invoiceNumber: i.number
      };
    });

  // Process quotes - pending with full details
  const pendingQuotes = allQuotes
    .filter((q: any) => q.status === 'sent' || q.status === 'pending')
    .map((q: any) => {
      const client = allClients.find((c: any) => c.id === q.clientId);
      const createdDaysAgo = Math.floor((now.getTime() - new Date(q.createdAt || q.issuedDate || now).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: q.id,
        clientName: client?.name || 'Unknown Client',
        clientId: q.clientId,
        clientEmail: client?.email,
        total: parseFloat(q.total || '0'),
        createdDaysAgo,
        quoteNumber: q.number
      };
    });

  // Recent quotes
  const recentQuotes = allQuotes
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10)
    .map((q: any) => {
      const client = allClients.find((c: any) => c.id === q.clientId);
      return {
        id: q.id,
        clientName: client?.name || 'Unknown Client',
        amount: q.totalAmount || 0,
        status: q.status,
        quoteNumber: q.quoteNumber
      };
    });

  // Recent clients with full details
  const recentClients = allClients
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 15)
    .map((c: any) => ({
      id: c.id,
      name: c.name || 'Unknown',
      email: c.email,
      phone: c.phone
    }));

  // Recent activity
  const recentActivity = allJobs
    .slice(0, 3)
    .map((j: any) => j.title)
    .filter(Boolean) as string[];

  // Check if SMS is set up (Twilio via connector or environment variables)
  // Only consider SMS set up if credentials are verified (not placeholders)
  const twilioStatus = await checkTwilioAvailability();
  const hasSmsSetup = twilioStatus.verified === true;

  return {
    businessName: businessSettings?.businessName || 'Your Business',
    trade: businessSettings?.tradeType || 'Trade Business',
    tradieFirstName: user?.firstName || user?.name?.split(' ')[0] || 'mate',
    tradieEmail: user?.email || '',
    openJobs,
    completedJobsThisMonth,
    overdueInvoices: overdueInvoicesList.length,
    unpaidInvoicesTotal,
    paidThisMonth,
    recentActivity,
    todaysJobs,
    upcomingJobs,
    overdueInvoicesList,
    recentClients,
    pendingQuotes,
    recentInvoices,
    recentQuotes,
    // Email is available if: user has SMTP connected, OR Gmail connector is active, OR SendGrid fallback
    hasEmailSetup: !!(
      (emailIntegration && emailIntegration.status === 'connected') || 
      gmailStatus.connected || 
      process.env.SENDGRID_API_KEY
    ),
    emailAddress: emailIntegration?.emailAddress || (gmailStatus.connected ? gmailStatus.email : undefined),
    emailProvider: emailIntegration?.status === 'connected' ? 'smtp' : (gmailStatus.connected ? 'gmail' : (process.env.SENDGRID_API_KEY ? 'platform' : undefined)),
    hasSmsSetup
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Google OAuth
  setupGoogleAuth(app);

  // ============================================
  // PUBLIC ROUTES (no authentication required)
  // ============================================

  // Public health check endpoint for deployment monitoring and Apple review
  app.get("/api/health", (req: any, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "tradietrack-api"
    });
  });

  // Public bug report endpoint - allows tradies to report issues even when having problems
  app.post("/api/bug-reports", async (req: any, res) => {
    try {
      const { 
        category, 
        severity, 
        description, 
        reproductionSteps, 
        errorMessage,
        stackTrace,
        deviceInfo,
        appVersion,
        userEmail,
        userName,
        userId,
        screenName,
        networkStatus
      } = req.body;

      if (!description) {
        return res.status(400).json({ error: 'Description is required' });
      }

      // Format the bug report email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Bug Report - TradieTrack</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc2626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Bug Report - TradieTrack</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
              Severity: <strong>${severity || 'Not specified'}</strong> | Category: <strong>${category || 'General'}</strong>
            </p>
          </div>

          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">User Information</h2>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${userName || 'Anonymous'}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
            <p style="margin: 4px 0;"><strong>User ID:</strong> ${userId || 'Not logged in'}</p>
            <p style="margin: 4px 0;"><strong>Screen:</strong> ${screenName || 'Unknown'}</p>
          </div>

          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #fee2e2;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #991b1b;">Problem Description</h2>
            <p style="margin: 0; white-space: pre-wrap;">${description}</p>
          </div>

          ${reproductionSteps ? `
          <div style="background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">Steps to Reproduce</h2>
            <p style="margin: 0; white-space: pre-wrap;">${reproductionSteps}</p>
          </div>
          ` : ''}

          ${errorMessage ? `
          <div style="background: #1f2937; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px 0; font-size: 14px; color: #f87171;">Error Message</h2>
            <pre style="margin: 0; color: #fca5a5; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">${errorMessage}</pre>
          </div>
          ` : ''}

          ${stackTrace ? `
          <div style="background: #1f2937; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Stack Trace</h2>
            <pre style="margin: 0; color: #d1d5db; font-size: 11px; white-space: pre-wrap; overflow-x: auto; max-height: 300px;">${stackTrace}</pre>
          </div>
          ` : ''}

          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">Device & Environment</h2>
            <p style="margin: 4px 0;"><strong>App Version:</strong> ${appVersion || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>Network:</strong> ${networkStatus || 'Unknown'}</p>
            ${deviceInfo ? `
            <p style="margin: 4px 0;"><strong>Platform:</strong> ${deviceInfo.platform || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>Device:</strong> ${deviceInfo.deviceName || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>OS Version:</strong> ${deviceInfo.osVersion || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>App Build:</strong> ${deviceInfo.buildNumber || 'Unknown'}</p>
            ` : ''}
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Submitted: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST</p>
            <p style="margin: 4px 0 0 0;">TradieTrack Bug Reporting System</p>
          </div>
        </body>
        </html>
      `;

      // Send email using SendGrid
      const sgMail = await import('@sendgrid/mail');
      if (process.env.SENDGRID_API_KEY) {
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
        await sgMail.default.send({
          to: 'admin@avwebinnovation.com',
          from: {
            email: 'mail@avwebinnovation.com',
            name: 'TradieTrack Bug Reports'
          },
          replyTo: userEmail || 'admin@avwebinnovation.com',
          subject: `[Bug Report] ${category || 'General'} - ${severity || 'Normal'}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
          html: emailHtml,
        });
        console.log(`✅ Bug report sent to admin@avwebinnovation.com from ${userEmail || 'anonymous'}`);
      } else {
        console.log('⚠️ Bug report received but SendGrid not configured - logging to console');
        console.log('Bug Report:', { category, severity, description, userEmail, userName });
      }

      res.json({ 
        success: true, 
        message: 'Bug report submitted successfully. Thank you for helping us improve TradieTrack!' 
      });
    } catch (error: any) {
      console.error('Failed to submit bug report:', error);
      res.status(500).json({ 
        error: 'Failed to submit bug report. Please try again or email admin@avwebinnovation.com directly.' 
      });
    }
  });

  // Short URL redirect for quotes: /q/:token -> /public/quote/:token
  app.get("/q/:token", (req: any, res) => {
    res.redirect(301, `/public/quote/${req.params.token}`);
  });

  // Public quote acceptance page - client views and accepts/declines quote
  app.get("/public/quote/:token", async (req: any, res) => {
    try {
      const { generateQuoteAcceptancePage, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      // Check if this is a success redirect after accepting
      const showSuccess = req.query.success === '1';
      
      const quoteWithItems = await storage.getQuoteWithLineItemsByToken(req.params.token);
      if (!quoteWithItems) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Quote Not Found</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 60px;">
            <h1>Quote Not Found</h1>
            <p>This quote link is invalid or has expired.</p>
          </body></html>
        `);
      }
      
      const client = await storage.getClientById(quoteWithItems.clientId);
      const businessRaw = await storage.getBusinessSettings(quoteWithItems.userId);
      
      if (!client || !businessRaw) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Error</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 60px;">
            <h1>Error Loading Quote</h1>
            <p>Could not load quote details. Please contact the business.</p>
          </body></html>
        `);
      }
      
      // Resolve logo URL to base64 for HTML rendering
      const business = await resolveBusinessLogoForPdf(businessRaw);
      
      // Fetch signature if quote is accepted
      let signature = null;
      if (quoteWithItems.status === 'accepted') {
        signature = await storage.getDigitalSignatureByQuoteId(quoteWithItems.id);
      }
      
      // Fetch client's previous signature for pre-fill (if quote not yet actioned)
      let previousSignature = null;
      if (quoteWithItems.status !== 'accepted' && quoteWithItems.status !== 'declined') {
        previousSignature = await storage.getClientMostRecentSignature(quoteWithItems.clientId);
      }
      
      // Check if business can accept payments (has Stripe Connect)
      const canAcceptPayments = !!(business.stripeConnectAccountId && business.connectChargesEnabled);
      
      const acceptanceUrl = `/public/quote/${req.params.token}/action`;
      const html = generateQuoteAcceptancePage({
        quote: quoteWithItems,
        lineItems: quoteWithItems.lineItems || [],
        client,
        business,
        signature: signature || undefined,
        previousSignature: previousSignature || undefined,
        token: req.params.token,
        canAcceptPayments,
        showSuccess
      }, acceptanceUrl);
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error("Error loading quote acceptance page:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html><head><title>Error</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 60px;">
          <h1>Something Went Wrong</h1>
          <p>Please try again later or contact the business directly.</p>
        </body></html>
      `);
    }
  });

  // Handle quote accept/decline action
  app.post("/public/quote/:token/action", async (req: any, res) => {
    try {
      const { action, accepted_by, notes, decline_reason, signature_data } = req.body;
      const token = req.params.token;
      
      // Get client IP and user agent for audit trail
      const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Verify quote exists and is actionable
      const quote = await storage.getQuoteByToken(token);
      if (!quote) {
        return res.status(404).send('Quote not found');
      }
      
      if (quote.status === 'accepted' || quote.status === 'declined') {
        return res.redirect(`/public/quote/${token}`);
      }
      
      // Check if expired
      if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
        return res.redirect(`/public/quote/${token}`);
      }
      
      if (action === 'accept') {
        if (!accepted_by || !accepted_by.trim()) {
          return res.status(400).send('Name is required to accept the quote');
        }
        
        // Validate signature is provided
        if (!signature_data || !signature_data.startsWith('data:image/')) {
          return res.status(400).send('Signature is required to accept the quote');
        }
        
        const updatedQuote = await storage.acceptQuoteByToken(token, accepted_by.trim(), clientIp);
        
        if (updatedQuote) {
          // Save the digital signature with documentType 'quote_acceptance' to match PDF query
          try {
            await storage.createDigitalSignature({
              quoteId: quote.id,
              clientId: quote.clientId,
              signerName: accepted_by.trim(),
              signatureData: signature_data,
              signedAt: new Date(),
              ipAddress: clientIp,
              userAgent: userAgent,
              documentType: 'quote_acceptance',
              isValid: true,
            });
            
            // Also save signature to client's profile for future use
            if (quote.clientId) {
              try {
                await db.update(clients)
                  .set({ 
                    savedSignatureData: signature_data,
                    savedSignatureDate: new Date(),
                    updatedAt: new Date()
                  })
                  .where(eq(clients.id, quote.clientId));
                console.log(`[Quote Acceptance] Saved signature to client ${quote.clientId} profile`);
              } catch (clientError) {
                console.error('Could not save signature to client profile:', clientError);
              }
            }
          } catch (e) {
            console.error('Failed to save signature:', e);
          }
          
          // Create notification for business owner
          try {
            await storage.createNotification({
              userId: quote.userId,
              type: 'quote_accepted',
              title: 'Quote Accepted',
              message: `Quote ${quote.number} was accepted by ${accepted_by}`,
              relatedId: quote.id,
              relatedType: 'quote'
            });
            
            // Send push notification
            await notifyQuoteAccepted(quote.userId, quote.number, quote.id, accepted_by.trim());

            // Update linked job status to scheduled if quote is accepted
            if (quote.jobId) {
              try {
                const job = await storage.getJob(quote.jobId, quote.userId);
                if (job && (job.status === 'pending' || job.status === 'draft')) {
                  await storage.updateJob(quote.jobId, quote.userId, { 
                    status: 'scheduled',
                    scheduledAt: job.scheduledAt || new Date() // Set scheduledAt if not already set
                  });
                  console.log(`[Quote Acceptance] Job ${quote.jobId} status updated to scheduled`);
                  
                  await logActivity(
                    quote.userId,
                    'job_status_change' as any,
                    'Job Scheduled',
                    `Job moved to scheduled after quote ${quote.number} was accepted`,
                    'job',
                    quote.jobId,
                    { previousStatus: job.status, newStatus: 'scheduled', triggeredBy: 'quote_acceptance' }
                  );
                }
              } catch (e) {
                console.error('Failed to update linked job status:', e);
              }
            }
          } catch (e) {
            console.error('Failed to create notification:', e);
          }
        }
      } else if (action === 'decline') {
        const updatedQuote = await storage.declineQuoteByToken(token, decline_reason || undefined);
        
        if (updatedQuote) {
          // Get client name for notification
          const client = await storage.getClientById(quote.clientId);
          const clientName = client?.name || 'Client';
          
          // Create notification for business owner
          try {
            await storage.createNotification({
              userId: quote.userId,
              type: 'quote_declined',
              title: 'Quote Declined',
              message: `Quote ${quote.number} was declined${decline_reason ? `: ${decline_reason}` : ''}`,
              relatedId: quote.id,
              relatedType: 'quote'
            });
            
            // Send push notification
            await notifyQuoteRejected(quote.userId, quote.number, quote.id, clientName);
          } catch (e) {
            console.error('Failed to create notification:', e);
          }
        }
      }
      
      // Redirect back to view the updated quote (with success flag for accept action)
      const successParam = action === 'accept' ? '?success=1' : '';
      res.redirect(`/public/quote/${token}${successParam}`);
    } catch (error) {
      console.error("Error processing quote action:", error);
      res.status(500).send('Failed to process your request. Please try again.');
    }
  });

  // Public endpoint: Download quote PDF (no auth required - using acceptance token)
  app.get("/api/public/quote/:token/pdf", async (req, res) => {
    try {
      const { token } = req.params;
      const { generateQuotePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const quoteWithItems = await storage.getQuoteWithLineItemsByToken(token);
      if (!quoteWithItems) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      const client = await storage.getClientById(quoteWithItems.clientId);
      const businessRaw = await storage.getBusinessSettingsByUserId(quoteWithItems.userId);
      
      if (!client || !businessRaw) {
        return res.status(404).json({ error: 'Quote details not found' });
      }
      
      // Resolve logo URL to base64 for PDF generation
      const business = await resolveBusinessLogoForPdf(businessRaw);
      
      // Get linked job for site address if available (matching authenticated route)
      // Use getJobByIdWithContext to get full job data like the authenticated route
      let job;
      if (quoteWithItems.jobId) {
        job = await storage.getJob(quoteWithItems.jobId, quoteWithItems.userId);
      }
      
      // Get job signatures if quote is linked to a job (matching authenticated route)
      // Always initialize as empty array to match authenticated route behavior
      let jobSignatures: any[] = [];
      if (quoteWithItems.jobId) {
        const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, quoteWithItems.jobId));
        jobSignatures = signatures.map(sig => ({
          id: sig.id,
          jobId: sig.jobId,
          signerName: sig.signerName,
          signatureData: sig.signatureData,
          signedAt: sig.signedAt,
        }));
      }
      
      // Get quote acceptance signature if quote was accepted (matching authenticated route)
      let acceptanceSignature;
      if (quoteWithItems.status === 'accepted') {
        const signatures = await db.select().from(digitalSignatures).where(
          sql`${digitalSignatures.documentType} = 'quote_acceptance' AND ${digitalSignatures.quoteId} = ${quoteWithItems.id}`
        );
        if (signatures.length > 0) {
          acceptanceSignature = {
            id: signatures[0].id,
            signerName: signatures[0].signerName,
            signatureData: signatures[0].signatureData,
            signedAt: signatures[0].signedAt,
          };
        }
      }
      
      // Use the full quoteWithItems object (matching authenticated route pattern)
      // Ensure financial fields have proper defaults
      const safeQuote = {
        ...quoteWithItems,
        subtotal: quoteWithItems.subtotal || '0',
        gstAmount: quoteWithItems.gstAmount || '0',
        total: quoteWithItems.total || '0',
      };
      
      const html = generateQuotePDF({
        quote: safeQuote,
        lineItems: quoteWithItems.lineItems || [],
        client,
        business,
        job,
        jobSignatures,
        signature: acceptanceSignature,
      });
      
      const pdfBuffer = await generatePDFBuffer(html);
      
      const filename = `Quote_${quoteWithItems.number || quoteWithItems.id.slice(0, 8)}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating public quote PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Create payment intent for quote deposit
  app.post("/api/public/quote/:token/pay", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      // Get quote with details
      const quote = await storage.getQuoteByToken(token);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      // Verify quote is accepted and deposit not already paid
      if (quote.status !== 'accepted') {
        return res.status(400).json({ error: 'Quote must be accepted before payment' });
      }
      
      if (quote.depositPaid) {
        return res.status(400).json({ error: 'Deposit already paid' });
      }
      
      // Check if deposit is required
      if (!quote.depositRequired) {
        return res.status(400).json({ error: 'No deposit required for this quote' });
      }
      
      // Get business settings to verify Stripe Connect is set up
      const settings = await storage.getBusinessSettingsByUserId(quote.userId);
      if (!settings?.stripeConnectAccountId || !settings.connectChargesEnabled) {
        return res.status(400).json({ error: 'Business not set up for online payments' });
      }
      
      const client = await storage.getClientById(quote.clientId);
      
      // Calculate deposit amount (stored on quote or calculate from percent)
      let depositAmount: number;
      if (quote.depositAmount) {
        depositAmount = parseFloat(quote.depositAmount as unknown as string);
      } else if (quote.depositPercent) {
        const total = parseFloat(quote.total as unknown as string);
        const percent = parseFloat(quote.depositPercent as unknown as string);
        depositAmount = total * (percent / 100);
      } else {
        // Default to 20% deposit
        const total = parseFloat(quote.total as unknown as string);
        depositAmount = total * 0.2;
      }
      
      const amountCents = Math.round(depositAmount * 100);
      
      // Platform fee: 2.5% of deposit (minimum $0.50)
      const platformFee = Math.max(Math.round(amountCents * 0.025), 50);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'aud',
        application_fee_amount: platformFee,
        transfer_data: {
          destination: settings.stripeConnectAccountId,
        },
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.number,
          tradieUserId: quote.userId,
          clientId: client?.id || '',
          clientName: client?.name || '',
          paymentType: 'quote_deposit',
          source: 'public_quote_page',
        },
        description: `Quote ${quote.number} Deposit - ${settings.businessName || 'TradieTrack'}`,
      });
      
      // Update quote with payment intent ID
      await storage.updateQuoteByToken(token, {
        depositPaymentIntentId: paymentIntent.id,
      } as any);
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: await getStripePublishableKey(),
        amount: depositAmount,
      });
    } catch (error: any) {
      console.error('Quote deposit payment error:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment' });
    }
  });

  // Generate acceptance link for a quote (returns the token)
  app.post("/api/quotes/:id/generate-link", async (req: any, res) => {
    // This needs auth but we handle it inline
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const token = await storage.generateQuoteAcceptanceToken(req.params.id, req.session.userId);
      if (!token) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      res.json({ 
        token,
        acceptanceUrl: getQuotePublicUrl(token, req)
      });
    } catch (error) {
      console.error("Error generating quote link:", error);
      res.status(500).json({ error: "Failed to generate quote link" });
    }
  });

  // ============================================
  // AUTHENTICATED ROUTES
  // ============================================

  // Registration endpoint
  app.post("/api/auth/register", authRateLimiter, async (req: any, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      // Convert nullable fields to undefined for AuthService
      const cleanUserData = {
        email: userData.email,
        username: userData.username,
        password: userData.password,
        firstName: userData.firstName || undefined,
        lastName: userData.lastName || undefined,
        tradeType: userData.tradeType || undefined,
        intendedTier: userData.intendedTier || 'free',
      };
      const result = await AuthService.register(cleanUserData);
      
      if (result.success) {
        // Seed default templates for new user (non-blocking)
        try {
          await storage.seedDefaultBusinessTemplates(result.user.id);
          await storage.ensureDefaultTemplates(result.user.id);
          await storage.seedDefaultDocumentTemplates(result.user.id);
        } catch (templateError) {
          console.error('Failed to seed default templates:', templateError);
          // Don't fail registration if template seeding fails
        }

        // Generate and send email verification token (non-blocking)
        // Welcome email will be sent after verification, not here
        try {
          const verificationToken = await AuthService.createEmailVerificationToken(result.user.id);
          await sendEmailVerificationEmail(result.user, verificationToken);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't fail registration if email fails - user can resend later
        }

        // Do NOT auto-login - user must verify email first
        // They will be redirected to /verify-email-pending page
        res.json({ 
          success: true, 
          message: 'Registration successful! Please check your email to verify your account.'
        });
        return;
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", authRateLimiter, async (req: any, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      const result = await AuthService.login(loginData);
      
      if (result.success) {
        // Check if email is verified
        if (!result.user.emailVerified) {
          return res.status(403).json({ 
            error: "Please verify your email address before logging in.",
            requiresVerification: true
          });
        }
        
        // Set session and explicitly save before responding
        req.session.userId = result.user.id;
        req.session.user = result.user;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Failed to create session" });
          }
          // Return session token for iOS/Safari fallback where cookies may not work
          res.json({ success: true, user: result.user, sessionToken: req.sessionID });
        });
      } else {
        res.status(401).json({ error: result.error });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid login data" });
    }
  });

  // Email-based passwordless authentication endpoints
  app.post("/api/auth/request-code", authRateLimiter, async (req: any, res) => {
    try {
      const { email } = requestLoginCodeSchema.parse(req.body);
      
      // Check for existing recent code (rate limiting)
      const existingCode = await storage.getLatestLoginCodeForEmail(email);
      if (existingCode && !existingCode.verified) {
        const timeSinceCreation = Math.ceil((Date.now() - existingCode.createdAt.getTime()) / 1000);
        if (timeSinceCreation < 60) { // Less than 1 minute since last code (rate limiting)
          return res.status(429).json({ 
            error: "Please wait before requesting another code",
            retryAfter: 60 - timeSinceCreation
          });
        }
      }
      
      // Generate cryptographically secure 6-digit code
      const crypto = await import('crypto');
      const code = crypto.randomInt(100000, 999999).toString();
      
      // Store code in database
      await storage.createLoginCode(email, code);
      
      // Send code via email
      try {
        await sendLoginCodeEmail(email, code);
        res.json({ success: true, message: "Login code sent to your email" });
      } catch (emailError) {
        console.error("Failed to send login code email:", emailError);
        res.status(500).json({ error: "Failed to send email. Please try again later." });
      }
    } catch (error) {
      console.error("Request code error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid email address" });
      } else {
        res.status(500).json({ error: "An error occurred. Please try again." });
      }
    }
  });

  app.post("/api/auth/verify-code", authRateLimiter, async (req: any, res) => {
    try {
      const { email, code } = verifyLoginCodeSchema.parse(req.body);
      
      // Verify code and create/find user
      const user = await storage.verifyLoginCodeAndCreateUser(email, code);
      
      if (!user) {
        return res.status(401).json({ 
          error: "Invalid or expired code. Please request a new code." 
        });
      }
      
      // Seed default templates if new user (async, don't block login)
      storage.seedDefaultBusinessTemplates(user.id).catch(err => {
        console.error('Failed to seed business templates for passwordless user:', err);
      });
      storage.ensureDefaultTemplates(user.id).catch(err => {
        console.error('Failed to seed message templates for passwordless user:', err);
      });
      storage.seedDefaultDocumentTemplates(user.id).catch(err => {
        console.error('Failed to seed document templates for passwordless user:', err);
      });
      
      // Create session and explicitly save
      req.session.userId = user.id;
      req.session.user = user;
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        // Return session token for iOS/Safari fallback where cookies may not work
        res.json({ success: true, user, sessionToken: req.sessionID });
      });
    } catch (error) {
      console.error("Verify code error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data" });
      } else {
        res.status(500).json({ error: "An error occurred. Please try again." });
      }
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Auth check endpoint (supports both cookies and Authorization header for iOS/Safari)
  app.get("/api/auth/me", async (req: any, res) => {
    let userId = req.session?.userId;
    
    // Fallback: Check Authorization header for session token (for iOS/Safari where cookies may not work)
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        try {
          // Look up session from database
          const result = await db.execute(
            sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
          );
          if (result.rows && result.rows.length > 0) {
            const sessionData = result.rows[0].sess as any;
            userId = sessionData?.userId;
          }
        } catch (err) {
          console.error('Session token lookup error:', err);
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const user = await AuthService.getUserById(userId);
      if (!user) {
        if (req.session) {
          req.session.destroy(() => {});
        }
        return res.status(401).json({ error: "User not found" });
      }
      
      // Return safe user data (cast to any to avoid type mismatches)
      const safeUser: any = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        tradeType: user.tradeType,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        subscriptionTier: user.subscriptionTier,
        jobsCreatedThisMonth: user.jobsCreatedThisMonth,
        emailVerificationExpiresAt: user.emailVerificationExpiresAt,
        subscriptionResetDate: user.subscriptionResetDate,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        googleId: user.googleId,
        invoicesCreatedThisMonth: user.invoicesCreatedThisMonth,
        quotesCreatedThisMonth: user.quotesCreatedThisMonth,
        usageResetDate: user.usageResetDate,
        trialStatus: user.trialStatus,
        trialEndsAt: user.trialEndsAt,
        trialUsedAt: user.trialUsedAt,
        intendedTier: user.intendedTier,
        isPlatformAdmin: user.isPlatformAdmin ?? (user as any).is_platform_admin ?? false,
      };
      
      // Debug logging for admin users
      if (safeUser.email === 'admin@avwebinnovation.com' || safeUser.isPlatformAdmin) {
        console.log('🔑 Admin user detected:', {
          email: safeUser.email,
          isPlatformAdmin: safeUser.isPlatformAdmin,
          rawIsPlatformAdmin: user.isPlatformAdmin,
          rawIs_platform_admin: (user as any).is_platform_admin,
        });
      }
      
      // Get worker permission context
      const workerPermissionContext = await getWorkerPermissionContext(userId);
      
      // Add permission context to response
      const response = {
        ...safeUser,
        workerPermissions: workerPermissionContext.permissions,
        isOwner: workerPermissionContext.isOwner,
        isWorker: workerPermissionContext.isWorker,
        teamMemberId: workerPermissionContext.teamMemberId,
        businessOwnerId: workerPermissionContext.businessOwnerId,
      };
      
      res.json(response);
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Failed to check authentication" });
    }
  });

  // Development-only quick login endpoint
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/auth/demo-login", async (req: any, res) => {
      try {
        const result = await AuthService.login({
          email: DEMO_USER.email,
          password: DEMO_USER.password
        });
        
        if (result.success) {
          req.session.userId = result.user.id;
          req.session.user = result.user;
          req.session.save((err: any) => {
            if (err) {
              console.error("Session save error:", err);
              return res.status(500).json({ error: "Failed to create session" });
            }
            // Return session token for iOS/Safari fallback where cookies may not work
            res.json({ success: true, user: result.user, sessionToken: req.sessionID });
          });
        } else {
          res.status(401).json({ error: result.error });
        }
      } catch (error) {
        console.error("Demo login error:", error);
        res.status(500).json({ error: "Demo login failed" });
      }
    });
  }

  // Email verification routes (public - no auth required)
  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }

      const result = await AuthService.verifyEmail(token);
      
      if (result.success) {
        // Send welcome email now that email is verified (non-blocking)
        try {
          await sendWelcomeEmail(result.user);
        } catch (welcomeEmailError) {
          console.error('Failed to send welcome email:', welcomeEmailError);
          // Don't fail verification if welcome email fails
        }
        
        // Set session after successful verification and explicitly save
        req.session.userId = result.user.id;
        req.session.user = result.user;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Failed to create session" });
          }
          // Return session token for iOS/Safari fallback where cookies may not work
          // Include isNewUser flag so frontend shows onboarding
          res.json({ 
            success: true, 
            user: result.user, 
            message: 'Email verified successfully!', 
            sessionToken: req.sessionID,
            isNewUser: true 
          });
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Email verification failed" });
    }
  });

  app.post("/api/auth/resend-verification", passwordResetLimiter, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      const resendResult = await AuthService.resendVerificationEmail(email);
      
      if (resendResult.success) {
        // Get the user and generate new token
        const user = await storage.getUserByEmail(email);
        if (user) {
          const verificationToken = await AuthService.createEmailVerificationToken(user.id);
          try {
            await sendEmailVerificationEmail(user, verificationToken);
            res.json({ success: true, message: 'Verification email sent successfully!' });
          } catch (emailError) {
            console.error('Failed to resend verification email:', emailError);
            res.status(500).json({ error: 'Failed to send verification email' });
          }
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } else {
        res.status(400).json({ error: resendResult.error });
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  // Password Reset - Request reset email
  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      const result = await AuthService.createPasswordResetToken(email);
      
      if (result.success && result.token) {
        // Send password reset email
        const user = await storage.getUserByEmail(email);
        if (user) {
          try {
            await sendPasswordResetEmail(user, result.token);
          } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Don't reveal email sending failure for security
          }
        }
      }
      
      // Always return success to prevent email enumeration
      res.json({ 
        success: true, 
        message: 'If an account exists with this email, you will receive password reset instructions.' 
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Password Reset - Verify token and reset password
  app.post("/api/auth/reset-password", async (req: any, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Reset token and new password are required" });
      }

      const result = await AuthService.resetPassword(token, password);
      
      if (result.success) {
        res.json({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Mobile Google Sign-In endpoint (accepts Google ID token from mobile app)
  app.post("/api/auth/google/mobile", authRateLimiter, async (req: any, res) => {
    try {
      const { idToken, accessToken, email, firstName, lastName, googleId, profileImageUrl } = req.body;
      
      // For mobile, we trust the data from the Google OAuth response since it came through
      // Expo AuthSession which validates with Google's servers
      if (!email || !googleId) {
        return res.status(400).json({ error: "Email and Google ID are required" });
      }

      // Track if this is a new user for onboarding
      let isNewUser = false;

      // Check if user already exists by Google ID
      let user = await AuthService.findUserByGoogleId(googleId);
      
      if (!user) {
        // Check by email as fallback
        user = await AuthService.findUserByEmail(email);
      }
      
      if (!user) {
        // Create new Google user (first-time login)
        console.log(`📱 Creating new mobile Google user: ${email}`);
        user = await AuthService.createGoogleUser({
          googleId,
          email,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || '',
          profileImageUrl: profileImageUrl || null,
          emailVerified: true
        });
        isNewUser = true;
      } else {
        // Existing user found - link Google ID if not already linked
        console.log(`✅ Existing Google user found for mobile: ${email}`);
        if (!user.googleId) {
          await AuthService.linkGoogleAccount(user.id, googleId);
        }
      }

      // Set session and explicitly save before responding
      req.session.userId = user.id;
      req.session.user = user;
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        // Return session token and isNewUser flag for mobile auth
        res.json({ success: true, user, sessionToken: req.sessionID, isNewUser });
      });
    } catch (error) {
      console.error("Mobile Google auth error:", error);
      res.status(500).json({ error: "Failed to authenticate with Google" });
    }
  });

  // Apple Sign In endpoint (accepts Apple identity token from mobile app)
  app.post("/api/auth/apple", authRateLimiter, async (req: any, res) => {
    try {
      const { identityToken, fullName, email } = req.body;
      
      if (!identityToken) {
        return res.status(400).json({ error: "Identity token required" });
      }
      
      // Decode the JWT to get Apple user ID (sub claim)
      // TODO: Implement full JWKS verification by fetching Apple's public keys from
      // https://appleid.apple.com/auth/keys and verifying the JWT signature.
      // For now, we do basic claim validation to prevent simple forgery.
      const decoded = jwt.decode(identityToken) as { 
        sub: string; 
        email?: string; 
        iss?: string; 
        aud?: string;
      } | null;
      
      if (!decoded?.sub) {
        return res.status(400).json({ error: "Invalid identity token" });
      }
      
      // Basic validation: check issuer is Apple
      if (decoded.iss !== 'https://appleid.apple.com') {
        console.error('Apple auth: Invalid issuer:', decoded.iss);
        return res.status(400).json({ error: "Invalid token issuer" });
      }
      
      // Basic validation: check audience matches our app's bundle ID
      const expectedBundleId = process.env.APPLE_BUNDLE_ID || 'com.tradietrack.app';
      if (decoded.aud !== expectedBundleId) {
        console.error('Apple auth: Invalid audience:', decoded.aud, 'expected:', expectedBundleId);
        return res.status(400).json({ error: "Invalid token audience" });
      }
      
      const appleUserId = decoded.sub;
      const userEmail = email || decoded.email;
      
      // Track if this is a new user for onboarding
      let isNewUser = false;
      
      // Find user by Apple ID
      let user = await AuthService.findUserByAppleId(appleUserId);
      
      if (!user && userEmail) {
        // Check if user exists with this email
        user = await AuthService.findUserByEmail(userEmail);
        if (user) {
          // Link Apple auth to existing user
          console.log(`🍎 Linking Apple account to existing user: ${userEmail}`);
          await AuthService.linkAppleAccount(user.id, appleUserId);
        }
      }
      
      if (!user) {
        // Create new Apple user (first-time login)
        const firstName = fullName?.givenName || '';
        const lastName = fullName?.familyName || '';
        const finalEmail = userEmail || `apple_${appleUserId.substring(0, 8)}@privaterelay.appleid.com`;
        
        console.log(`🍎 Creating new Apple user: ${finalEmail}`);
        user = await AuthService.createAppleUser({
          appleId: appleUserId,
          email: finalEmail,
          firstName: firstName || finalEmail.split('@')[0],
          lastName: lastName || '',
          emailVerified: true
        });
        isNewUser = true;
      } else {
        // Existing user found
        console.log(`✅ Existing Apple user found: ${user.email}`);
        // Ensure Apple ID is linked if not already
        if (!user.appleId) {
          await AuthService.linkAppleAccount(user.id, appleUserId);
        }
      }
      
      // Set session and explicitly save before responding
      req.session.userId = user.id;
      req.session.user = user;
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        // Return session token and isNewUser flag for mobile auth
        res.json({ 
          success: true, 
          user: { ...user, password: undefined },
          sessionToken: req.sessionID, 
          isNewUser 
        });
      });
    } catch (error) {
      console.error("Apple auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Middleware for user authentication (supports both cookies and Authorization header for iOS/Safari)
  const requireAuth = async (req: any, res: any, next: any) => {
    let userId = req.session?.userId;
    
    // Fallback: Check Authorization header for session token (for iOS/Safari where cookies may not work)
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        try {
          // Look up session from database
          const result = await db.execute(
            sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
          );
          if (result.rows && result.rows.length > 0) {
            const sessionData = result.rows[0].sess as any;
            userId = sessionData?.userId;
          }
        } catch (err) {
          console.error('Session token lookup error:', err);
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get fresh user data
    const user = await AuthService.getUserById(userId);
    if (!user) {
      if (req.session) {
        req.session.destroy(() => {});
      }
      return res.status(401).json({ error: "User not found" });
    }
    
    req.userId = user.id;
    req.user = user;
    next();
  };

  // Middleware to restrict endpoints to development mode only
  const requireDevelopment = (req: any, res: any, next: any) => {
    if (!isDevelopment) {
      return res.status(403).json({ error: "This endpoint is only available in development mode" });
    }
    next();
  };

  // Freemium usage tracking endpoint
  app.get("/api/subscription/usage", requireAuth, async (req: any, res) => {
    try {
      const usageInfo = await FreemiumService.getFullUsageInfo(req.userId);
      const user = await storage.getUser(req.userId);
      res.json({
        ...usageInfo,
        subscriptionTier: user?.subscriptionTier || 'free',
      });
    } catch (error) {
      console.error("Error fetching usage info:", error);
      res.status(500).json({ error: "Failed to fetch usage information" });
    }
  });

  // Simple usage endpoint for dashboard banners
  app.get("/api/usage", requireAuth, async (req: any, res) => {
    try {
      const usageInfo = await FreemiumService.getFullUsageInfo(req.userId);
      const user = await storage.getUser(req.userId);
      res.json({
        ...usageInfo,
        subscriptionTier: user?.subscriptionTier || 'free',
      });
    } catch (error) {
      console.error("Error fetching usage info:", error);
      res.status(500).json({ error: "Failed to fetch usage information" });
    }
  });

  // ===== SUBSCRIPTION API ENDPOINTS (Cross-Platform Sync) =====

  // GET /api/subscription/status - Returns current subscription status for authenticated user
  app.get("/api/subscription/status", requireAuth, async (req: any, res) => {
    try {
      const { getSubscriptionStatus, getPaymentMethodDetails } = await import('./billingService');
      const userId = req.userId!;
      
      const status = await getSubscriptionStatus(userId);
      const paymentMethod = await getPaymentMethodDetails(userId);
      const user = await storage.getUser(userId);
      const businessSettings = await storage.getBusinessSettings(userId);
      
      // Determine upgrade/downgrade eligibility
      const canUpgrade = status.tier === 'free' || status.tier === 'trial' || status.tier === 'pro';
      const canDowngrade = status.tier === 'team' || status.tier === 'pro';
      
      res.json({
        tier: status.tier,
        status: status.status,
        trialEndsAt: user?.trialEndsAt || null,
        nextBillingDate: status.currentPeriodEnd || null,
        cancelAtPeriodEnd: status.cancelAtPeriodEnd || false,
        paymentMethod: paymentMethod.success ? {
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
        } : null,
        seats: status.tier === 'team' ? status.seatCount : undefined,
        canUpgrade,
        canDowngrade,
      });
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      res.status(500).json({ error: error.message || 'Failed to get subscription status' });
    }
  });

  // POST /api/subscription/create-checkout - Creates Stripe checkout session with trial
  app.post("/api/subscription/create-checkout", requireAuth, async (req: any, res) => {
    try {
      const { createSubscriptionCheckout, createTeamSubscriptionCheckout } = await import('./billingService');
      const userId = req.userId!;
      const { tier, seats } = req.body;
      
      // Validate tier
      if (!tier || !['pro', 'team'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be "pro" or "team"' });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: 'User email is required for checkout' });
      }
      
      // Get base URL for success/cancel redirects
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      
      let result;
      if (tier === 'team') {
        const seatCount = Math.max(0, Math.min(50, parseInt(seats) || 0));
        result = await createTeamSubscriptionCheckout(
          userId,
          user.email,
          `${baseUrl}/settings?tab=billing&success=true`,
          `${baseUrl}/settings?tab=billing&canceled=true`,
          seatCount
        );
      } else {
        result = await createSubscriptionCheckout(
          userId,
          user.email,
          `${baseUrl}/settings?tab=billing&success=true`,
          `${baseUrl}/settings?tab=billing&canceled=true`
        );
      }
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ url: result.sessionUrl });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  // POST /api/subscription/manage - Creates Stripe customer portal session
  app.post("/api/subscription/manage", requireAuth, async (req: any, res) => {
    try {
      const { createBillingPortalSession } = await import('./billingService');
      const userId = req.userId!;
      
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const returnUrl = `${protocol}://${host}/settings?tab=billing`;
      
      const result = await createBillingPortalSession(userId, returnUrl);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ url: result.url });
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ error: error.message || 'Failed to create portal session' });
    }
  });

  // GET /api/subscription/invoices - Returns list of recent invoices from Stripe
  app.get("/api/subscription/invoices", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const businessSettings = await storage.getBusinessSettings(userId);
      
      if (!businessSettings?.stripeCustomerId) {
        return res.json({ invoices: [] });
      }
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.json({ invoices: [] });
      }
      
      const stripeInvoices = await stripe.invoices.list({
        customer: businessSettings.stripeCustomerId,
        limit: 12,
      });
      
      const invoices = stripeInvoices.data.map((inv: any) => ({
        id: inv.id,
        amount: inv.amount_paid / 100, // Convert from cents
        currency: inv.currency?.toUpperCase() || 'AUD',
        status: inv.status,
        date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        pdfUrl: inv.invoice_pdf || null,
      }));
      
      res.json({ invoices });
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
    }
  });

  // POST /api/subscription/cancel - Cancels subscription at period end
  app.post("/api/subscription/cancel", requireAuth, async (req: any, res) => {
    try {
      const { cancelSubscription } = await import('./billingService');
      const userId = req.userId!;
      
      const result = await cancelSubscription(userId);
      
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }
      
      res.json({ 
        success: true, 
        message: 'Your subscription has been cancelled. You will retain access until the end of your current billing period.' 
      });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to cancel subscription' });
    }
  });

  // POST /api/subscription/reactivate - Reactivates cancelled subscription
  app.post("/api/subscription/reactivate", requireAuth, async (req: any, res) => {
    try {
      const { resumeSubscription } = await import('./billingService');
      const userId = req.userId!;
      
      const result = await resumeSubscription(userId);
      
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }
      
      res.json({ 
        success: true, 
        message: 'Your subscription has been reactivated. You will continue to be billed at the end of your billing period.' 
      });
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to reactivate subscription' });
    }
  });

  // POST /api/subscription/upgrade-to-team - Upgrades Pro subscription to Team with trial
  app.post("/api/subscription/upgrade-to-team", requireAuth, async (req: any, res) => {
    try {
      const { upgradeProToTeamTrial } = await import('./billingService');
      const userId = req.userId!;
      const { seats = 1 } = req.body;

      if (typeof seats !== 'number' || seats < 0 || seats > 50) {
        return res.status(400).json({ success: false, message: 'Invalid seat count (0-50)' });
      }

      const result = await upgradeProToTeamTrial(userId, seats);

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }

      res.json({
        success: true,
        message: 'Your subscription has been upgraded to Team with a 7-day trial. Invite team members to get started!',
        trialEndsAt: result.trialEndsAt,
        subscriptionId: result.subscriptionId,
      });
    } catch (error: any) {
      console.error('Error upgrading to team:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to upgrade subscription' });
    }
  });

  // POST /api/subscription/downgrade-to-pro - Downgrades Team subscription to Pro
  app.post("/api/subscription/downgrade-to-pro", requireAuth, async (req: any, res) => {
    try {
      const { downgradeTeamToPro } = await import('./billingService');
      const userId = req.userId!;

      const result = await downgradeTeamToPro(userId);

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }

      res.json({
        success: true,
        message: 'Your subscription has been downgraded to Pro. Team members have been suspended.',
      });
    } catch (error: any) {
      console.error('Error downgrading to pro:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to downgrade subscription' });
    }
  });

  // Route optimization endpoint - Uses Google Maps Directions API with waypoint optimization
  app.post("/api/routes/optimize", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { date, startLocation } = req.body;

      if (!date) {
        return res.status(400).json({ error: "Date is required (YYYY-MM-DD format)" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      // Fetch scheduled or in_progress jobs for this user on the given date
      const allJobs = await storage.getJobs(userContext.effectiveUserId);
      const targetDate = new Date(date).toISOString().split('T')[0];
      
      const jobsToOptimize = allJobs.filter(job => {
        if (!job.scheduledAt) return false;
        const jobDate = new Date(job.scheduledAt).toISOString().split('T')[0];
        const status = job.status.toLowerCase();
        return jobDate === targetDate && (status === 'scheduled' || status === 'in_progress');
      });

      if (jobsToOptimize.length === 0) {
        return res.json({
          optimizedOrder: [],
          totalDistance: "0 km",
          totalDuration: "0 mins",
          savedDistance: "0 km",
          message: "No jobs found to optimize for this date."
        });
      }

      // Ensure all jobs have coordinates, geocode if necessary
      const jobsWithCoords = await Promise.all(jobsToOptimize.map(async (job) => {
        let lat = job.latitude ? parseFloat(job.latitude as string) : null;
        let lng = job.longitude ? parseFloat(job.longitude as string) : null;
        
        if ((lat === null || lng === null) && job.address) {
          try {
            const coords = await geocodeAddress(job.address);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
              // Update job with coordinates for future use
              await storage.updateJob(job.id, userContext.effectiveUserId, {
                latitude: lat.toString(),
                longitude: lng.toString()
              });
            }
          } catch (e) {
            console.error(`Failed to geocode address for job ${job.id}:`, e);
          }
        }
        
        return { ...job, lat, lng };
      }));

      // Filter out jobs that still don't have coordinates
      const validJobs = jobsWithCoords.filter(j => j.lat !== null && j.lng !== null);
      
      if (validJobs.length === 0) {
        return res.status(400).json({ error: "Could not determine coordinates for any jobs." });
      }

      // Optimization Logic
      let result;
      let usedGoogleMaps = false;

      if (apiKey) {
        try {
          const origin = startLocation 
            ? `${startLocation.lat},${startLocation.lng}` 
            : `${validJobs[0].lat},${validJobs[0].lng}`;
          
          // If startLocation is not provided, the first job is the origin and should not be a waypoint
          const waypointsJobs = startLocation ? validJobs : validJobs.slice(1);
          
          if (waypointsJobs.length > 0) {
            const waypoints = `optimize:true|${waypointsJobs.map(j => `${j.lat},${j.lng}`).join('|')}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${origin}&waypoints=${waypoints}&key=${apiKey}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'OK') {
              const route = data.routes[0];
              const waypointOrder = route.waypoint_order; // Array of indices into waypoints
              
              const optimizedJobs = waypointOrder.map((index: number) => waypointsJobs[index]);
              
              // If we didn't use startLocation, the first job was the origin
              const finalOrder = startLocation ? optimizedJobs : [validJobs[0], ...optimizedJobs];
              
              let totalDistanceMeters = 0;
              let totalDurationSeconds = 0;
              
              route.legs.forEach((leg: any) => {
                totalDistanceMeters += leg.distance.value;
                totalDurationSeconds += leg.duration.value;
              });

              // Calculate arrival times starting from 9:00 AM or a reasonable start time
              let currentTime = new Date(`${date}T09:00:00`);
              const optimizedOrder = finalOrder.map((job, idx) => {
                const arrivalTime = currentTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
                // Add travel time to next job (this is simplified, normally we'd add job duration too)
                if (route.legs[idx]) {
                  currentTime = new Date(currentTime.getTime() + (route.legs[idx].duration.value * 1000) + ((job.estimatedDuration || 60) * 60 * 1000));
                }
                
                return {
                  jobId: job.id,
                  order: idx + 1,
                  arrivalTime,
                  address: job.address
                };
              });

              result = {
                optimizedOrder,
                totalDistance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
                totalDuration: `${Math.floor(totalDurationSeconds / 3600)}h ${Math.round((totalDurationSeconds % 3600) / 60)}m`,
                savedDistance: "Calculated via Google Maps" // Placeholder as "original order" isn't strictly defined
              };
              usedGoogleMaps = true;
            } else {
              console.warn("Google Maps Directions API returned status:", data.status);
            }
          } else {
            // Only one job, no optimization needed
            result = {
              optimizedOrder: [{ jobId: validJobs[0].id, order: 1, arrivalTime: "09:00", address: validJobs[0].address }],
              totalDistance: "0 km",
              totalDuration: "0 mins",
              savedDistance: "0 km"
            };
            usedGoogleMaps = true;
          }
        } catch (e) {
          console.error("Google Maps Route Optimization failed, falling back to Haversine:", e);
        }
      }

      // Fallback to Haversine nearest-neighbor if Google Maps failed or no API key
      if (!usedGoogleMaps) {
        const optimizedOrder: any[] = [];
        let currentPos = startLocation || { lat: validJobs[0].lat, lng: validJobs[0].lng };
        const remainingJobs = startLocation ? [...validJobs] : validJobs.slice(1);
        
        if (!startLocation) {
          optimizedOrder.push({
            jobId: validJobs[0].id,
            order: 1,
            arrivalTime: "09:00",
            address: validJobs[0].address
          });
        }

        let currentTime = new Date(`${date}T09:00:00`);
        let totalDist = 0;

        while (remainingJobs.length > 0) {
          let nearestIdx = 0;
          let minDist = haversineDistance(
            currentPos.lat, currentPos.lng,
            remainingJobs[0].lat!, remainingJobs[0].lng!
          );

          for (let i = 1; i < remainingJobs.length; i++) {
            const dist = haversineDistance(
              currentPos.lat, currentPos.lng,
              remainingJobs[i].lat!, remainingJobs[i].lng!
            );
            if (dist < minDist) {
              minDist = dist;
              nearestIdx = i;
            }
          }

          const nextJob = remainingJobs.splice(nearestIdx, 1)[0];
          totalDist += minDist;
          
          // Estimate 30km/h average speed for duration
          const travelTimeMins = (minDist / 30) * 60;
          currentTime = new Date(currentTime.getTime() + (travelTimeMins * 60 * 1000));
          
          optimizedOrder.push({
            jobId: nextJob.id,
            order: optimizedOrder.length + 1,
            arrivalTime: currentTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
            address: nextJob.address
          });
          
          // Add job duration
          currentTime = new Date(currentTime.getTime() + ((nextJob.estimatedDuration || 60) * 60 * 1000));
          currentPos = { lat: nextJob.lat!, lng: nextJob.lng! };
        }

        result = {
          optimizedOrder,
          totalDistance: `${totalDist.toFixed(1)} km`,
          totalDuration: "Estimated via Haversine",
          savedDistance: "N/A (Fallback used)",
          warning: apiKey ? "Google Maps API failed, used fallback" : "No Google Maps API key, used fallback"
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Route optimization error:", error);
      res.status(500).json({ error: "Failed to optimize route" });
    }
  });

  // AI-powered schedule optimization with smart recommendations
  app.post("/api/schedule/ai-optimize", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { date, startLocation, workdayStart, workdayEnd } = req.body;
      
      // Get jobs for the specified date
      const targetDate = date ? new Date(date) : new Date();
      const jobs = await storage.getJobs(effectiveUserId);
      const clients = await storage.getClients(effectiveUserId);
      
      console.log(`[AI Schedule] Optimizing for date: ${targetDate.toDateString()}, total jobs: ${jobs.length}`);
      
      // Filter jobs scheduled for the target date (use scheduledAt field - jobs use this, not scheduledDate)
      const scheduledJobs = jobs.filter(job => {
        // Use scheduledAt (timestamp) not scheduledDate
        const jobScheduledTime = job.scheduledAt || job.scheduledDate;
        if (!jobScheduledTime) return false;
        const jobDate = new Date(jobScheduledTime);
        const isTargetDate = jobDate.toDateString() === targetDate.toDateString();
        const isValidStatus = ['pending', 'scheduled', 'in_progress'].includes(job.status);
        return isTargetDate && isValidStatus;
      });
      
      console.log(`[AI Schedule] Found ${scheduledJobs.length} jobs for ${targetDate.toDateString()}`);

      // Map jobs to the format expected by the optimizer
      // Jobs store their own coordinates (latitude/longitude), use those for optimization
      const scheduleJobs = scheduledJobs.map(job => {
        const client = clients.find(c => c.id === job.clientId);
        // Use job's coordinates first, fallback to client's coordinates
        const lat = job.latitude ? parseFloat(String(job.latitude)) : 
                    (client?.latitude ? parseFloat(String(client.latitude)) : undefined);
        const lng = job.longitude ? parseFloat(String(job.longitude)) : 
                    (client?.longitude ? parseFloat(String(client.longitude)) : undefined);
        
        return {
          id: job.id,
          title: job.title,
          clientName: client?.name || 'Unknown',
          address: job.address || client?.address,
          latitude: lat,
          longitude: lng,
          estimatedDuration: job.estimatedDuration ? parseFloat(String(job.estimatedDuration)) / 60 : 1.5, // Convert minutes to hours
          priority: job.priority as 'low' | 'medium' | 'high' | 'urgent' | undefined
        };
      });
      
      console.log(`[AI Schedule] Jobs with coordinates: ${scheduleJobs.filter(j => j.latitude && j.longitude).length}`);

      // Import and call the AI optimizer
      const { optimizeSchedule, getSchedulingRecommendations } = await import('./ai');
      
      const optimizedSchedule = await optimizeSchedule(
        scheduleJobs,
        startLocation,
        workdayStart || '07:00',
        workdayEnd || '17:00'
      );

      // Get AI recommendations
      const businessSettings = await storage.getBusinessSettings(effectiveUserId);
      const aiRecommendations = await getSchedulingRecommendations(
        scheduleJobs,
        { 
          trade: businessSettings?.industry || undefined,
          businessName: businessSettings?.businessName || undefined
        }
      );

      res.json({
        date: targetDate.toISOString().split('T')[0],
        ...optimizedSchedule,
        aiRecommendations
      });
    } catch (error: any) {
      console.error("AI schedule optimization error:", error);
      res.status(500).json({ error: "Failed to optimize schedule" });
    }
  });

  // Comprehensive profile endpoint - returns user info, team membership, role, and permissions
  app.get("/api/profile/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const user = await AuthService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if this user is a team member
      const myMembership = await storage.getTeamMembershipByMemberId(userId);
      
      let profileData: any = {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: (user as any).phone || null,
          profileImageUrl: user.profileImageUrl,
          tradeType: user.tradeType,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        isOwner: true,
        isTeamMember: false,
        teamInfo: null,
        roleInfo: null,
        permissions: Object.values(PERMISSIONS), // Owners have all permissions
      };
      
      if (myMembership && myMembership.inviteStatus === 'accepted') {
        // User is a team member
        const role = await storage.getUserRole(myMembership.roleId);
        const businessOwner = await AuthService.getUserById(myMembership.businessOwnerId);
        const businessSettings = await storage.getBusinessSettings(myMembership.businessOwnerId);
        
        // Get effective permissions
        const effectivePermissions = (myMembership.useCustomPermissions && myMembership.customPermissions)
          ? myMembership.customPermissions
          : (role?.permissions || []);
        
        profileData = {
          ...profileData,
          isOwner: false,
          isTeamMember: true,
          teamInfo: {
            businessOwnerId: myMembership.businessOwnerId,
            businessName: businessSettings?.businessName || businessOwner?.firstName + "'s Business",
            businessEmail: businessSettings?.email || businessOwner?.email,
            businessPhone: businessSettings?.phone || null,
            joinedAt: myMembership.createdAt,
          },
          roleInfo: {
            roleId: role?.id,
            roleName: role?.name || 'Team Member',
            roleDescription: role?.description || '',
            hasCustomPermissions: myMembership.useCustomPermissions || false,
          },
          permissions: effectivePermissions,
        };
      } else {
        // User is a business owner - check if they have a team
        const teamMembers = await storage.getTeamMembers(userId);
        const businessSettings = await storage.getBusinessSettings(userId);
        
        profileData.teamInfo = {
          isBusinessOwner: true,
          businessName: businessSettings?.businessName || 'My Business',
          businessEmail: businessSettings?.email || user.email,
          businessPhone: businessSettings?.phone || null,
          teamSize: teamMembers.filter(m => m.inviteStatus === 'accepted').length,
        };
        profileData.roleInfo = {
          roleId: 'owner',
          roleName: 'Owner',
          roleDescription: 'Full access to all features',
          hasCustomPermissions: false,
        };
      }
      
      res.json(profileData);
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  
  // Update user profile (personal details)
  app.patch("/api/profile/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { firstName, lastName, phone } = req.body;
      
      // Update user record
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        phone,
      });
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Global Search Endpoint (team-aware)
  app.get("/api/search", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const query = (req.query.q || '').toString().toLowerCase();
      
      if (query.length < 2) {
        return res.json([]);
      }

      const results: any[] = [];

      // Batch fetch all data once for efficiency (use effectiveUserId for team visibility)
      const allClients = await storage.getClients(userContext.effectiveUserId);
      const allJobs = await storage.getJobs(userContext.effectiveUserId);
      const clientsMap = new Map(allClients.map((c: any) => [c.id, c]));
      const jobsMap = new Map(allJobs.map((j: any) => [j.id, j]));

      // Search Clients
      allClients.forEach((client: any) => {
        const matchesQuery = 
          client.name?.toLowerCase()?.includes(query) ||
          client.email?.toLowerCase()?.includes(query) ||
          client.phone?.toLowerCase()?.includes(query) ||
          client.company?.toLowerCase()?.includes(query) ||
          client.address?.toLowerCase()?.includes(query);
        
        if (matchesQuery) {
          results.push({
            type: 'client',
            id: client.id,
            title: client.name,
            subtitle: client.company || client.email || 'No company',
            timestamp: 0, // Clients don't have dates, sort to bottom
          });
        }
      });

      // Search Jobs (including client names)
      allJobs.forEach((job: any) => {
        const client = clientsMap.get(job.clientId);
        const matchesQuery = 
          job.title?.toLowerCase()?.includes(query) ||
          job.description?.toLowerCase()?.includes(query) ||
          job.address?.toLowerCase()?.includes(query) ||
          client?.name?.toLowerCase()?.includes(query) ||
          client?.company?.toLowerCase()?.includes(query);
        
        if (matchesQuery) {
          const timestamp = job.scheduledDate ? new Date(job.scheduledDate).getTime() : 0;
          results.push({
            type: 'job',
            id: job.id,
            title: job.title,
            subtitle: client?.name || 'Unknown client',
            date: job.scheduledDate || undefined,
            status: job.status,
            timestamp,
          });
        }
      });

      // Search Quotes (including client and job names)
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      quotes.forEach((quote: any) => {
        const client = clientsMap.get(quote.clientId);
        const job = quote.jobId ? jobsMap.get(quote.jobId) : null;
        
        const matchesQuery = 
          quote.number?.toLowerCase()?.includes(query) ||
          quote.description?.toLowerCase()?.includes(query) ||
          client?.name?.toLowerCase()?.includes(query) ||
          client?.company?.toLowerCase()?.includes(query) ||
          job?.title?.toLowerCase()?.includes(query);
        
        if (matchesQuery) {
          const timestamp = quote.issuedDate ? new Date(quote.issuedDate).getTime() : 0;
          results.push({
            type: 'quote',
            id: quote.id,
            title: quote.number || 'Quote',
            subtitle: client?.name || 'Unknown client',
            date: quote.issuedDate || undefined,
            amount: quote.total || 0,
            status: quote.status,
            timestamp,
          });
        }
      });

      // Search Invoices (including client and job names)
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      invoices.forEach((invoice: any) => {
        const client = clientsMap.get(invoice.clientId);
        const job = invoice.jobId ? jobsMap.get(invoice.jobId) : null;
        
        const matchesQuery = 
          invoice.number?.toLowerCase()?.includes(query) ||
          invoice.description?.toLowerCase()?.includes(query) ||
          client?.name?.toLowerCase()?.includes(query) ||
          client?.company?.toLowerCase()?.includes(query) ||
          job?.title?.toLowerCase()?.includes(query);
        
        if (matchesQuery) {
          const timestamp = invoice.issuedDate ? new Date(invoice.issuedDate).getTime() : 0;
          results.push({
            type: 'invoice',
            id: invoice.id,
            title: invoice.number || 'Invoice',
            subtitle: client?.name || 'Unknown client',
            date: invoice.issuedDate || undefined,
            amount: invoice.total || 0,
            status: invoice.status,
            timestamp,
          });
        }
      });

      // Sort by most recent first (using numeric timestamps)
      results.sort((a, b) => b.timestamp - a.timestamp);

      // Limit to 20 results max
      res.json(results.slice(0, 20));
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // AI Assistant Routes - Enhanced with rich business context
  app.get("/api/ai/suggestions", requireAuth, async (req: any, res) => {
    try {
      const context = await gatherAIContext(req.userId, storage);
      const suggestions = await generateAISuggestions(context);
      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // AI Smart Notifications - role-based reminders and alerts
  app.get("/api/ai/notifications", requireAuth, async (req: any, res) => {
    try {
      const context = await gatherAIContext(req.userId, storage);
      const notifications: any[] = [];
      const now = new Date();

      // Overdue invoices - high priority
      for (const invoice of context.overdueInvoicesList.slice(0, 3)) {
        notifications.push({
          id: `overdue-invoice-${invoice.id}`,
          type: 'alert',
          title: 'Payment Overdue',
          message: `${invoice.clientName} owes $${invoice.amount.toFixed(2)} - ${invoice.daysPastDue} days overdue`,
          entityType: 'invoice',
          entityId: String(invoice.id),
          priority: invoice.daysPastDue > 30 ? 'high' : 'medium',
          timestamp: now,
        });
      }

      // Pending quotes older than 7 days - medium priority
      for (const quote of context.pendingQuotes.filter(q => q.createdDaysAgo >= 7).slice(0, 2)) {
        notifications.push({
          id: `pending-quote-${quote.id}`,
          type: 'reminder',
          title: 'Quote Follow-up',
          message: `${quote.clientName}'s quote ($${quote.total.toFixed(2)}) sent ${quote.createdDaysAgo} days ago - worth a follow-up`,
          entityType: 'quote',
          entityId: String(quote.id),
          priority: quote.createdDaysAgo > 14 ? 'high' : 'medium',
          timestamp: now,
        });
      }

      // Today's jobs reminder
      if (context.todaysJobs.length > 0) {
        const firstJob = context.todaysJobs[0];
        notifications.push({
          id: `todays-jobs`,
          type: 'suggestion',
          title: `${context.todaysJobs.length} Job${context.todaysJobs.length > 1 ? 's' : ''} Today`,
          message: `First up: ${firstJob.title} for ${firstJob.clientName}${firstJob.time ? ` at ${firstJob.time}` : ''}`,
          entityType: 'job',
          entityId: String(firstJob.id),
          priority: 'medium',
          timestamp: now,
        });
      }

      // Jobs done but not invoiced
      const doneJobs = context.todaysJobs.filter(j => j.status === 'done');
      if (doneJobs.length > 0) {
        notifications.push({
          id: `invoice-reminder`,
          type: 'suggestion',
          title: 'Ready to Invoice',
          message: `${doneJobs.length} completed job${doneJobs.length > 1 ? 's' : ''} waiting for invoices`,
          entityType: 'job',
          entityId: String(doneJobs[0].id),
          priority: 'low',
          timestamp: now,
        });
      }

      res.json({ notifications });
    } catch (error) {
      console.error("Error generating AI notifications:", error);
      res.status(500).json({ error: "Failed to generate notifications" });
    }
  });

  app.post("/api/ai/chat", requireAuth, async (req: any, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const userContext = await getUserContext(req.userId);
      const context = await gatherAIContext(userContext.effectiveUserId, storage);
      const chatResponse = await chatWithAI(message, context);
      
      res.json(chatResponse);
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // AI action execution endpoint - handles all AI-triggered workflows
  app.post("/api/ai/execute-action", requireAuth, async (req: any, res) => {
    try {
      const { action } = req.body;
      
      if (!action || !action.type) {
        return res.status(400).json({ error: "Action is required" });
      }

      const { sendEmailViaIntegration } = await import('./emailIntegrationService');
      const { sendSMS: twilioSendSMS, isTwilioInitialized, initializeTwilio } = await import('./twilioClient');
      
      // Real SMS sending via Twilio
      const sendSMS = async (options: { to: string; message: string }) => {
        // Ensure Twilio is initialized
        if (!isTwilioInitialized()) {
          const initialized = await initializeTwilio();
          if (!initialized) {
            console.error('[SMS] Twilio not configured - cannot send SMS');
            return { success: false, error: 'SMS service not configured' };
          }
        }
        return twilioSendSMS(options);
      };

      // Helper to find client by name (team-aware)
      const userContext = await getUserContext(req.userId);
      const findClient = async (clientName: string) => {
        const clients = await storage.getClients(userContext.effectiveUserId);
        return clients.find((c: any) => 
          c.name?.toLowerCase() === clientName?.toLowerCase()
        );
      };

      // ========== SEND EMAIL ==========
      if (action.type === 'send_email' && action.data) {
        let recipientEmail = action.data.clientEmail;
        if (!recipientEmail && action.data.clientName) {
          const client = await findClient(action.data.clientName);
          recipientEmail = client?.email;
        }

        if (!recipientEmail) {
          return res.json({ 
            success: false, 
            message: `Couldn't find an email for ${action.data.clientName || 'this client'}. Add their email in Clients.` 
          });
        }

        const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
        const result = await sendEmailViaIntegration({
          to: recipientEmail,
          subject: action.data.subject || 'Message from your tradie',
          html: (action.data.body || '').replace(/\n/g, '<br>'),
          text: action.data.body || '',
          userId: req.userId,
          type: action.data.emailType === 'invoice' ? 'invoice' : 
                action.data.emailType === 'quote' ? 'quote' : 'reminder',
          fromName: businessSettings?.businessName,
          replyTo: businessSettings?.businessEmail || undefined,
        });

        return res.json({ 
          success: result.success, 
          message: result.success 
            ? `Email sent to ${action.data.clientName || recipientEmail}!` 
            : (result.error || "Failed to send email. Check Settings > Integrations.")
        });
      }

      // ========== SEND SMS ==========
      if (action.type === 'send_sms' && action.data) {
        let recipientPhone = action.data.clientPhone;
        if (!recipientPhone && action.data.clientName) {
          const client = await findClient(action.data.clientName);
          recipientPhone = client?.phone;
        }

        if (!recipientPhone) {
          return res.json({ 
            success: false, 
            message: `Couldn't find a phone number for ${action.data.clientName || 'this client'}. Add their number in Clients.` 
          });
        }

        try {
          await sendSMS({
            to: recipientPhone,
            message: action.data.message
          });
          return res.json({ 
            success: true, 
            message: `SMS sent to ${action.data.clientName}!` 
          });
        } catch (smsError: any) {
          return res.json({ 
            success: false, 
            message: smsError.message || "Failed to send SMS" 
          });
        }
      }

      // ========== SEND EXISTING INVOICE (team-aware) ==========
      if (action.type === 'send_invoice' && action.data) {
        const invoice = await storage.getInvoiceWithLineItems(action.data.invoiceId, userContext.effectiveUserId);
        if (!invoice) {
          return res.json({ success: false, message: "Invoice not found" });
        }

        const client = await storage.getClientById(invoice.clientId);
        if (!client?.email) {
          return res.json({ 
            success: false, 
            message: `${client?.name || 'Client'} doesn't have an email address. Add it in Clients.` 
          });
        }

        const business = await storage.getBusinessSettings(userContext.effectiveUserId);
        
        // Fetch business templates for terms and warranty
        const termsTemplateResult = await db.select().from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userContext.effectiveUserId),
            eq(businessTemplates.family, 'terms_conditions'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        const warrantyTemplateResult = await db.select().from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userContext.effectiveUserId),
            eq(businessTemplates.family, 'warranty'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        
        const termsTemplate = termsTemplateResult[0]?.content;
        const warrantyTemplate = warrantyTemplateResult[0]?.content;
        
        const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
        const businessForPdf = await resolveBusinessLogoForPdf(business);
        const html = generateInvoicePDF({
          invoice,
          lineItems: invoice.lineItems || [],
          client,
          business: businessForPdf,
          termsTemplate,
          warrantyTemplate
        });
        const pdfBuffer = await generatePDFBuffer(html);

        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: `Invoice ${invoice.number || ''} from ${business?.businessName || 'Your Tradie'}`,
          html: `<p>Hi ${client.name?.split(' ')[0]},</p>
                 <p>Please find attached invoice ${invoice.number || ''} for $${parseFloat(invoice.total || '0').toFixed(2)}.</p>
                 ${action.data.message ? `<p>${action.data.message}</p>` : ''}
                 <p>Thanks for your business!</p>
                 <p>${business?.businessName || ''}</p>`,
          text: `Invoice ${invoice.number || ''} attached`,
          userId: userContext.effectiveUserId,
          type: 'invoice',
          relatedId: invoice.id.toString(),
          attachments: [{ filename: `Invoice-${invoice.number || invoice.id}.pdf`, content: pdfBuffer }],
          fromName: business?.businessName,
          replyTo: business?.businessEmail || undefined,
        });

        if (result.success) {
          await storage.updateInvoice(invoice.id, userContext.effectiveUserId, { status: 'sent' });
        }

        return res.json({ 
          success: result.success, 
          message: result.success 
            ? `Invoice sent to ${client.name}!` 
            : (result.error || "Failed to send invoice")
        });
      }

      // ========== SEND EXISTING QUOTE (team-aware) ==========
      if (action.type === 'send_quote' && action.data) {
        const quote = await storage.getQuoteWithLineItems(action.data.quoteId, userContext.effectiveUserId);
        if (!quote) {
          return res.json({ success: false, message: "Quote not found" });
        }

        const client = await storage.getClientById(quote.clientId);
        if (!client?.email) {
          return res.json({ 
            success: false, 
            message: `${client?.name || 'Client'} doesn't have an email address. Add it in Clients.` 
          });
        }

        const business = await storage.getBusinessSettings(userContext.effectiveUserId);
        const { generateQuotePDF, resolveBusinessLogoForPdf } = await import('./pdfService');
        const businessForPdf = await resolveBusinessLogoForPdf(business);
        const pdfBuffer = await generateQuotePDF(quote, quote.lineItems || [], client, businessForPdf);

        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: `Quote ${quote.number || ''} from ${business?.businessName || 'Your Tradie'}`,
          html: `<p>Hi ${client.name?.split(' ')[0]},</p>
                 <p>Please find attached your quote for $${parseFloat(quote.total || '0').toFixed(2)}.</p>
                 ${action.data.message ? `<p>${action.data.message}</p>` : ''}
                 <p>Let me know if you have any questions!</p>
                 <p>${business?.businessName || ''}</p>`,
          text: `Quote ${quote.number || ''} attached`,
          userId: userContext.effectiveUserId,
          type: 'quote',
          relatedId: quote.id.toString(),
          attachments: [{ filename: `Quote-${quote.number || quote.id}.pdf`, content: pdfBuffer }],
          fromName: business?.businessName,
          replyTo: business?.businessEmail || undefined,
        });

        if (result.success) {
          await storage.updateQuote(quote.id, userContext.effectiveUserId, { status: 'sent' });
        }

        return res.json({ 
          success: result.success, 
          message: result.success 
            ? `Quote sent to ${client.name}!` 
            : (result.error || "Failed to send quote")
        });
      }

      // ========== CREATE INVOICE (team-aware) ==========
      if (action.type === 'create_invoice' && action.data) {
        let clientId = action.data.clientId;
        if (!clientId && action.data.clientName) {
          const client = await findClient(action.data.clientName);
          clientId = client?.id;
        }

        if (!clientId) {
          return res.json({ 
            success: false, 
            message: `Couldn't find client "${action.data.clientName}". Create them first in Clients.` 
          });
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (action.data.dueInDays || 14));

        const invoice = await storage.createInvoice({
          userId: userContext.effectiveUserId,
          clientId,
          jobId: action.data.fromJobId || null,
          title: action.data.description || 'Invoice',
          description: action.data.description,
          subtotal: String(action.data.amount),
          gstAmount: String(action.data.amount * 0.1),
          total: String(action.data.amount * 1.1),
          status: 'draft',
          issuedDate: new Date(),
          dueDate,
        });

        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: action.data.description,
          quantity: '1',
          unitPrice: String(action.data.amount),
          total: String(action.data.amount)
        });

        return res.json({ 
          success: true, 
          message: `Invoice created for $${(action.data.amount * 1.1).toFixed(2)} (inc GST)!`,
          invoiceId: invoice.id,
          navigateTo: `/invoices/${invoice.id}`
        });
      }

      // ========== CREATE QUOTE (team-aware) ==========
      if (action.type === 'create_quote' && action.data) {
        let clientId = action.data.clientId;
        if (!clientId && action.data.clientName) {
          const client = await findClient(action.data.clientName);
          clientId = client?.id;
        }

        if (!clientId) {
          return res.json({ 
            success: false, 
            message: `Couldn't find client "${action.data.clientName}". Create them first in Clients.` 
          });
        }

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + (action.data.validForDays || 30));

        const quote = await storage.createQuote({
          userId: userContext.effectiveUserId,
          clientId,
          title: action.data.description || 'Quote',
          description: action.data.description,
          subtotal: String(action.data.amount),
          gstAmount: String(action.data.amount * 0.1),
          total: String(action.data.amount * 1.1),
          status: 'draft',
          issuedDate: new Date(),
          validUntil,
        });

        await storage.createQuoteLineItem({
          quoteId: quote.id,
          description: action.data.description,
          quantity: '1',
          unitPrice: String(action.data.amount),
          total: String(action.data.amount)
        });

        return res.json({ 
          success: true, 
          message: `Quote created for $${(action.data.amount * 1.1).toFixed(2)} (inc GST)!`,
          quoteId: quote.id,
          navigateTo: `/quotes/${quote.id}`
        });
      }

      // ========== CREATE JOB (team-aware) ==========
      if (action.type === 'create_job' && action.data) {
        let clientId = action.data.clientId;
        if (!clientId && action.data.clientName) {
          const client = await findClient(action.data.clientName);
          clientId = client?.id;
        }

        if (!clientId) {
          return res.json({ 
            success: false, 
            message: `Couldn't find client "${action.data.clientName}". Create them first in Clients.` 
          });
        }

        // Parse scheduled date
        let scheduledAt: Date | null = null;
        if (action.data.scheduledDate) {
          const dateStr = action.data.scheduledDate.toLowerCase();
          const now = new Date();
          if (dateStr === 'tomorrow') {
            scheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          } else if (dateStr.includes('next')) {
            scheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else {
            scheduledAt = new Date(action.data.scheduledDate);
          }
        }

        const job = await storage.createJob({
          userId: userContext.effectiveUserId,
          clientId,
          title: action.data.title,
          description: action.data.notes || '',
          address: action.data.address || '',
          scheduledAt,
          status: 'scheduled',
          quoteId: action.data.fromQuoteId || null,
        });

        return res.json({ 
          success: true, 
          message: `Job scheduled for ${action.data.clientName}!`,
          jobId: job.id,
          navigateTo: `/jobs/${job.id}`
        });
      }

      // ========== MARK JOB COMPLETE (team-aware) ==========
      if (action.type === 'mark_job_complete' && action.data) {
        const job = await storage.getJob(action.data.jobId, userContext.effectiveUserId);
        if (!job) {
          return res.json({ success: false, message: "Job not found" });
        }

        await storage.updateJob(action.data.jobId, userContext.effectiveUserId, { 
          status: 'done',
          completedAt: new Date()
        });

        let invoiceMessage = '';
        if (action.data.createInvoice) {
          const client = await storage.getClientById(job.clientId);
          invoiceMessage = ` Ready to invoice ${client?.name || 'client'} - head to Invoices to create one.`;
        }

        return res.json({ 
          success: true, 
          message: `Job marked complete!${invoiceMessage}`,
          navigateTo: action.data.createInvoice ? '/invoices/new' : undefined
        });
      }

      // ========== PAYMENT REMINDER (team-aware) ==========
      if (action.type === 'payment_reminder' && action.data) {
        const invoice = await storage.getInvoiceWithLineItems(action.data.invoiceId, userContext.effectiveUserId);
        if (!invoice) {
          return res.json({ success: false, message: "Invoice not found" });
        }

        const client = await storage.getClientById(invoice.clientId);
        const business = await storage.getBusinessSettings(userContext.effectiveUserId);
        const invoiceTotal = parseFloat(invoice.total || '0').toFixed(2);

        // Generate reminder message based on tone
        const reminderMessages = {
          gentle: `Hi ${client?.name?.split(' ')[0]},\n\nJust a friendly reminder that invoice ${invoice.number || ''} for $${invoiceTotal} is now overdue. If you've already paid, please ignore this message.\n\nCheers,\n${business?.businessName || ''}`,
          firm: `Hi ${client?.name?.split(' ')[0]},\n\nThis is a reminder that invoice ${invoice.number || ''} for $${invoiceTotal} is now ${action.data.daysPastDue} days overdue. Please arrange payment at your earliest convenience.\n\nThanks,\n${business?.businessName || ''}`,
          final: `Hi ${client?.name?.split(' ')[0]},\n\nFinal notice: Invoice ${invoice.number || ''} for $${invoiceTotal} is now ${action.data.daysPastDue} days overdue. Please contact us immediately to arrange payment and avoid further action.\n\nRegards,\n${business?.businessName || ''}`
        };

        const message = reminderMessages[action.data.reminderType as keyof typeof reminderMessages] || reminderMessages.gentle;
        const results: string[] = [];

        // Send via email
        if ((action.data.channel === 'email' || action.data.channel === 'both') && client?.email) {
          const emailResult = await sendEmailViaIntegration({
            to: client.email,
            subject: `Payment Reminder: Invoice ${invoice.number || ''} - ${business?.businessName || ''}`,
            html: message.replace(/\n/g, '<br>'),
            text: message,
            userId: userContext.effectiveUserId,
            type: 'reminder',
            relatedId: invoice.id.toString(),
            fromName: business?.businessName,
            replyTo: business?.businessEmail || undefined,
          });
          results.push(emailResult.success ? 'Email sent' : 'Email failed');
        }

        // Send via SMS
        if ((action.data.channel === 'sms' || action.data.channel === 'both') && client?.phone) {
          try {
            const smsMessage = `Reminder: Invoice ${invoice.number || ''} for $${invoiceTotal} is ${action.data.daysPastDue} days overdue. - ${business?.businessName || ''}`;
            await sendSMS({ to: client.phone, message: smsMessage });
            results.push('SMS sent');
          } catch {
            results.push('SMS failed');
          }
        }

        return res.json({ 
          success: results.some(r => r.includes('sent')), 
          message: `Payment reminder sent to ${client?.name}: ${results.join(', ')}`
        });
      }

      // ========== NAVIGATE ==========
      if (action.type === 'navigate' && action.data?.path) {
        return res.json({ 
          success: true, 
          message: `Navigating to ${action.data.path}`,
          navigateTo: action.data.path
        });
      }

      // ========== DRAFT MESSAGE ==========
      if (action.type === 'draft_message' && action.data) {
        return res.json({ 
          success: true, 
          message: "Draft prepared",
          draft: {
            type: action.data.messageType,
            to: action.data.clientName,
            subject: action.data.subject,
            body: action.data.body
          }
        });
      }

      // Unknown action type
      res.json({ success: false, message: "Unknown action type" });
    } catch (error) {
      console.error("Error executing AI action:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });

  // AI Email Suggestion endpoint - generates professional Australian English email content
  app.post("/api/ai/email-suggestion", requireAuth, async (req: any, res) => {
    try {
      const { type, clientName, clientFirstName, documentNumber, documentTitle, total, businessName } = req.body;
      
      if (!type || !['quote', 'invoice'].includes(type)) {
        return res.status(400).json({ error: "Invalid type. Must be 'quote' or 'invoice'" });
      }
      
      if (!clientName || !documentNumber || !documentTitle) {
        return res.status(400).json({ error: "Missing required fields: clientName, documentNumber, documentTitle" });
      }
      
      const { generateEmailSuggestion } = await import('./ai');
      
      const suggestion = await generateEmailSuggestion({
        type,
        clientName,
        clientFirstName: clientFirstName || clientName.split(' ')[0],
        documentNumber,
        documentTitle,
        total: total || '0',
        businessName
      });
      
      res.json(suggestion);
    } catch (error) {
      console.error("Error generating email suggestion:", error);
      res.status(500).json({ error: "Failed to generate email suggestion" });
    }
  });

  // AI Schedule Suggestions endpoint - generates optimal job scheduling recommendations (team-aware)
  app.post("/api/ai/schedule-suggestions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { targetDate } = req.body;
      
      if (!targetDate) {
        return res.status(400).json({ error: "targetDate is required (YYYY-MM-DD format)" });
      }
      
      // Get business settings for context
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = businessSettings?.businessName || 'My Business';
      const tradeName = businessSettings?.tradeName || 'Trade';
      
      // Get all jobs
      const allJobs = await storage.getJobs(userContext.effectiveUserId);
      
      // Get clients for name lookup
      const clients = await storage.getClients(userContext.effectiveUserId);
      const clientsMap = new Map(clients.map(c => [c.id, c]));
      
      // Get team members
      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      
      // Filter unscheduled jobs (pending status, no scheduledAt)
      const unscheduledJobs = allJobs
        .filter(job => !job.scheduledAt && ['pending', 'scheduled'].includes(job.status.toLowerCase()))
        .map(job => ({
          id: job.id,
          title: job.title,
          clientName: clientsMap.get(job.clientId)?.name || 'Unknown Client',
          clientId: job.clientId,
          address: job.address || undefined,
          estimatedDuration: job.estimatedDuration || 60,
          priority: undefined,
          latitude: job.latitude ? parseFloat(job.latitude) : undefined,
          longitude: job.longitude ? parseFloat(job.longitude) : undefined,
        }));
      
      // Get jobs scheduled for the target date
      const existingJobsForDate = allJobs
        .filter(job => {
          if (!job.scheduledAt) return false;
          const jobDateStr = new Date(job.scheduledAt).toISOString().split('T')[0];
          return jobDateStr === targetDate;
        })
        .map(job => ({
          id: job.id,
          title: job.title,
          time: job.scheduledTime || '09:00',
          assignedTo: job.assignedTo || undefined,
          address: job.address || undefined,
        }));
      
      // Build team availability
      const ownerMember = {
        id: 'owner',
        name: 'Owner',
        scheduledMinutes: 0,
        capacity: 480, // 8 hours
        scheduledJobs: [] as Array<{ time: string; title: string }>,
      };
      
      // Calculate owner's scheduled minutes
      const ownerJobs = existingJobsForDate.filter(j => !j.assignedTo);
      ownerMember.scheduledMinutes = ownerJobs.reduce((sum, j) => {
        const fullJob = allJobs.find(fj => fj.id === j.id);
        return sum + (fullJob?.estimatedDuration || 60);
      }, 0);
      ownerMember.scheduledJobs = ownerJobs.map(j => ({ time: j.time, title: j.title }));
      
      const teamAvailability = [ownerMember];
      
      // Add team members
      for (const member of teamMembers.filter(m => m.isActive)) {
        const memberJobs = existingJobsForDate.filter(j => j.assignedTo === member.memberId);
        const scheduledMinutes = memberJobs.reduce((sum, j) => {
          const fullJob = allJobs.find(fj => fj.id === j.id);
          return sum + (fullJob?.estimatedDuration || 60);
        }, 0);
        
        teamAvailability.push({
          id: member.memberId,
          name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
          scheduledMinutes,
          capacity: 480,
          scheduledJobs: memberJobs.map(j => ({ time: j.time, title: j.title })),
        });
      }
      
      // Import and call the AI scheduling function
      const { generateScheduleSuggestions } = await import('./ai');
      
      const suggestions = await generateScheduleSuggestions({
        businessName,
        tradeName,
        unscheduledJobs,
        teamAvailability,
        targetDate,
        existingJobsForDate,
      });
      
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating schedule suggestions:", error);
      res.status(500).json({ error: "Failed to generate schedule suggestions" });
    }
  });

  // AI Quote Learning endpoint - suggests pricing based on similar past quotes
  app.post("/api/ai/quote-suggestions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { description, jobType } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      // Query past quote line items for this user with similar descriptions
      // Join quote_line_items with quotes to filter by userId and get quote dates
      const similarItems = await db
        .select({
          description: quoteLineItems.description,
          unitPrice: quoteLineItems.unitPrice,
          createdAt: quotes.createdAt,
        })
        .from(quoteLineItems)
        .innerJoin(quotes, eq(quoteLineItems.quoteId, quotes.id))
        .where(
          and(
            eq(quotes.userId, userContext.effectiveUserId),
            sql`${quoteLineItems.description} ILIKE ${'%' + description + '%'}`
          )
        )
        .orderBy(desc(quotes.createdAt));

      if (similarItems.length === 0) {
        return res.json({
          suggestions: [],
          message: "No similar past quotes found for this description."
        });
      }

      // Group by description and calculate stats
      const statsMap = new Map<string, {
        description: string;
        prices: number[];
        lastUsedPrice: number;
        lastUsedDate: string;
        frequency: number;
      }>();

      for (const item of similarItems) {
        const desc = item.description;
        const price = parseFloat(item.unitPrice);
        const date = item.createdAt ? item.createdAt.toISOString().split('T')[0] : '';

        if (!statsMap.has(desc)) {
          statsMap.set(desc, {
            description: desc,
            prices: [price],
            lastUsedPrice: price,
            lastUsedDate: date,
            frequency: 1
          });
        } else {
          const stats = statsMap.get(desc)!;
          stats.prices.push(price);
          stats.frequency += 1;
        }
      }

      const suggestions = Array.from(statsMap.values())
        .map(stats => ({
          description: stats.description,
          lastUsedPrice: stats.lastUsedPrice,
          lastUsedDate: stats.lastUsedDate,
          frequency: stats.frequency,
          averagePrice: stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);

      // Format a friendly message based on the most recent match
      const mostRecent = similarItems[0];
      const message = `Last time you quoted '${mostRecent.description}' for $${parseFloat(mostRecent.unitPrice).toFixed(2)}`;

      res.json({
        suggestions,
        message
      });
    } catch (error) {
      console.error("Error generating quote suggestions:", error);
      res.status(500).json({ error: "Failed to generate quote suggestions" });
    }
  });

  // ============================
  // STANDOUT AI FEATURES
  // ============================

  // AI Quote Generator from Photos + Voice - THE KILLER FEATURE (team-aware)
  app.post("/api/ai/generate-quote", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { jobId, photoUrls, voiceTranscription, jobDescription } = req.body;
      
      // Get business settings for trade type
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const tradeType = businessSettings?.tradeName || 'Trade';
      const businessName = businessSettings?.businessName || 'My Business';
      
      // If jobId provided, get job details
      let description = jobDescription;
      let photos: string[] = photoUrls || [];
      
      if (jobId) {
        const job = await storage.getJob(jobId, userContext.effectiveUserId);
        if (job) {
          description = description || job.description || job.title;
          // Get job photos if not provided
          if (!photos.length && (job as any).photos) {
            photos = (job as any).photos.map((p: any) => p.url);
          }
        }
      }
      
      const { generateQuoteFromMedia } = await import('./ai');
      
      const result = await generateQuoteFromMedia({
        photoUrls: photos,
        voiceTranscription,
        jobDescription: description,
        tradeType,
        businessName,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error generating AI quote:", error);
      res.status(500).json({ error: "Failed to generate quote. Please try again." });
    }
  });

  // Instant Job Parser - Create job from pasted text (SMS, email, message) (team-aware)
  app.post("/api/ai/parse-job-text", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length < 10) {
        return res.status(400).json({ error: "Please provide at least 10 characters of text to parse." });
      }
      
      // Get business settings for trade type
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const tradeType = businessSettings?.tradeName || 'Trade';
      
      const { parseJobFromText } = await import('./ai');
      
      const result = await parseJobFromText(text.trim(), tradeType);
      
      res.json(result);
    } catch (error) {
      console.error("Error parsing job text:", error);
      res.status(500).json({ error: "Failed to parse text. Please try again." });
    }
  });

  // Streaming AI Photo Analysis - Analyse job photos with GPT-4o vision
  app.get("/api/jobs/:jobId/photos/analyze", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobId = req.params.jobId;
      
      // Get optional photoIds query parameter for selecting specific photos
      const photoIdsParam = req.query.photoIds as string | undefined;
      const selectedPhotoIds = photoIdsParam ? photoIdsParam.split(',').filter(Boolean) : null;
      
      // Get job details
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Get photos with signed URLs
      const { getJobPhotos } = await import('./photoService');
      const photos = await getJobPhotos(jobId, userContext.effectiveUserId);
      
      if (!photos.length) {
        return res.status(400).json({ error: 'No photos found for this job' });
      }
      
      // Filter to only photos with valid signed URLs and limit to 10
      // If photoIds are provided, only include those photos
      const photosWithUrls = photos
        .filter(p => p.signedUrl && (p.mimeType?.startsWith('image/') ?? true))
        .filter(p => selectedPhotoIds ? selectedPhotoIds.includes(p.id) : true)
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          signedUrl: p.signedUrl!,
          fileName: p.fileName,
          category: p.category,
          caption: p.caption || undefined
        }));
      
      if (!photosWithUrls.length) {
        return res.status(400).json({ error: 'No valid photo URLs available' });
      }
      
      // Get business settings for trade type and AI permissions
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      // Check if AI photo analysis is enabled
      const aiEnabled = businessSettings?.aiEnabled !== false;
      const aiPhotoAnalysisEnabled = businessSettings?.aiPhotoAnalysisEnabled !== false;
      
      if (!aiEnabled || !aiPhotoAnalysisEnabled) {
        return res.status(403).json({ 
          error: 'AI photo analysis is disabled. Enable it in Settings > Notifications to use this feature.' 
        });
      }
      
      const client = job.clientId ? await storage.getClient(job.clientId, userContext.effectiveUserId) : null;
      
      // Stream the AI analysis
      const { streamPhotoAnalysis } = await import('./ai');
      
      const jobContext = {
        title: job.title,
        description: job.description || undefined,
        clientName: client?.name || undefined,
        trade: businessSettings?.tradeName || undefined
      };
      
      // Check if non-streaming mode is requested (for React Native)
      const noStream = req.query.noStream === 'true';
      
      if (noStream) {
        // Non-streaming mode: collect all chunks and return as JSON
        let fullText = '';
        for await (const chunk of streamPhotoAnalysis(photosWithUrls, jobContext)) {
          fullText += chunk;
        }
        return res.json({ text: fullText, done: true });
      }
      
      // Streaming mode: Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      
      for await (const chunk of streamPhotoAnalysis(photosWithUrls, jobContext)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      
      // Signal completion
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error('Error in streaming photo analysis:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Get Next Action for a Job - Shows what to do next
  app.get("/api/jobs/:id/next-action", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get related data
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      const jobQuotes = quotes.filter(q => q.jobId === job.id);
      const jobInvoices = invoices.filter(i => i.jobId === job.id);
      const client = clients.find(c => c.id === job.clientId);
      
      const hasQuote = jobQuotes.length > 0;
      const hasInvoice = jobInvoices.length > 0;
      const quoteStatus = hasQuote ? jobQuotes[0].status : undefined;
      const invoiceStatus = hasInvoice ? jobInvoices[0].status : undefined;
      
      const daysSinceCreated = Math.floor((Date.now() - new Date(job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceLastUpdate = Math.floor((Date.now() - new Date(job.updatedAt || job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      
      const { generateJobNextAction } = await import('./ai');
      
      const nextAction = await generateJobNextAction({
        jobStatus: job.status,
        jobTitle: job.title,
        clientName: client?.name || 'Unknown',
        hasQuote,
        quoteStatus,
        hasInvoice,
        invoiceStatus,
        daysSinceCreated,
        daysSinceLastUpdate,
        hasPhotos: !!((job as any).photos?.length),
        scheduledAt: job.scheduledAt,
        completedAt: job.completedAt,
      });
      
      res.json(nextAction);
    } catch (error) {
      console.error("Error getting job next action:", error);
      res.status(500).json({ error: "Failed to get next action" });
    }
  });

  // Batch get Next Actions for all jobs (for job list view)
  app.get("/api/jobs/next-actions", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      const quotes = await storage.getQuotes(userContext.effectiveUserId);
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      const { generateJobNextAction } = await import('./ai');
      
      const nextActions: Record<string, any> = {};
      
      // Process active jobs only (not invoiced)
      const activeJobs = jobs.filter(j => j.status !== 'invoiced').slice(0, 50);
      
      for (const job of activeJobs) {
        const jobQuotes = quotes.filter(q => q.jobId === job.id);
        const jobInvoices = invoices.filter(i => i.jobId === job.id);
        const client = clients.find(c => c.id === job.clientId);
        
        const hasQuote = jobQuotes.length > 0;
        const hasInvoice = jobInvoices.length > 0;
        const quoteStatus = hasQuote ? jobQuotes[0].status : undefined;
        const invoiceStatus = hasInvoice ? jobInvoices[0].status : undefined;
        
        const daysSinceCreated = Math.floor((Date.now() - new Date(job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLastUpdate = Math.floor((Date.now() - new Date(job.updatedAt || job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        
        nextActions[job.id] = await generateJobNextAction({
          jobStatus: job.status,
          jobTitle: job.title,
          clientName: client?.name || 'Unknown',
          hasQuote,
          quoteStatus,
          hasInvoice,
          invoiceStatus,
          daysSinceCreated,
          daysSinceLastUpdate,
          hasPhotos: !!((job as any).photos?.length),
          scheduledAt: job.scheduledAt,
          completedAt: job.completedAt,
        });
      }
      
      res.json(nextActions);
    } catch (error) {
      console.error("Error getting job next actions:", error);
      res.status(500).json({ error: "Failed to get next actions" });
    }
  });

  // Job Profitability - Simple profit/loss indicator
  app.get("/api/jobs/:id/profit", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get invoices for this job
      const invoices = await storage.getInvoices(userContext.effectiveUserId);
      const jobInvoices = invoices.filter(i => i.jobId === job.id && i.status === 'paid');
      const invoiceTotal = jobInvoices.reduce((sum, i) => sum + (parseFloat(i.total || '0')), 0);
      
      // Get expenses for this job
      const expenses = await storage.getExpenses(userContext.effectiveUserId);
      const jobExpenses = expenses.filter(e => e.jobId === job.id);
      const materialsCost = jobExpenses.filter(e => e.category === 'materials').reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const otherExpenses = jobExpenses.filter(e => e.category !== 'materials').reduce((sum, e) => sum + parseFloat(e.amount), 0);
      
      // Get time entries for labour cost
      const timeEntries = await storage.getTimeEntriesByJob(job.id, userContext.effectiveUserId);
      const totalMinutes = timeEntries.reduce((sum, t) => {
        if (t.startTime && t.endTime) {
          return sum + Math.floor((new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000);
        }
        return sum;
      }, 0);
      const hourlyRate = 80; // Default rate
      const labourCost = (totalMinutes / 60) * hourlyRate;
      
      const { calculateJobProfit } = await import('./ai');
      
      const profitData = calculateJobProfit({
        invoiceTotal,
        labourCost,
        materialsCost,
        otherExpenses,
      });
      
      res.json({
        ...profitData,
        revenue: invoiceTotal,
        costs: {
          labour: labourCost,
          materials: materialsCost,
          other: otherExpenses,
          total: labourCost + materialsCost + otherExpenses,
        },
        hoursWorked: totalMinutes / 60,
      });
    } catch (error) {
      console.error("Error calculating job profit:", error);
      res.status(500).json({ error: "Failed to calculate profit" });
    }
  });

  // Helper to ensure logoUrl is accessible from both web and mobile
  function resolveBrowserLogoUrl(logoUrl: string | null | undefined, makeAbsolute: boolean = false): string | null {
    if (!logoUrl) return null;
    // Already a data URL or external URL - return as-is
    if (logoUrl.startsWith('data:') || logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }
    
    let relativePath: string;
    // Already has /objects/ prefix
    if (logoUrl.startsWith('/objects/')) {
      relativePath = logoUrl;
    } else if (logoUrl.startsWith('/')) {
      // GCS path without /objects/ prefix - add it
      relativePath = `/objects${logoUrl}`;
    } else {
      // Relative path - add /objects/ prefix
      relativePath = `/objects/${logoUrl}`;
    }
    
    // For mobile apps, convert to absolute URL
    if (makeAbsolute) {
      return `${getProductionBaseUrl()}${relativePath}`;
    }
    
    return relativePath;
  }

  // Business Settings Routes
  app.get("/api/business-settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getBusinessSettings(req.userId);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      // Include user's subscription tier in business settings response
      const user = await storage.getUser(req.userId);
      
      // Detect mobile app requests - they need absolute URLs for images
      const userAgent = req.headers['user-agent'] || '';
      const isMobileApp = userAgent.includes('Expo') || 
                          userAgent.includes('ReactNative') || 
                          req.headers['x-mobile-app'] === 'true';
      
      res.json({
        ...settings,
        // Ensure logoUrl is accessible - absolute URL for mobile, relative for web
        logoUrl: resolveBrowserLogoUrl(settings.logoUrl, isMobileApp),
        subscriptionTier: user?.subscriptionTier || 'free',
      });
    } catch (error) {
      console.error("Error fetching business settings:", error);
      res.status(500).json({ error: "Failed to fetch business settings" });
    }
  });

  app.post("/api/business-settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      // Extract tradeType from request - it belongs to users table, not business_settings
      const { tradeType, ...businessSettingsData } = req.body;
      
      // If tradeType is provided, update the user's trade type
      if (tradeType) {
        await storage.updateUser(req.userId, { tradeType });
      }
      
      // Convert numeric fields to strings (mobile app sends numbers, schema expects strings for decimal columns)
      if (typeof businessSettingsData.defaultHourlyRate === 'number') {
        businessSettingsData.defaultHourlyRate = String(businessSettingsData.defaultHourlyRate);
      }
      if (typeof businessSettingsData.calloutFee === 'number') {
        businessSettingsData.calloutFee = String(businessSettingsData.calloutFee);
      }
      
      const data = insertBusinessSettingsSchema.parse(businessSettingsData);
      const settings = await storage.createBusinessSettings({ ...data, userId: req.userId });
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating business settings:", error);
      res.status(500).json({ error: "Failed to create business settings" });
    }
  });

  app.patch("/api/business-settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      // Extract tradeType from request - it belongs to users table, not business_settings
      const { tradeType, ...businessSettingsData } = req.body;
      
      // If tradeType is provided, update the user's trade type
      if (tradeType) {
        await storage.updateUser(req.userId, { tradeType });
      }
      
      // Convert numeric fields to strings (mobile app sends numbers, schema expects strings for decimal columns)
      if (typeof businessSettingsData.defaultHourlyRate === 'number') {
        businessSettingsData.defaultHourlyRate = String(businessSettingsData.defaultHourlyRate);
      }
      if (typeof businessSettingsData.calloutFee === 'number') {
        businessSettingsData.calloutFee = String(businessSettingsData.calloutFee);
      }
      
      const data = insertBusinessSettingsSchema.partial().parse(businessSettingsData);
      const settings = await storage.updateBusinessSettings(req.userId, data);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating business settings:", error);
      res.status(500).json({ error: "Failed to update business settings" });
    }
  });

  const businessLogoUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });

  app.post("/api/business-settings/logo", requireAuth, ownerOnly(), businessLogoUpload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // In a real app, we'd upload to S3/GCS. For now, we'll use a data URL or mock it.
      // Given the environment, we might have object storage setup.
      const logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      const settings = await storage.updateBusinessSettings(req.userId, { logoUrl });
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading business logo:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // ===== PAYMENT SETTINGS ROUTES =====
  
  // Get payment method settings (available methods, fees, bank details)
  app.get("/api/payment-settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getBusinessSettings(req.userId);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      
      // Calculate fees for display
      const cardFeePercent = 1.95;
      const cardFeeFixed = 0.30;
      const becsFee = 0.50; // Flat fee for BECS Direct Debit
      const bankTransferFee = 0; // Free for direct bank transfer
      
      res.json({
        // Bank transfer details
        bankBsb: settings.bankBsb || null,
        bankAccountNumber: settings.bankAccountNumber || null,
        bankAccountName: settings.bankAccountName || null,
        
        // Enabled payment methods
        acceptCardPayments: settings.acceptCardPayments ?? true,
        acceptBankTransfer: settings.acceptBankTransfer ?? true,
        acceptBecsDebit: settings.acceptBecsDebit ?? false,
        acceptPayto: settings.acceptPayto ?? false,
        defaultPaymentMethod: settings.defaultPaymentMethod || 'card',
        
        // Card surcharge settings
        enableCardSurcharge: settings.enableCardSurcharge ?? false,
        cardSurchargePercent: parseFloat(String(settings.cardSurchargePercent || '1.95')),
        cardSurchargeFixedCents: settings.cardSurchargeFixedCents ?? 30,
        surchargeDisclaimer: settings.surchargeDisclaimer || 'A surcharge applies to credit/debit card payments to cover processing fees.',
        
        // Early payment discount
        enableEarlyPaymentDiscount: settings.enableEarlyPaymentDiscount ?? false,
        earlyPaymentDiscountPercent: parseFloat(String(settings.earlyPaymentDiscountPercent || '2.00')),
        earlyPaymentDiscountDays: settings.earlyPaymentDiscountDays ?? 7,
        
        // Fee information for display
        feeInfo: {
          card: { percent: cardFeePercent, fixed: cardFeeFixed, description: 'Card payments (Visa, Mastercard)' },
          becs: { flat: becsFee, description: 'BECS Direct Debit (bank account)' },
          bankTransfer: { flat: bankTransferFee, description: 'Direct bank transfer (BSB/Account)' },
        }
      });
    } catch (error) {
      console.error("Error fetching payment settings:", error);
      res.status(500).json({ error: "Failed to fetch payment settings" });
    }
  });
  
  // Update payment settings
  app.patch("/api/payment-settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const {
        bankBsb,
        bankAccountNumber,
        bankAccountName,
        acceptCardPayments,
        acceptBankTransfer,
        acceptBecsDebit,
        acceptPayto,
        defaultPaymentMethod,
        enableCardSurcharge,
        cardSurchargePercent,
        cardSurchargeFixedCents,
        surchargeDisclaimer,
        enableEarlyPaymentDiscount,
        earlyPaymentDiscountPercent,
        earlyPaymentDiscountDays,
      } = req.body;
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (bankBsb !== undefined) updateData.bankBsb = bankBsb;
      if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber;
      if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName;
      if (acceptCardPayments !== undefined) updateData.acceptCardPayments = acceptCardPayments;
      if (acceptBankTransfer !== undefined) updateData.acceptBankTransfer = acceptBankTransfer;
      if (acceptBecsDebit !== undefined) updateData.acceptBecsDebit = acceptBecsDebit;
      if (acceptPayto !== undefined) updateData.acceptPayto = acceptPayto;
      if (defaultPaymentMethod !== undefined) updateData.defaultPaymentMethod = defaultPaymentMethod;
      if (enableCardSurcharge !== undefined) updateData.enableCardSurcharge = enableCardSurcharge;
      if (cardSurchargePercent !== undefined) updateData.cardSurchargePercent = String(cardSurchargePercent);
      if (cardSurchargeFixedCents !== undefined) updateData.cardSurchargeFixedCents = cardSurchargeFixedCents;
      if (surchargeDisclaimer !== undefined) updateData.surchargeDisclaimer = surchargeDisclaimer;
      if (enableEarlyPaymentDiscount !== undefined) updateData.enableEarlyPaymentDiscount = enableEarlyPaymentDiscount;
      if (earlyPaymentDiscountPercent !== undefined) updateData.earlyPaymentDiscountPercent = String(earlyPaymentDiscountPercent);
      if (earlyPaymentDiscountDays !== undefined) updateData.earlyPaymentDiscountDays = earlyPaymentDiscountDays;
      
      const settings = await storage.updateBusinessSettings(req.userId, updateData);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating payment settings:", error);
      res.status(500).json({ error: "Failed to update payment settings" });
    }
  });

  // ===== SMS BRANDING SETTINGS ROUTES =====
  
  // Get current SMS branding settings
  app.get("/api/settings/sms-branding", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getBusinessSettings(req.userId);
      
      // Mask auth token like "••••••abc1" - only show last 4 chars
      const maskedAuthToken = settings?.twilioAuthToken 
        ? '••••••' + settings.twilioAuthToken.slice(-4) 
        : null;
      
      // Check platform Twilio availability (connector or env vars)
      // Use verified flag to ensure credentials are not placeholders
      const platformTwilioStatus = await checkTwilioAvailability();
      
      // Return SMS branding fields (mask ALL sensitive data)
      const smsBranding = {
        twilioPhoneNumber: settings?.twilioPhoneNumber || null,
        twilioSenderId: settings?.twilioSenderId || null,
        twilioAccountSid: settings?.twilioAccountSid ? '***' + settings.twilioAccountSid.slice(-4) : null,
        twilioAuthToken: maskedAuthToken,
        twilioAuthTokenConfigured: !!settings?.twilioAuthToken,
        // Include platform defaults info (connector or env vars)
        // Only show as configured if verified (not placeholder credentials)
        platformTwilioConfigured: platformTwilioStatus.verified === true,
        platformTwilioPhoneNumber: platformTwilioStatus.hasPhoneNumber ? '(configured)' : null,
      };
      
      res.json(smsBranding);
    } catch (error) {
      console.error("Error fetching SMS branding settings:", error);
      res.status(500).json({ error: "Failed to fetch SMS branding settings" });
    }
  });
  
  // Update SMS branding settings
  app.put("/api/settings/sms-branding", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const { twilioPhoneNumber, twilioSenderId, twilioAccountSid, twilioAuthToken } = req.body;
      
      // Validate sender ID (alphanumeric only, max 11 chars)
      if (twilioSenderId) {
        const senderIdRegex = /^[a-zA-Z0-9]{1,11}$/;
        if (!senderIdRegex.test(twilioSenderId)) {
          return res.status(400).json({ 
            error: "Invalid sender ID. Must be alphanumeric and max 11 characters." 
          });
        }
      }
      
      // Validate phone number format (E.164)
      if (twilioPhoneNumber) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(twilioPhoneNumber)) {
          return res.status(400).json({ 
            error: "Invalid phone number. Must be in E.164 format (e.g., +61412345678)." 
          });
        }
      }
      
      // Get or create business settings
      let settings = await storage.getBusinessSettings(req.userId);
      
      const updateData: any = {};
      if (twilioPhoneNumber !== undefined) updateData.twilioPhoneNumber = twilioPhoneNumber || null;
      if (twilioSenderId !== undefined) updateData.twilioSenderId = twilioSenderId || null;
      
      // Don't update account SID if a masked value is sent back (starts with ***)
      if (twilioAccountSid !== undefined && !twilioAccountSid?.startsWith('***')) {
        updateData.twilioAccountSid = twilioAccountSid || null;
      }
      
      // Don't update auth token if a masked value is sent back (contains •)
      if (twilioAuthToken !== undefined && !twilioAuthToken?.includes('•')) {
        updateData.twilioAuthToken = twilioAuthToken || null;
      }
      
      if (settings) {
        settings = await storage.updateBusinessSettings(req.userId, updateData);
      } else {
        settings = await storage.createBusinessSettings({
          userId: req.userId,
          businessName: 'My Business',
          ...updateData,
        });
      }
      
      // Return masked response - mask auth token like "••••••abc1"
      const maskedAuthToken = settings?.twilioAuthToken 
        ? '••••••' + settings.twilioAuthToken.slice(-4) 
        : null;
      
      res.json({
        twilioPhoneNumber: settings?.twilioPhoneNumber || null,
        twilioSenderId: settings?.twilioSenderId || null,
        twilioAccountSid: settings?.twilioAccountSid ? '***' + settings.twilioAccountSid.slice(-4) : null,
        twilioAuthToken: maskedAuthToken,
        twilioAuthTokenConfigured: !!settings?.twilioAuthToken,
        message: "SMS branding settings updated successfully",
      });
    } catch (error) {
      console.error("Error updating SMS branding settings:", error);
      res.status(500).json({ error: "Failed to update SMS branding settings" });
    }
  });

  // Test Twilio connection with provided credentials
  app.post("/api/settings/sms-branding/test", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = req.body;
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        return res.status(400).json({ 
          error: "Account SID, Auth Token, and Phone Number are all required" 
        });
      }
      
      // Validate phone number format (E.164)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(twilioPhoneNumber)) {
        return res.status(400).json({ 
          error: "Invalid phone number. Must be in E.164 format (e.g., +61412345678)." 
        });
      }
      
      // Try to initialize a Twilio client with the provided credentials
      const twilio = await import('twilio');
      const client = twilio.default(twilioAccountSid, twilioAuthToken);
      
      // Verify the credentials by fetching account info
      const account = await client.api.accounts(twilioAccountSid).fetch();
      
      // Verify the phone number belongs to this account
      const phoneNumbers = await client.incomingPhoneNumbers.list({ phoneNumber: twilioPhoneNumber });
      
      if (phoneNumbers.length === 0) {
        return res.status(400).json({ 
          error: "Phone number not found in your Twilio account. Make sure you've purchased this number." 
        });
      }
      
      res.json({ 
        success: true,
        message: `Connection successful! Account: ${account.friendlyName}`,
        accountName: account.friendlyName,
        phoneNumber: twilioPhoneNumber,
      });
    } catch (error: any) {
      console.error("Twilio connection test failed:", error);
      
      // Handle specific Twilio errors
      if (error.code === 20003) {
        return res.status(401).json({ 
          error: "Invalid credentials. Please check your Account SID and Auth Token." 
        });
      }
      if (error.code === 20404) {
        return res.status(404).json({ 
          error: "Account not found. Please verify your Account SID." 
        });
      }
      
      res.status(500).json({ 
        error: error.message || "Failed to connect to Twilio. Please check your credentials." 
      });
    }
  });

  // Integration Settings Routes
  app.get("/api/integrations/settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getIntegrationSettings(req.userId);
      // Detect if Stripe is configured from environment
      const stripeConfigured = !!(process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY);
      
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          stripeEnabled: stripeConfigured,
          emailEnabled: false,
          autoSendInvoices: false,
          autoGeneratePaymentLinks: false,
          emailTemplate: '',
          paymentTerms: 'Net 30'
        });
      }
      // Override stripeEnabled if keys are configured
      res.json({
        ...settings,
        stripeEnabled: stripeConfigured || settings.stripeEnabled
      });
    } catch (error) {
      console.error("Error fetching integration settings:", error);
      res.status(500).json({ error: "Failed to fetch integration settings" });
    }
  });

  app.post("/api/integrations/settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const data = insertIntegrationSettingsSchema.partial().parse(req.body);
      
      // Try to update existing settings first
      const existingSettings = await storage.getIntegrationSettings(req.userId);
      let settings;
      
      if (existingSettings) {
        settings = await storage.updateIntegrationSettings(req.userId, data);
      } else {
        settings = await storage.createIntegrationSettings({ ...data, userId: req.userId });
      }
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating integration settings:", error);
      res.status(500).json({ error: "Failed to update integration settings" });
    }
  });

  // Integration Test Routes
  app.post("/api/integrations/test-email", requireAuth, async (req: any, res) => {
    try {
      const { sendTestEmail } = await import("./emailService");
      const user = await storage.getUser(req.userId);
      const businessSettings = await storage.getBusinessSettings(req.userId);
      
      if (!user?.email) {
        return res.status(400).json({ error: "No email address found for your account" });
      }
      
      const result = await sendTestEmail(
        user.email, 
        businessSettings?.businessName || 'TradieTrack User'
      );
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.mock 
            ? "Test email logged to console (demo mode)" 
            : `Test email sent to ${user.email}`
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to send test email" });
      }
    } catch (error) {
      console.error("Error testing email:", error);
      res.status(500).json({ error: "Failed to test email connection" });
    }
  });

  // Send demo email to a specified address (for testing/demo purposes)
  app.post("/api/demo/send-email", requireAuth, async (req: any, res) => {
    try {
      const { toEmail, subject, message } = req.body;
      const { sendEmail } = await import("./emailService");
      const user = await storage.getUser(req.userId);
      const businessSettings = await storage.getBusinessSettings(req.userId);
      
      if (!toEmail) {
        return res.status(400).json({ error: "toEmail is required" });
      }

      const businessName = businessSettings?.businessName || 'Demo Tradie Business';
      const brandColor = businessSettings?.brandColor || '#2563eb';
      
      const result = await sendEmail({
        to: toEmail,
        subject: subject || `Demo Email from ${businessName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, ${brandColor} 0%, #1d4ed8 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">${businessName}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">TradieTrack Demo</p>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: ${brandColor}; margin-top: 0;">Demo Email</h2>
              <p>${message || 'This is a demo email sent from the TradieTrack platform, showing how professional business emails look when sent to your clients.'}</p>
              
              <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${brandColor};">
                <h3 style="margin-top: 0;">What TradieTrack Can Do:</h3>
                <ul style="margin-bottom: 0;">
                  <li>Send professional quotes to clients</li>
                  <li>Issue tax-compliant invoices with GST</li>
                  <li>Process payments via Stripe</li>
                  <li>Send automated reminders</li>
                  <li>AI-powered business assistant</li>
                </ul>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              <p>Sent from TradieTrack - The Super App for Australian Tradies</p>
              <p>User: ${user?.email || 'Demo Account'}</p>
            </div>
          </body>
          </html>
        `,
        replyTo: businessSettings?.email || user?.email
      });
      
      if (result.success) {
        console.log(`✅ Demo email sent to ${toEmail} from ${user?.email}`);
        res.json({ 
          success: true, 
          message: result.simulated 
            ? "Demo email logged to console (mock mode)" 
            : `Demo email sent to ${toEmail}`,
          messageId: result.messageId
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to send demo email" });
      }
    } catch (error: any) {
      console.error("Error sending demo email:", error);
      res.status(500).json({ error: error.message || "Failed to send demo email" });
    }
  });

  // Preview welcome email template (for testing/demo purposes)
  app.get("/api/email-preview/welcome", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      const userName = user?.firstName || user?.email?.split('@')[0] || 'Tradie';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to TradieTrack</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to TradieTrack!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">The business management platform built for Australian tradies</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 18px; margin-bottom: 20px;">G'day ${userName}!</p>
            
            <p>Thanks for signing up to TradieTrack. You've just taken the first step towards running a more organised, professional trade business.</p>
            
            <div style="background: #f0f9ff; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 20px 0; color: #1d4ed8; text-align: center;">Quick Start Guide</h3>
              
              <div style="display: flex; margin-bottom: 15px;">
                <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 12px;">1</div>
                <div>
                  <strong style="color: #1d4ed8;">Set up your business profile</strong>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Add your ABN, logo, and business details for professional quotes and invoices</p>
                </div>
              </div>
              
              <div style="display: flex; margin-bottom: 15px;">
                <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 12px;">2</div>
                <div>
                  <strong style="color: #1d4ed8;">Add your first client</strong>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Store customer details and job history in one place</p>
                </div>
              </div>
              
              <div style="display: flex; margin-bottom: 15px;">
                <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 12px;">3</div>
                <div>
                  <strong style="color: #1d4ed8;">Create a quote</strong>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Use our templates to send professional quotes with one click</p>
                </div>
              </div>
              
              <div style="display: flex; margin-bottom: 15px;">
                <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 12px;">4</div>
                <div>
                  <strong style="color: #1d4ed8;">Convert quote to job</strong>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Once accepted, turn it into a trackable job with scheduling</p>
                </div>
              </div>
              
              <div style="display: flex;">
                <div style="background: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 12px;">5</div>
                <div>
                  <strong style="color: #10b981;">Invoice & get paid</strong>
                  <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Send invoices with Stripe payment links - get paid online instantly</p>
                </div>
              </div>
            </div>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Pro tip:</strong> Download our mobile app to manage your jobs on the go. Same account, synced data!
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${getBaseUrl()}" style="background-color: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
                Get Started Now
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Need help? Just reply to this email and we'll get back to you.
            </p>
            
            <p style="margin-top: 25px;">
              Cheers,<br>
              <strong>The TradieTrack Team</strong><br>
              <span style="color: #666; font-size: 14px;">AVWeb Innovation</span>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p style="margin: 0;">TradieTrack - Making Australian tradies more professional</p>
            <p style="margin: 5px 0 0 0;">Questions? Contact us at admin@avwebinnovation.com</p>
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      console.error("Error generating welcome email preview:", error);
      res.status(500).json({ error: "Failed to generate email preview" });
    }
  });

  // Send test welcome email to current user (for testing purposes)
  app.post("/api/email-preview/send-welcome", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const result = await sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.mock 
            ? "Welcome email logged to console (mock mode - no SendGrid configured)" 
            : `Welcome email sent to ${user.email}`,
          mock: result.mock
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to send welcome email" });
      }
    } catch (error: any) {
      console.error("Error sending test welcome email:", error);
      res.status(500).json({ error: error.message || "Failed to send welcome email" });
    }
  });
  
  // Test SMS Route - Disabled for beta
  app.post("/api/integrations/test-sms", requireAuth, async (req: any, res) => {
    res.status(501).json({ 
      error: "SMS notifications are disabled in beta. This feature is coming soon!"
    });
  });

  // SMS Preview Route - Demo mode for mobile app
  app.post("/api/integrations/test-sms-preview", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      const settings = await storage.getBusinessSettings(effectiveUserId);
      
      const businessName = settings?.businessName || 'Your Business';
      const templates = [
        {
          type: 'appointment_reminder',
          title: 'Appointment Reminder',
          message: `Hi [Client Name], reminder: Your appointment with ${businessName} is scheduled for tomorrow at 9:00 AM. Reply YES to confirm.`,
        },
        {
          type: 'job_on_the_way',
          title: 'On The Way',
          message: `Hi [Client Name], ${businessName} is on the way! Expected arrival: 15 minutes.`,
        },
        {
          type: 'job_complete',
          title: 'Job Complete',
          message: `Hi [Client Name], your job is complete! Thank you for choosing ${businessName}. Invoice will be sent shortly.`,
        },
        {
          type: 'payment_received',
          title: 'Payment Received',
          message: `Hi [Client Name], thank you! We received your payment of $[Amount]. Receipt sent to your email. - ${businessName}`,
        },
      ];
      
      res.json({
        success: true,
        demoMode: true,
        message: 'SMS is in demo mode. Preview templates below.',
        templates,
        preview: templates[0],
      });
    } catch (error: any) {
      console.error("Error generating SMS preview:", error);
      res.status(500).json({ error: error.message || "Failed to generate SMS preview" });
    }
  });

  // General SMS send endpoint for Smart Actions logging
  const sendSmsInputSchema = z.object({
    to: z.string().min(1, "Phone number is required"),
    message: z.string().min(1, "Message is required"),
    context: z.object({
      type: z.enum(['invoice', 'quote', 'job', 'general']).optional(),
      entityId: z.string().optional(),
      clientId: z.string().optional(),
    }).optional(),
  });

  app.post("/api/sms/send", requireAuth, async (req: any, res) => {
    try {
      const data = sendSmsInputSchema.parse(req.body);
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      // Log the SMS activity for audit trail
      const activity = {
        userId: effectiveUserId,
        type: 'sms_sent' as const,
        phone: data.to,
        context: data.context,
        timestamp: new Date(),
        sentBy: req.userId,
      };
      console.log('[SMS Activity]', JSON.stringify(activity));
      
      // Create a notification for tracking
      await storage.createNotification({
        userId: effectiveUserId,
        type: 'sms_sent',
        title: 'SMS Sent',
        message: `SMS sent to ${data.to.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`,
        relatedId: data.context?.entityId || null,
        relatedType: data.context?.type || null,
      });
      
      // SMS is disabled for beta - log and return success for logging purposes
      // In future, integrate with Twilio here when SMS is enabled
      res.json({ 
        success: true, 
        logged: true,
        message: 'SMS activity logged. SMS delivery disabled in beta.',
        smsDelivered: false, // Indicates SMS wasn't actually sent
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error in SMS send endpoint:", error);
      res.status(500).json({ error: "Failed to process SMS request" });
    }
  });

  // Notification Routes
  // Define input schema that omits server-managed fields (userId, id, createdAt)
  const createNotificationInputSchema = z.object({
    type: z.string(),
    title: z.string(),
    message: z.string(),
    relatedId: z.string().nullable().optional(),
    relatedType: z.string().nullable().optional(),
    read: z.boolean().optional(),
    dismissed: z.boolean().optional(),
  });

  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const data = createNotificationInputSchema.parse(req.body);
      const notification = await storage.createNotification({
        ...data,
        userId: req.userId
      });
      res.json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id, req.userId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/:id/dismiss", requireAuth, async (req: any, res) => {
    try {
      const notification = await storage.dismissNotification(req.params.id, req.userId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // Mark all notifications as read (batch operation)
  app.post("/api/notifications/mark-all-read", requireAuth, async (req: any, res) => {
    try {
      const count = await storage.markAllNotificationsAsRead(req.userId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Unified Notifications - combines regular notifications, SMS messages, and team chat
  app.get("/api/notifications/unified", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // Get regular notifications
      const regularNotifications = await storage.getNotifications(userId);
      
      // Get SMS conversations with unread messages
      const smsConversations = await storage.getSmsConversationsByBusiness(userId);
      
      // Get team chat messages (for team members, get their business owner's chat)
      const user = await storage.getUser(userId);
      const businessOwnerId = user?.businessOwnerId || userId;
      const teamChatMessages = await storage.getTeamChatMessages(businessOwnerId);
      
      // Build unified notification list
      const unifiedNotifications: any[] = [];
      
      // Add regular notifications
      for (const n of regularNotifications) {
        unifiedNotifications.push({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          relatedId: n.relatedId,
          relatedType: n.relatedType,
          read: n.read,
          dismissed: n.dismissed,
          createdAt: n.createdAt,
          notificationType: 'system'
        });
      }
      
      // Add SMS conversations as notifications (only those with unread inbound messages)
      for (const conv of smsConversations) {
        if ((conv.unreadCount || 0) > 0) {
          // Get the last message for this conversation
          const messages = await storage.getSmsMessages(conv.id);
          const lastUnreadInbound = messages
            .filter(m => m.direction === 'inbound' && !m.readAt)
            .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
          
          if (lastUnreadInbound) {
            unifiedNotifications.push({
              id: `sms-${conv.id}`,
              type: 'sms_received',
              title: conv.clientName || conv.clientPhone || 'Unknown',
              message: lastUnreadInbound.body.length > 100 
                ? lastUnreadInbound.body.substring(0, 100) + '...' 
                : lastUnreadInbound.body,
              relatedId: conv.id,
              relatedType: 'sms_conversation',
              read: false,
              dismissed: false,
              createdAt: lastUnreadInbound.createdAt,
              notificationType: 'sms',
              unreadCount: conv.unreadCount
            });
          }
        }
      }
      
      // Add unread team chat messages
      const unreadTeamChats = teamChatMessages
        .filter(msg => {
          const readBy = (msg.readBy as string[]) || [];
          return !readBy.includes(userId) && msg.userId !== userId;
        })
        .slice(0, 10); // Limit to most recent 10
      
      for (const msg of unreadTeamChats) {
        const sender = await storage.getUser(msg.userId);
        unifiedNotifications.push({
          id: `chat-${msg.id}`,
          type: 'team_chat',
          title: sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email : 'Team Member',
          message: msg.content.length > 100 
            ? msg.content.substring(0, 100) + '...' 
            : msg.content,
          relatedId: msg.id,
          relatedType: 'team_chat',
          read: false,
          dismissed: false,
          createdAt: msg.createdAt,
          notificationType: 'chat'
        });
      }
      
      // Sort by createdAt descending
      unifiedNotifications.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      // Calculate total unread count
      const unreadCount = unifiedNotifications.filter(n => !n.read && !n.dismissed).length;
      
      res.json({
        notifications: unifiedNotifications.slice(0, 50), // Limit to 50 most recent
        unreadCount
      });
    } catch (error) {
      console.error("Error fetching unified notifications:", error);
      res.status(500).json({ error: "Failed to fetch unified notifications" });
    }
  });

  // Mark SMS conversation as read (for notification dropdown)
  app.patch("/api/notifications/sms/:conversationId/read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const businessOwnerId = req.businessOwnerId || userId;
      const { conversationId } = req.params;
      
      // Verify ownership - conversation must belong to this business
      const conversation = await storage.getSmsConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (conversation.businessOwnerId !== businessOwnerId) {
        return res.status(403).json({ error: 'Unauthorized access to this conversation' });
      }
      
      await storage.markSmsMessagesAsRead(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking SMS as read:", error);
      res.status(500).json({ error: "Failed to mark SMS as read" });
    }
  });

  // Mark team chat message as read (for notification dropdown)
  app.patch("/api/notifications/chat/:messageId/read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      const businessOwnerId = user?.businessOwnerId || userId;
      
      // Mark the team chat as read for this user
      await storage.markTeamChatAsRead(businessOwnerId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking chat as read:", error);
      res.status(500).json({ error: "Failed to mark chat as read" });
    }
  });

  // Push Token Routes (Mobile App)
  const pushTokenInputSchema = z.object({
    token: z.string().min(1, "Push token is required"),
    platform: z.enum(['ios', 'android'], { errorMap: () => ({ message: "Platform must be 'ios' or 'android'" }) }),
    deviceId: z.string().optional().nullable()
  });

  app.post("/api/push-tokens/register", requireAuth, async (req: any, res) => {
    try {
      const validated = pushTokenInputSchema.parse(req.body);
      
      const pushToken = await storage.registerPushToken({
        userId: req.userId,
        token: validated.token,
        platform: validated.platform,
        deviceId: validated.deviceId || null
      });
      
      res.json({ success: true, tokenId: pushToken.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error registering push token:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  app.delete("/api/push-tokens/:tokenId", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.deactivatePushToken(req.params.tokenId, req.userId);
      if (!success) {
        return res.status(404).json({ error: "Push token not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating push token:", error);
      res.status(500).json({ error: "Failed to deactivate push token" });
    }
  });

  app.delete("/api/push-tokens", requireAuth, async (req: any, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      const success = await storage.deactivatePushTokenByValue(token, req.userId);
      if (!success) {
        return res.status(404).json({ error: "Push token not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating push token:", error);
      res.status(500).json({ error: "Failed to deactivate push token" });
    }
  });

  app.post("/api/integrations/test-stripe", requireAuth, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      
      if (stripe) {
        const account = await stripe.accounts.retrieve() as any;
        res.json({ 
          success: true, 
          message: "Stripe connection successful", 
          mode: (account.livemode as boolean) ? "live" : "test"
        });
      } else {
        res.json({ 
          success: false, 
          message: "Stripe not connected. Please connect via the Integrations panel.", 
          mode: "disconnected" 
        });
      }
    } catch (error) {
      console.error("Error testing Stripe:", error);
      res.status(500).json({ error: "Failed to test Stripe connection" });
    }
  });

  // API Key Management Routes - Now managed by Replit connector
  app.post("/api/integrations/save-stripe-keys", requireAuth, async (req: any, res) => {
    res.json({ 
      success: true,
      message: "Stripe is now managed through Replit's integration panel. Your keys are automatically configured."
    });
  });

  app.post("/api/integrations/save-sendgrid-key", requireAuth, async (req: any, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: "SendGrid API key is required" });
      }
      
      if (!apiKey.startsWith('SG.')) {
        return res.status(400).json({ error: "Invalid SendGrid API key format (should start with SG.)" });
      }
      
      // Store key securely (in production, this would be encrypted)
      process.env.SENDGRID_API_KEY = apiKey;
      
      console.log('✅ SendGrid API key updated successfully');
      
      res.json({ 
        success: true,
        message: "SendGrid API key saved successfully"
      });
    } catch (error) {
      console.error("Save SendGrid key error:", error);
      res.status(500).json({ error: "Failed to save SendGrid API key" });
    }
  });

  app.get("/api/integrations/secrets-status", requireAuth, async (req: any, res) => {
    try {
      const stripeConnected = isStripeInitialized();
      // getStripePublishableKey is async, await it properly
      const stripePublicKey = await getStripePublishableKey();
      const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
      
      // Detect credential sources for accurate production status
      const hasDirectStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.VITE_STRIPE_PUBLIC_KEY);
      const hasReplitConnector = !!process.env.REPLIT_CONNECTORS_HOSTNAME;
      
      // Determine source of credentials
      const stripeSource = hasDirectStripeKeys ? 'environment' : (hasReplitConnector ? 'replit' : 'none');
      
      // Safely mask the public key if it exists and is a string
      let stripePublicKeyMasked: string | null = null;
      if (stripePublicKey && typeof stripePublicKey === 'string') {
        stripePublicKeyMasked = stripePublicKey.replace(/^(pk_[a-z]+_)(.{4})(.+)(.{4})$/, '$1$2****$4');
      }
      
      // Determine appropriate messages based on source
      const getStripeMessage = () => {
        if (!stripeConnected) return 'Running in demo mode - payments will be simulated';
        if (stripeSource === 'environment') return 'Stripe connected via environment variables';
        return 'Stripe connected via platform integration';
      };
      
      const status = {
        stripeSecretsAvailable: stripeConnected,
        stripeManaged: stripeSource !== 'environment',
        stripeSource,
        stripeStatus: stripeConnected ? 'connected' : 'demo_mode',
        stripeMessage: getStripeMessage(),
        sendgridSecretsAvailable: sendgridConfigured,
        sendgridStatus: sendgridConfigured ? 'connected' : 'demo_mode',
        sendgridMessage: sendgridConfigured
          ? 'SendGrid configured for email delivery'
          : 'Running in demo mode - emails are logged to console',
        // Twilio SMS - check connector availability
        twilioSecretsAvailable: !!process.env.REPLIT_CONNECTORS_HOSTNAME || !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        twilioManaged: !!process.env.REPLIT_CONNECTORS_HOSTNAME,
        twilioSource: process.env.TWILIO_ACCOUNT_SID ? 'environment' : (process.env.REPLIT_CONNECTORS_HOSTNAME ? 'replit' : 'none'),
        twilioStatus: (process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.TWILIO_ACCOUNT_SID) ? 'connected' : 'not_configured',
        twilioMessage: (process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.TWILIO_ACCOUNT_SID) ? 'Twilio SMS connected' : 'SMS not configured',
        stripePublicKeyMasked,
        stripeSecretKeyMasked: stripeConnected 
          ? (stripeSource === 'environment' ? 'Configured' : 'Platform managed') 
          : null,
        sendgridKeyMasked: sendgridConfigured ? 'Configured' : null,
        twilioKeyMasked: null,
        // Production readiness check (SMS disabled for beta)
        productionReady: stripeConnected && sendgridConfigured,
        standaloneReady: hasDirectStripeKeys && sendgridConfigured
      };
      res.json(status);
    } catch (error) {
      console.error("Error checking secrets status:", error);
      res.status(500).json({ error: "Failed to check secrets status" });
    }
  });

  // Health check endpoint - verifies integrations are actually working
  app.get("/api/integrations/health", requireAuth, async (req: any, res) => {
    try {
      const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
      
      // Check if platform Stripe is configured (for test mode indicator)
      const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY || process.env.TESTING_VITE_STRIPE_PUBLIC_KEY || '';
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.TESTING_STRIPE_SECRET_KEY || '';
      const isStripeTestMode = stripePublicKey.startsWith('pk_test_') || stripeSecretKey.startsWith('sk_test_');
      
      // Check user's Stripe Connect status
      const businessSettings = await storage.getBusinessSettings(req.userId);
      const stripeConnectAccountId = businessSettings?.stripeConnectAccountId;
      
      let stripeConnectStatus = {
        connected: false,
        accountId: null as string | null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        businessName: null as string | null,
        email: null as string | null,
      };
      
      // If user has a Stripe Connect account, verify its status
      if (stripeConnectAccountId) {
        try {
          const stripe = await getUncachableStripeClient();
          if (stripe) {
            const account = await stripe.accounts.retrieve(stripeConnectAccountId);
            stripeConnectStatus = {
              connected: true,
              accountId: stripeConnectAccountId,
              chargesEnabled: account.charges_enabled || false,
              payoutsEnabled: account.payouts_enabled || false,
              detailsSubmitted: account.details_submitted || false,
              businessName: account.business_profile?.name || null,
              email: account.email || null,
            };
          }
        } catch (e: any) {
          console.error('Error checking Stripe Connect status:', e.message);
        }
      }
      
      // Verify SendGrid by checking API key format
      let emailVerified = false;
      let emailError: string | null = null;
      if (sendgridConfigured) {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (apiKey && apiKey.startsWith('SG.') && apiKey.length > 20) {
          emailVerified = true;
        } else {
          emailError = 'Invalid SendGrid API key format';
        }
      }
      
      // Determine payment status based on Stripe Connect
      let paymentStatus: 'ready' | 'test' | 'error' | 'not_connected' = 'not_connected';
      let paymentDescription = 'Connect your Stripe account to accept payments';
      
      if (stripeConnectStatus.connected) {
        if (stripeConnectStatus.chargesEnabled && stripeConnectStatus.payoutsEnabled) {
          paymentStatus = isStripeTestMode ? 'test' : 'ready';
          paymentDescription = isStripeTestMode 
            ? 'TEST MODE - Connected but using test credentials'
            : 'Ready to accept payments directly to your bank';
        } else {
          paymentStatus = 'error';
          paymentDescription = 'Stripe account needs additional verification';
        }
      }
      
      // All ready only if Stripe Connect is fully set up AND email is working
      const allReady = stripeConnectStatus.chargesEnabled && 
                       stripeConnectStatus.payoutsEnabled && 
                       emailVerified && 
                       !isStripeTestMode;
      
      const servicesReady = (stripeConnectStatus.connected && stripeConnectStatus.chargesEnabled) || emailVerified;
      
      // Check Twilio SMS status via connector or env vars
      // Only treat as connected if credentials are verified (not placeholders)
      const twilioAvail = await checkTwilioAvailability();
      const twilioConfigured = twilioAvail.verified === true;
      
      const services = {
        payments: {
          name: 'Payment Processing',
          status: paymentStatus,
          provider: 'Stripe Connect',
          managed: false,
          verified: stripeConnectStatus.chargesEnabled && stripeConnectStatus.payoutsEnabled,
          testMode: isStripeTestMode,
          hasLiveKeys: !isStripeTestMode,
          error: null,
          description: paymentDescription
        },
        email: {
          name: 'Email Delivery',
          status: emailVerified ? 'ready' : 'demo',
          provider: 'Gmail/SendGrid',
          managed: true,
          verified: emailVerified,
          error: emailError,
          description: emailVerified 
            ? 'Quotes and invoices delivered via email' 
            : 'Uses Gmail link to compose emails'
        },
        sendgrid: {
          name: 'Email Automation',
          status: (emailVerified ? 'ready' : 'not_connected') as 'ready' | 'not_connected',
          provider: 'SendGrid',
          managed: true,
          verified: emailVerified,
          error: emailError,
          description: emailVerified 
            ? 'Automatic email sending enabled' 
            : 'Connect to send emails automatically'
        },
        twilio: {
          name: 'SMS Notifications',
          status: (twilioConfigured ? 'ready' : 'not_connected') as 'ready' | 'not_connected',
          provider: 'Twilio',
          managed: true,
          verified: twilioConfigured,
          error: null,
          description: twilioConfigured 
            ? 'SMS notifications enabled' 
            : 'Connect to send SMS reminders'
        }
      };
      
      res.json({
        allReady,
        servicesReady,
        message: allReady 
          ? 'All integrations ready - you can accept payments!' 
          : (stripeConnectStatus.connected ? 'Complete Stripe setup to start accepting payments' : 'Connect Stripe to accept payments'),
        services,
        stripeConnect: stripeConnectStatus,
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ error: "Failed to check service health" });
    }
  });

  // Xero Integration Routes
  
  // In-memory store for mobile OAuth states (in production, use Redis or database)
  const mobileOAuthStates = new Map<string, { userId: string; expiresAt: number }>();
  
  // Clean up expired states every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [state, data] of mobileOAuthStates.entries()) {
      if (data.expiresAt < now) {
        mobileOAuthStates.delete(state);
      }
    }
  }, 5 * 60 * 1000);

  // Xero connect for mobile app - returns auth URL for in-app browser OAuth
  app.post("/api/integrations/xero/mobile-connect", requireAuth, async (req: any, res) => {
    try {
      if (!xeroService.isXeroConfigured()) {
        return res.status(400).json({ 
          error: "Xero integration not configured. Please add XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables." 
        });
      }
      
      // Generate state with mobile flag and store it in memory keyed by state
      const state = `mobile_${req.userId}_${Date.now()}_${randomBytes(8).toString('hex')}`;
      
      // Store state in memory with 10 minute expiry
      mobileOAuthStates.set(state, {
        userId: req.userId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      
      const authUrl = await xeroService.getAuthUrl(state);
      res.json({ authUrl, state });
    } catch (error: any) {
      console.error("Error getting Xero mobile auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate Xero auth URL" });
    }
  });

  app.post("/api/integrations/xero/connect", requireAuth, async (req: any, res) => {
    try {
      if (!xeroService.isXeroConfigured()) {
        return res.status(400).json({ 
          error: "Xero integration not configured. Please add XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables." 
        });
      }
      const state = randomBytes(32).toString('hex');
      req.session.xeroOAuthState = state;
      const authUrl = await xeroService.getAuthUrl(state);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error getting Xero auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate Xero auth URL" });
    }
  });

  // Xero callback - supports both web (session-based) and mobile (state-based) auth
  app.get("/api/integrations/xero/callback", async (req: any, res) => {
    try {
      const stateFromQuery = req.query.state as string;
      const isMobile = stateFromQuery?.startsWith('mobile_');
      
      let isValidState = false;
      let userId: string | null = null;
      
      if (isMobile) {
        // Check mobile OAuth state store - no session required
        const mobileState = mobileOAuthStates.get(stateFromQuery);
        if (mobileState && mobileState.expiresAt > Date.now()) {
          isValidState = true;
          userId = mobileState.userId;
          mobileOAuthStates.delete(stateFromQuery); // Clean up after use
        }
      } else {
        // Check session for web OAuth - requires auth
        if (!req.session?.passport?.user && !req.userId) {
          return res.redirect('/integrations?xero=error&message=' + encodeURIComponent('Please log in first.'));
        }
        userId = req.userId || req.session?.passport?.user;
        const storedState = req.session.xeroOAuthState;
        delete req.session.xeroOAuthState;
        isValidState = stateFromQuery && storedState && stateFromQuery === storedState;
      }
      
      if (!isValidState || !userId) {
        console.error("OAuth state mismatch - potential CSRF attack");
        if (isMobile) {
          return res.redirect('tradietrack://xero-callback?success=false&error=' + encodeURIComponent('Invalid OAuth state. Please try again.'));
        }
        return res.redirect('/integrations?xero=error&message=' + encodeURIComponent('Invalid OAuth state. Please try again.'));
      }
      
      // Construct the callback URL using centralized URL helper
      const baseUrl = getProductionBaseUrl(req);
      const fullUrl = `${baseUrl}${req.originalUrl}`;
      console.log('[Xero] Callback full URL:', fullUrl);
      const connection = await xeroService.handleCallback(fullUrl, userId);
      
      // Redirect to mobile deep link if request originated from mobile
      if (isMobile) {
        return res.redirect('tradietrack://xero-callback?success=true');
      }
      res.redirect('/integrations?xero=connected');
    } catch (error: any) {
      console.error("Error handling Xero callback:", error);
      const isMobile = (req.query.state as string)?.startsWith('mobile_');
      if (isMobile) {
        return res.redirect('tradietrack://xero-callback?success=false&error=' + encodeURIComponent(error.message || 'Connection failed'));
      }
      res.redirect('/integrations?xero=error&message=' + encodeURIComponent(error.message || 'Connection failed'));
    }
  });

  app.post("/api/integrations/xero/disconnect", requireAuth, async (req: any, res) => {
    try {
      const success = await xeroService.disconnect(req.userId);
      res.json({ success });
    } catch (error: any) {
      console.error("Error disconnecting Xero:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect Xero" });
    }
  });

  app.get("/api/integrations/xero/status", requireAuth, async (req: any, res) => {
    try {
      const configured = xeroService.isXeroConfigured();
      if (!configured) {
        return res.json({ 
          configured: false,
          connected: false,
          message: "Xero integration not configured" 
        });
      }
      const status = await xeroService.getConnectionStatus(req.userId);
      res.json({ configured: true, ...status });
    } catch (error: any) {
      console.error("Error getting Xero status:", error);
      res.status(500).json({ error: error.message || "Failed to get Xero status" });
    }
  });

  // Get available Xero tenants (organizations) for the connected user
  app.get("/api/integrations/xero/tenants", requireAuth, async (req: any, res) => {
    try {
      const tenants = await xeroService.getTenants(req.userId);
      res.json({ tenants });
    } catch (error: any) {
      console.error("Error getting Xero tenants:", error);
      res.status(500).json({ error: error.message || "Failed to get Xero tenants" });
    }
  });

  // Switch to a different Xero tenant (organization)
  app.post("/api/integrations/xero/switch-tenant", requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const result = await xeroService.switchTenant(req.userId, tenantId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error switching Xero tenant:", error);
      res.status(500).json({ error: error.message || "Failed to switch Xero tenant" });
    }
  });

  app.post("/api/integrations/xero/sync", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.body;
      let result;
      
      if (type === 'contacts') {
        result = await xeroService.syncContactsFromXero(req.userId);
      } else if (type === 'invoices') {
        result = await xeroService.syncInvoicesToXero(req.userId);
      } else {
        const contactsResult = await xeroService.syncContactsFromXero(req.userId);
        const invoicesResult = await xeroService.syncInvoicesToXero(req.userId);
        result = {
          contacts: contactsResult,
          invoices: invoicesResult,
        };
      }
      
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Error syncing with Xero:", error);
      res.status(500).json({ error: error.message || "Failed to sync with Xero" });
    }
  });

  app.post("/api/integrations/xero/push-invoice/:invoiceId", requireAuth, async (req: any, res) => {
    try {
      const { invoiceId } = req.params;
      const result = await xeroService.syncSingleInvoiceToXero(req.userId, invoiceId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          xeroInvoiceId: result.xeroInvoiceId,
          message: result.xeroInvoiceId ? "Invoice pushed to Xero successfully" : "No Xero connection found"
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error || "Failed to push invoice to Xero" 
        });
      }
    } catch (error: any) {
      console.error("Error pushing invoice to Xero:", error);
      res.status(500).json({ error: error.message || "Failed to push invoice to Xero" });
    }
  });

  // ============================================================================
  // ENHANCED XERO INTEGRATION ROUTES - Matching ServiceM8/Tradify capabilities
  // ============================================================================

  // Push a quote to Xero as draft invoice
  app.post("/api/integrations/xero/push-quote/:quoteId", requireAuth, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const result = await xeroService.syncQuoteToXero(req.userId, quoteId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          xeroInvoiceId: result.xeroInvoiceId,
          message: result.xeroInvoiceId ? "Quote pushed to Xero as draft invoice" : "No Xero connection"
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error pushing quote to Xero:", error);
      res.status(500).json({ error: error.message || "Failed to push quote to Xero" });
    }
  });

  // Push a client to Xero (two-way sync)
  app.post("/api/integrations/xero/push-client/:clientId", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const result = await xeroService.pushClientToXero(req.userId, clientId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          xeroContactId: result.xeroContactId,
          message: result.xeroContactId ? "Client pushed to Xero" : "No Xero connection"
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error pushing client to Xero:", error);
      res.status(500).json({ error: error.message || "Failed to push client to Xero" });
    }
  });

  // Bulk sync all clients to Xero
  app.post("/api/integrations/xero/sync-all-clients", requireAuth, async (req: any, res) => {
    try {
      const result = await xeroService.syncAllClientsToXero(req.userId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing clients to Xero:", error);
      res.status(500).json({ error: error.message || "Failed to sync clients to Xero" });
    }
  });

  // Bulk sync all quotes to Xero
  app.post("/api/integrations/xero/sync-all-quotes", requireAuth, async (req: any, res) => {
    try {
      const result = await xeroService.syncAllQuotesToXero(req.userId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing quotes to Xero:", error);
      res.status(500).json({ error: error.message || "Failed to sync quotes to Xero" });
    }
  });

  // Get chart of accounts
  app.get("/api/integrations/xero/accounts", requireAuth, async (req: any, res) => {
    try {
      const accounts = await xeroService.getChartOfAccounts(req.userId);
      res.json({ accounts });
    } catch (error: any) {
      console.error("Error fetching Xero accounts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Xero accounts" });
    }
  });

  // Get bank accounts for payment mapping
  app.get("/api/integrations/xero/bank-accounts", requireAuth, async (req: any, res) => {
    try {
      const bankAccounts = await xeroService.getBankAccounts(req.userId);
      res.json({ bankAccounts });
    } catch (error: any) {
      console.error("Error fetching Xero bank accounts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Xero bank accounts" });
    }
  });

  // Get tax rates (for GST handling)
  app.get("/api/integrations/xero/tax-rates", requireAuth, async (req: any, res) => {
    try {
      const taxRates = await xeroService.getTaxRates(req.userId);
      res.json({ taxRates });
    } catch (error: any) {
      console.error("Error fetching Xero tax rates:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Xero tax rates" });
    }
  });

  // Get sync summary for dashboard
  app.get("/api/integrations/xero/sync-summary", requireAuth, async (req: any, res) => {
    try {
      const summary = await xeroService.getSyncSummary(req.userId);
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching Xero sync summary:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Xero sync summary" });
    }
  });

  // Seed mock Xero jobs for testing (development only)
  app.post("/api/integrations/xero/seed-mock-jobs", requireAuth, async (req: any, res) => {
    // Block this endpoint in production to prevent data pollution
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    
    try {
      const userId = req.userId!;
      
      // Get existing clients or create mock ones
      let clients = await storage.getClients(userId);
      
      // Create mock Xero clients if needed
      if (clients.length < 2) {
        const mockClients = [
          { userId, name: "Xero Import - Smith Renovations", email: "smith@xerotest.com", phone: "0412 345 678", address: "42 Harbour St, Sydney NSW 2000" },
          { userId, name: "Xero Import - Jones Construction", email: "jones@xerotest.com", phone: "0423 456 789", address: "15 Market St, Melbourne VIC 3000" },
        ];
        for (const clientData of mockClients) {
          await storage.createClient(clientData);
        }
        clients = await storage.getClients(userId);
      }
      
      // Generate unique Xero IDs
      const xeroJobId1 = `xero-proj-${Date.now()}-001`;
      const xeroJobId2 = `xero-proj-${Date.now()}-002`;
      const xeroJobId3 = `xero-proj-${Date.now()}-003`;
      const xeroContactId1 = `xero-contact-${Date.now()}-001`;
      const xeroContactId2 = `xero-contact-${Date.now()}-002`;
      
      // Create mock Xero jobs with realistic Australian tradie data
      const mockXeroJobs = [
        {
          userId,
          clientId: clients[0]?.id || clients[clients.length - 1].id,
          title: "Kitchen Renovation - Full Refit",
          description: "Complete kitchen renovation including new cabinetry, benchtops, splashback tiles, and plumbing. Imported from Xero Projects.",
          address: "42 Harbour St, Sydney NSW 2000",
          status: "in_progress" as const,
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          scheduledTime: "08:00",
          estimatedDuration: 480, // 8 hours
          notes: "Xero Notes: Client requested white marble benchtops. Materials ordered via Xero Purchase Orders. Contact: Jane Smith 0412 345 678",
          isXeroImport: true,
          xeroJobId: xeroJobId1,
          xeroContactId: xeroContactId1,
          xeroSyncedAt: new Date(),
        },
        {
          userId,
          clientId: clients[Math.min(1, clients.length - 1)]?.id || clients[0].id,
          title: "Bathroom Waterproofing & Tiling",
          description: "Complete bathroom waterproofing with membrane installation, floor and wall tiling. Synced from Xero with quote and invoice attached.",
          address: "15 Market St, Melbourne VIC 3000",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          scheduledTime: "07:30",
          estimatedDuration: 600, // 10 hours
          notes: "Xero Notes: Large format tiles 600x600mm. Waterproofing warranty 10 years. Invoice partially paid via Xero Payments.",
          isXeroImport: true,
          xeroJobId: xeroJobId2,
          xeroContactId: xeroContactId2,
          xeroSyncedAt: new Date(),
        },
        {
          userId,
          clientId: clients[0]?.id || clients[clients.length - 1].id,
          title: "Emergency Plumbing Repair",
          description: "Burst pipe repair and water damage assessment. Emergency callout imported from Xero with completed invoice.",
          address: "88 Collins St, Melbourne VIC 3000",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          scheduledTime: "06:00",
          estimatedDuration: 180, // 3 hours
          notes: "Xero Notes: Emergency callout - burst copper pipe under sink. Replaced 2m of pipe and fittings. Invoice #INV-0045 paid in full via Xero.",
          isXeroImport: true,
          xeroJobId: xeroJobId3,
          xeroContactId: xeroContactId1,
          xeroSyncedAt: new Date(),
        },
      ];

      const createdJobs = [];
      for (const jobData of mockXeroJobs) {
        const job = await storage.createJob(jobData);
        createdJobs.push(job);
        
        // Create associated quote for scheduled job
        if (job.status === 'scheduled' || job.status === 'in_progress') {
          const quoteNumber = `XQ-${Date.now().toString().slice(-6)}`;
          const quote = await storage.createQuote({
            userId,
            clientId: job.clientId,
            jobId: job.id,
            number: quoteNumber,
            title: `Quote for ${job.title}`,
            description: `Imported from Xero - ${job.description}`,
            subtotal: "4500.00",
            gst: "450.00",
            total: "4950.00",
            status: "accepted",
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          
          // Add quote line items
          await storage.createQuoteLineItem({
            quoteId: quote.id,
            description: "Labour - skilled tradesperson",
            quantity: "8",
            unitPrice: "85.00",
            total: "680.00",
            sortOrder: 0,
          });
          await storage.createQuoteLineItem({
            quoteId: quote.id,
            description: "Materials and supplies",
            quantity: "1",
            unitPrice: "2500.00",
            total: "2500.00",
            sortOrder: 1,
          });
          await storage.createQuoteLineItem({
            quoteId: quote.id,
            description: "Equipment hire",
            quantity: "1",
            unitPrice: "320.00",
            total: "320.00",
            sortOrder: 2,
          });
        }
        
        // Create associated invoice for done job
        if (job.status === 'done') {
          const invoiceNumber = `XI-${Date.now().toString().slice(-6)}`;
          const invoice = await storage.createInvoice({
            userId,
            clientId: job.clientId,
            jobId: job.id,
            invoiceNumber,
            title: `Invoice for ${job.title}`,
            description: `Imported from Xero - ${job.description}`,
            subtotal: "850.00",
            gst: "85.00",
            total: "935.00",
            status: "paid",
            issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            xeroInvoiceId: `xero-inv-${Date.now()}`,
            xeroSyncedAt: new Date(),
          });
          
          // Add invoice line items
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            description: "Emergency callout fee",
            quantity: "1",
            unitPrice: "150.00",
            total: "150.00",
            sortOrder: 0,
          });
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            description: "Labour - emergency repair (3 hrs)",
            quantity: "3",
            unitPrice: "120.00",
            total: "360.00",
            sortOrder: 1,
          });
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            description: "Copper pipe and fittings",
            quantity: "1",
            unitPrice: "340.00",
            total: "340.00",
            sortOrder: 2,
          });
        }
      }

      res.json({ 
        success: true, 
        message: `Created ${createdJobs.length} mock Xero jobs with associated quotes and invoices`,
        jobs: createdJobs.map(j => ({ id: j.id, title: j.title, xeroJobId: j.xeroJobId }))
      });
    } catch (error: any) {
      console.error("Error seeding mock Xero jobs:", error);
      res.status(500).json({ error: error.message || "Failed to seed mock Xero jobs" });
    }
  });

  // MYOB Integration Routes
  app.post("/api/integrations/myob/connect", requireAuth, async (req: any, res) => {
    try {
      if (!myobService.isMyobConfigured()) {
        return res.status(400).json({ 
          error: "MYOB integration not configured. Please add MYOB_CLIENT_ID and MYOB_CLIENT_SECRET environment variables." 
        });
      }
      const state = randomBytes(32).toString('hex');
      req.session.myobOAuthState = state;
      const authUrl = myobService.getAuthUrl(state);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error getting MYOB auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate MYOB auth URL" });
    }
  });

  app.get("/api/integrations/myob/callback", requireAuth, async (req: any, res) => {
    try {
      const stateFromQuery = req.query.state as string;
      const storedState = req.session.myobOAuthState;
      const code = req.query.code as string;
      const businessId = req.query.companyFileId as string || req.query.businessId as string;
      
      delete req.session.myobOAuthState;
      
      if (!stateFromQuery || !storedState || stateFromQuery !== storedState) {
        console.error("OAuth state mismatch - potential CSRF attack");
        return res.redirect('/integrations?myob=error&message=' + encodeURIComponent('Invalid OAuth state. Please try again.'));
      }
      
      if (!code) {
        return res.redirect('/integrations?myob=error&message=' + encodeURIComponent('Missing authorization code.'));
      }

      if (!businessId) {
        return res.redirect('/integrations?myob=error&message=' + encodeURIComponent('Missing Company File ID. Please try again.'));
      }
      
      await myobService.handleCallback(code, businessId, req.userId);
      res.redirect('/integrations?myob=connected');
    } catch (error: any) {
      console.error("Error handling MYOB callback:", error);
      res.redirect('/integrations?myob=error&message=' + encodeURIComponent(error.message || 'Connection failed'));
    }
  });

  app.post("/api/integrations/myob/disconnect", requireAuth, async (req: any, res) => {
    try {
      const success = await myobService.disconnect(req.userId);
      res.json({ success });
    } catch (error: any) {
      console.error("Error disconnecting MYOB:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect MYOB" });
    }
  });

  app.get("/api/integrations/myob/status", requireAuth, async (req: any, res) => {
    try {
      const configured = myobService.isMyobConfigured();
      if (!configured) {
        return res.json({ 
          configured: false,
          connected: false,
          message: "MYOB integration not configured" 
        });
      }
      const status = await myobService.getConnectionStatus(req.userId);
      res.json({ configured: true, ...status });
    } catch (error: any) {
      console.error("Error getting MYOB status:", error);
      res.status(500).json({ error: error.message || "Failed to get MYOB status" });
    }
  });

  app.post("/api/integrations/myob/sync", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.body;
      let result;
      
      if (type === 'contacts') {
        result = await myobService.syncContactsFromMyob(req.userId);
      } else if (type === 'invoices') {
        result = await myobService.syncInvoicesToMyob(req.userId);
      } else {
        const contactsResult = await myobService.syncContactsFromMyob(req.userId);
        const invoicesResult = await myobService.syncInvoicesToMyob(req.userId);
        result = {
          contacts: contactsResult,
          invoices: invoicesResult,
        };
      }
      
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Error syncing with MYOB:", error);
      res.status(500).json({ error: error.message || "Failed to sync with MYOB" });
    }
  });

  app.post("/api/integrations/myob/credentials", requireAuth, async (req: any, res) => {
    try {
      const { cfUsername, cfPassword } = req.body;
      
      if (!cfUsername || !cfPassword) {
        return res.status(400).json({ error: "Company file username and password are required" });
      }
      
      const result = await myobService.setCompanyFileCredentials(req.userId, cfUsername, cfPassword);
      res.json(result);
    } catch (error: any) {
      console.error("Error setting MYOB credentials:", error);
      res.status(500).json({ error: error.message || "Failed to set MYOB credentials" });
    }
  });

  // Google Calendar Integration Routes (per-user OAuth)
  app.get("/api/integrations/google-calendar/status", requireAuth, async (req: any, res) => {
    try {
      // Prevent caching to ensure fresh status on every request
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { isGoogleCalendarConnected, getCalendarInfo, isGoogleCalendarConfigured } = await import('./googleCalendarClient');
      
      const configured = isGoogleCalendarConfigured();
      if (!configured) {
        return res.json({ 
          configured: false, 
          connected: false,
          message: "Google Calendar integration not configured. Please set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET."
        });
      }
      
      const userContext = await getUserContext(req.userId);
      const calendarInfo = await getCalendarInfo(userContext.effectiveUserId);
      
      res.json({ 
        configured: true, 
        connected: calendarInfo?.connected || false,
        email: calendarInfo?.email
      });
    } catch (error: any) {
      console.error("Error getting Google Calendar status:", error);
      res.json({ 
        configured: false, 
        connected: false,
        message: error.message || "Google Calendar connection not available"
      });
    }
  });

  // Google Calendar OAuth - Start connection flow (supports both web and mobile)
  app.post("/api/integrations/google-calendar/connect", requireAuth, async (req: any, res) => {
    try {
      const { getAuthorizationUrl, isGoogleCalendarConfigured } = await import('./googleCalendarClient');
      
      if (!isGoogleCalendarConfigured()) {
        return res.status(400).json({ error: "Google Calendar integration not configured" });
      }
      
      const userContext = await getUserContext(req.userId);
      // Safely read source from body (web may not send a body)
      const source = req.body?.source;
      
      let state: string;
      if (source === 'mobile') {
        // For mobile, generate secure state with random component and store in memory
        state = `mobile_${userContext.effectiveUserId}_${Date.now()}_${randomBytes(8).toString('hex')}`;
        mobileOAuthStates.set(state, {
          userId: userContext.effectiveUserId,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minute expiry
        });
      } else {
        // For web, use userId as state (session-based validation)
        state = userContext.effectiveUserId;
      }
      
      const authUrl = getAuthorizationUrl(state);
      
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error starting Google Calendar connection:", error);
      res.status(500).json({ error: error.message || "Failed to start Google Calendar connection" });
    }
  });

  // Google Calendar OAuth callback (supports both web and mobile)
  app.get("/api/integrations/google-calendar/callback", async (req: any, res) => {
    try {
      const { handleOAuthCallback } = await import('./googleCalendarClient');
      const { code, state } = req.query;
      
      if (!code || !state) {
        const isMobile = (state as string)?.startsWith('mobile_');
        if (isMobile) {
          return res.redirect('tradietrack://google-calendar-callback?success=false&error=' + encodeURIComponent('Missing parameters'));
        }
        return res.redirect('/integrations?error=missing_params');
      }
      
      const stateStr = state as string;
      const isMobile = stateStr.startsWith('mobile_');
      
      let userId: string;
      if (isMobile) {
        // Validate mobile state from memory store
        const mobileState = mobileOAuthStates.get(stateStr);
        if (!mobileState || mobileState.expiresAt < Date.now()) {
          mobileOAuthStates.delete(stateStr);
          return res.redirect('tradietrack://google-calendar-callback?success=false&error=' + encodeURIComponent('Invalid or expired OAuth state. Please try again.'));
        }
        userId = mobileState.userId;
        mobileOAuthStates.delete(stateStr); // Clean up after use
      } else {
        // For web, state is the userId directly
        userId = stateStr;
      }
      
      const result = await handleOAuthCallback(code as string, userId);
      
      if (result.success) {
        if (isMobile) {
          return res.redirect('tradietrack://google-calendar-callback?success=true');
        }
        res.redirect('/integrations?success=google_calendar_connected');
      } else {
        const errorMsg = encodeURIComponent(result.error || 'connection_failed');
        if (isMobile) {
          return res.redirect(`tradietrack://google-calendar-callback?success=false&error=${errorMsg}`);
        }
        res.redirect(`/integrations?error=${errorMsg}`);
      }
    } catch (error: any) {
      console.error("Error handling Google Calendar callback:", error);
      const isMobile = (req.query.state as string)?.startsWith('mobile_');
      const errorMsg = encodeURIComponent(error.message || 'callback_failed');
      if (isMobile) {
        return res.redirect(`tradietrack://google-calendar-callback?success=false&error=${errorMsg}`);
      }
      res.redirect(`/integrations?error=${errorMsg}`);
    }
  });

  // Google Calendar disconnect
  app.post("/api/integrations/google-calendar/disconnect", requireAuth, async (req: any, res) => {
    try {
      const { disconnectCalendar } = await import('./googleCalendarClient');
      
      const userContext = await getUserContext(req.userId);
      await disconnectCalendar(userContext.effectiveUserId);
      
      res.json({ success: true, message: "Google Calendar disconnected successfully" });
    } catch (error: any) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect Google Calendar" });
    }
  });

  app.post("/api/integrations/google-calendar/sync-job", requireAuth, async (req: any, res) => {
    try {
      const { syncJobToCalendar, isGoogleCalendarConnected } = await import('./googleCalendarClient');
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "Job ID is required" });
      }
      
      const userContext = await getUserContext(req.userId);
      const connected = await isGoogleCalendarConnected(userContext.effectiveUserId);
      if (!connected) {
        return res.status(400).json({ error: "Google Calendar not connected. Please connect your Google Calendar in Settings." });
      }
      
      // Get job details
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!job.scheduledAt) {
        return res.status(400).json({ error: "Job is not scheduled" });
      }
      
      // Get client details if available
      let clientName: string | undefined;
      let clientPhone: string | undefined;
      let clientEmail: string | undefined;
      if (job.clientId) {
        const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
        clientName = client?.name;
        clientPhone = client?.phone || undefined;
        clientEmail = client?.email || undefined;
      }
      
      const result = await syncJobToCalendar(userContext.effectiveUserId, {
        id: job.id,
        title: job.title,
        description: job.description,
        notes: job.notes,
        address: job.address,
        scheduledAt: new Date(job.scheduledAt),
        estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
        clientName,
        clientPhone,
        clientEmail,
        status: job.status,
        calendarEventId: job.calendarEventId
      });
      
      // Store calendar event ID on the job
      await storage.updateJob(job.id, userContext.effectiveUserId, {
        calendarEventId: result.eventId
      });
      
      res.json({ 
        success: true, 
        eventId: result.eventId,
        eventLink: result.eventLink
      });
    } catch (error: any) {
      console.error("Error syncing job to Google Calendar:", error);
      res.status(500).json({ error: error.message || "Failed to sync job to calendar" });
    }
  });

  app.get("/api/integrations/google-calendar/events", requireAuth, async (req: any, res) => {
    try {
      const { getUpcomingEvents, isGoogleCalendarConnected } = await import('./googleCalendarClient');
      
      const userContext = await getUserContext(req.userId);
      const connected = await isGoogleCalendarConnected(userContext.effectiveUserId);
      if (!connected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const events = await getUpcomingEvents(userContext.effectiveUserId, limit);
      
      res.json({ 
        events: events.map(event => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          htmlLink: event.htmlLink
        }))
      });
    } catch (error: any) {
      console.error("Error listing Google Calendar events:", error);
      res.status(500).json({ error: error.message || "Failed to list calendar events" });
    }
  });

  // Sync all scheduled jobs to Google Calendar
  app.post("/api/integrations/google-calendar/sync-all-jobs", requireAuth, async (req: any, res) => {
    try {
      const { syncJobToCalendar, isGoogleCalendarConnected } = await import('./googleCalendarClient');
      
      const userContext = await getUserContext(req.userId);
      const connected = await isGoogleCalendarConnected(userContext.effectiveUserId);
      if (!connected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }
      
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      const clientsMap = new Map(clients.map(c => [c.id, c]));
      
      // Filter to jobs with scheduled dates
      const scheduledJobs = jobs.filter(job => job.scheduledAt && job.status !== 'cancelled');
      
      const results = {
        synced: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      for (const job of scheduledJobs) {
        try {
          const client = job.clientId ? clientsMap.get(job.clientId) : null;
          
          const result = await syncJobToCalendar(userContext.effectiveUserId, {
            id: job.id,
            title: job.title,
            description: job.description,
            notes: job.notes,
            address: job.address,
            scheduledAt: new Date(job.scheduledAt!),
            estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
            clientName: client?.name,
            clientPhone: client?.phone || undefined,
            clientEmail: client?.email || undefined,
            status: job.status,
            calendarEventId: job.calendarEventId
          });
          
          await storage.updateJob(job.id, userContext.effectiveUserId, {
            calendarEventId: result.eventId
          });
          
          results.synced++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Job ${job.title}: ${error.message}`);
        }
      }
      
      res.json({ 
        success: true, 
        ...results,
        message: `Synced ${results.synced} jobs to Google Calendar`
      });
    } catch (error: any) {
      console.error("Error syncing all jobs to Google Calendar:", error);
      res.status(500).json({ error: error.message || "Failed to sync jobs to calendar" });
    }
  });

  // ========== Outlook/Microsoft 365 Email Integration ==========
  
  // Outlook OAuth - Start connection flow
  app.post("/api/integrations/outlook/connect", requireAuth, async (req: any, res) => {
    try {
      const { getAuthorizationUrl, isOutlookConfigured } = await import('./outlookClient');
      
      if (!isOutlookConfigured()) {
        return res.status(400).json({ error: "Outlook integration not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET." });
      }
      
      const userContext = await getUserContext(req.userId);
      const authUrl = getAuthorizationUrl(userContext.effectiveUserId);
      
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error starting Outlook OAuth:", error);
      res.status(500).json({ error: error.message || "Failed to start Outlook connection" });
    }
  });
  
  // Outlook OAuth callback (with CSRF protection via signed state)
  app.get("/api/integrations/outlook/callback", async (req: any, res) => {
    try {
      const { handleOAuthCallback, validateAndExtractState } = await import('./outlookClient');
      
      const { code, state, error: oauthError } = req.query;
      
      if (oauthError) {
        console.error("[Outlook] OAuth error:", oauthError);
        return res.redirect(`/integrations?error=${encodeURIComponent(oauthError as string)}`);
      }
      
      if (!code || !state) {
        return res.redirect('/integrations?error=missing_parameters');
      }
      
      // Validate HMAC-signed state to prevent CSRF attacks
      const stateValidation = validateAndExtractState(decodeURIComponent(state as string));
      if (!stateValidation.valid || !stateValidation.userId) {
        console.error("[Outlook] Invalid or expired OAuth state");
        return res.redirect('/integrations?error=invalid_state');
      }
      
      const result = await handleOAuthCallback(code as string, stateValidation.userId);
      
      if (result.success) {
        res.redirect('/integrations?success=outlook_connected');
      } else {
        res.redirect(`/integrations?error=${encodeURIComponent(result.error || 'connection_failed')}`);
      }
    } catch (error: any) {
      console.error("Error handling Outlook callback:", error);
      res.redirect(`/integrations?error=${encodeURIComponent(error.message || 'callback_failed')}`);
    }
  });
  
  // Outlook disconnect
  app.post("/api/integrations/outlook/disconnect", requireAuth, async (req: any, res) => {
    try {
      const { disconnectOutlook } = await import('./outlookClient');
      
      const userContext = await getUserContext(req.userId);
      await disconnectOutlook(userContext.effectiveUserId);
      
      res.json({ success: true, message: "Outlook disconnected successfully" });
    } catch (error: any) {
      console.error("Error disconnecting Outlook:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect Outlook" });
    }
  });
  
  // Outlook connection status
  app.get("/api/integrations/outlook/status", requireAuth, async (req: any, res) => {
    try {
      const { getConnectionInfo } = await import('./outlookClient');
      
      const userContext = await getUserContext(req.userId);
      const status = await getConnectionInfo(userContext.effectiveUserId);
      
      res.json(status);
    } catch (error: any) {
      console.error("Error getting Outlook status:", error);
      res.status(500).json({ error: error.message || "Failed to get Outlook status" });
    }
  });

  // Platform stats endpoint - returns beta status
  app.get("/api/platform/stats", async (req, res) => {
    res.json({
      isBeta: true,
      isFree: true,
      message: "Free during beta",
    });
  });

  // Admin endpoint to initialize Stripe products (creates Pro and Team tier products/prices)
  app.post("/api/admin/init-stripe-products", async (req, res) => {
    try {
      const { initializeStripeProducts } = await import('./billingService');
      const result = await initializeStripeProducts();
      
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to initialize Stripe products' });
      }
      
      res.json({
        success: true,
        message: 'Stripe products initialized successfully',
        products: result.products
      });
    } catch (error: any) {
      console.error("Error initializing Stripe products:", error);
      res.status(500).json({ error: error.message || "Failed to initialize Stripe products" });
    }
  });

  // Admin endpoint to force reset demo data (deletes all and recreates with new IDs)
  // Use when mobile/web IDs are out of sync or data is corrupted
  app.post("/api/admin/reset-demo-data", requireAuth, async (req: any, res) => {
    try {
      const { forceResetDemoData, DEMO_USER } = await import('./demoData');
      
      // Only allow demo user to reset their own data
      const user = await storage.getUser(req.userId);
      if (!user || user.email !== DEMO_USER.email) {
        return res.status(403).json({ error: 'Only the demo account can reset demo data' });
      }
      
      const result = await forceResetDemoData();
      
      if (!result.success) {
        return res.status(500).json({ error: result.message });
      }
      
      res.json({
        success: true,
        message: result.message,
        warning: 'Mobile app may need to refresh data. Pull down to refresh on all list screens.'
      });
    } catch (error: any) {
      console.error("Error resetting demo data:", error);
      res.status(500).json({ error: error.message || "Failed to reset demo data" });
    }
  });

  // OAuth redirect URIs helper endpoint - shows required URIs for OAuth setup
  // This helps users configure their Google Cloud Console and Xero Developer Portal correctly
  app.get("/api/integrations/oauth-uris", async (req, res) => {
    const baseUrl = getProductionBaseUrl(req);
    
    res.json({
      baseUrl,
      googleCalendar: {
        callbackUri: `${baseUrl}/api/integrations/google-calendar/callback`,
        instructions: "Add this URI to your Google Cloud Console under APIs & Services > Credentials > OAuth 2.0 Client IDs > Authorized redirect URIs"
      },
      xero: {
        callbackUri: `${baseUrl}/api/integrations/xero/callback`,
        instructions: "Add this URI to your Xero Developer Portal under App Details > Redirect URIs"
      },
      googleAuth: {
        callbackUri: `${baseUrl}/api/auth/google/callback`,
        instructions: "Add this URI to your Google Cloud Console for authentication/login OAuth"
      },
      outlook: {
        callbackUri: `${baseUrl}/api/integrations/outlook/callback`,
        instructions: "Add this URI to your Microsoft Azure App Registration under Authentication > Redirect URIs (Web)"
      }
    });
  });

  // Unified integrations status endpoint for mobile and web
  app.get("/api/integrations/status", requireAuth, async (req: any, res) => {
    try {
      const { isGoogleCalendarConnected, getCalendarInfo, isGoogleCalendarConfigured } = await import('./googleCalendarClient');
      const xeroService = await import('./xeroService');
      
      const userContext = await getUserContext(req.userId);
      
      // Google Calendar status (per-user)
      let googleCalendarStatus = {
        configured: isGoogleCalendarConfigured(),
        connected: false,
        email: undefined as string | undefined,
        message: undefined as string | undefined
      };
      try {
        const calendarConnected = await isGoogleCalendarConnected(userContext.effectiveUserId);
        if (calendarConnected) {
          const calendarInfo = await getCalendarInfo(userContext.effectiveUserId);
          googleCalendarStatus.connected = true;
          googleCalendarStatus.email = calendarInfo?.email;
        }
      } catch (e: any) {
        // Calendar not connected for this user
        googleCalendarStatus.message = e.message || 'Google Calendar not connected';
      }
      
      // Xero status
      let xeroStatus = {
        configured: !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET),
        connected: false,
        organisationName: undefined as string | undefined
      };
      try {
        const xeroConnected = await xeroService.isXeroConnected(userContext.effectiveUserId);
        if (xeroConnected) {
          xeroStatus.connected = true;
          const xeroOrg = await xeroService.getXeroOrganisation(userContext.effectiveUserId);
          xeroStatus.organisationName = xeroOrg?.name;
        }
      } catch (e) {
        // Xero not connected
      }
      
      // Stripe status
      const stripeStatus = {
        configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
        connected: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY)
      };
      
      // Twilio status - check connector and env vars
      const twilioAvailability = await checkTwilioAvailability();
      const twilioStatus = {
        configured: twilioAvailability.configured,
        connected: twilioAvailability.connected && twilioAvailability.hasPhoneNumber
      };
      
      res.json({
        googleCalendar: googleCalendarStatus,
        xero: xeroStatus,
        stripe: stripeStatus,
        twilio: twilioStatus
      });
    } catch (error: any) {
      console.error("Error getting integrations status:", error);
      res.status(500).json({ error: error.message || "Failed to get integrations status" });
    }
  });

  // Recent activity endpoint - shows user's recent system activity with navigation links
  app.get("/api/activity/recent/:limit?", requireAuth, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.params.limit) || 10, 50);
      const userContext = await getUserContext(req.userId);
      
      // Get activity logs from the new activity_logs table
      const activityLogs = await storage.getActivityLogs(userContext.effectiveUserId, limit);
      
      // Map activity logs to activity items with navigation paths
      const activities = activityLogs.map((log: any) => {
        // Determine navigation path based on entity type and id
        let navigationPath: string | null = null;
        if (log.entityType && log.entityId) {
          switch (log.entityType) {
            case 'job':
              navigationPath = `/jobs/${log.entityId}`;
              break;
            case 'quote':
              navigationPath = `/quotes/${log.entityId}`;
              break;
            case 'invoice':
              navigationPath = `/invoices/${log.entityId}`;
              break;
          }
        }
        
        return {
          id: log.id,
          type: log.type,
          title: log.title || 'Activity',
          description: log.description || '',
          timestamp: log.createdAt,
          status: 'success' as const,
          entityType: log.entityType,
          entityId: log.entityId,
          navigationPath,
          metadata: log.metadata,
        };
      });
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.json([]);
    }
  });

  // Email Integration Routes - Allows tradies to connect their own email
  app.get("/api/email-integration", requireAuth, async (req: any, res) => {
    try {
      const { getUserEmailIntegrations, getGmailConnectionStatus } = await import("./emailIntegrationService");
      
      // Get database integrations (SMTP or Gmail configured by user)
      const integrations = await getUserEmailIntegrations(req.userId);
      const activeIntegration = integrations.find(i => i.status === 'connected');
      
      // Check if Gmail is available at platform level (for info display)
      const gmailStatus = await getGmailConnectionStatus(req.userId);
      
      // Gmail connector counts as an integration even without DB record
      const hasAnyIntegration = !!activeIntegration || gmailStatus.connected;
      
      // If no DB integration but Gmail is connected, create virtual integration object
      const integrationInfo = activeIntegration ? {
        id: activeIntegration.id,
        provider: activeIntegration.provider,
        emailAddress: activeIntegration.emailAddress,
        displayName: activeIntegration.displayName,
        status: activeIntegration.status,
        lastUsedAt: activeIntegration.lastUsedAt,
        lastError: activeIntegration.lastError,
      } : gmailStatus.connected ? {
        id: 'gmail-connector',
        provider: 'gmail',
        emailAddress: gmailStatus.email || 'Gmail Account',
        displayName: gmailStatus.displayName || 'Gmail Connector',
        status: 'connected',
        lastUsedAt: null,
        lastError: null,
      } : null;
      
      res.json({
        hasIntegration: hasAnyIntegration,
        integration: integrationInfo,
        // Platform Gmail info - shows if Gmail is available for the owner
        gmailConnected: gmailStatus.connected,
        gmailEmail: gmailStatus.email,
      });
    } catch (error) {
      console.error("Error fetching email integration:", error);
      res.status(500).json({ error: "Failed to fetch email integration" });
    }
  });

  // Check Gmail connection status (platform level)
  app.get("/api/email-integration/gmail-status", requireAuth, async (req: any, res) => {
    try {
      const { getGmailConnectionStatus } = await import("./emailIntegrationService");
      const status = await getGmailConnectionStatus(req.userId);
      res.json(status);
    } catch (error) {
      console.error("Error checking Gmail status:", error);
      res.status(500).json({ connected: false, error: "Failed to check Gmail status" });
    }
  });

  // GET /api/email-provider/status - Get comprehensive email provider status with fallback options
  app.get("/api/email-provider/status", requireAuth, async (req: any, res) => {
    try {
      const { getEmailProviderStatus, getEmailWarning } = await import("./emailProviderService");
      const status = await getEmailProviderStatus(req.userId, storage);
      const warning = getEmailWarning(status);
      res.json({ ...status, warning });
    } catch (error) {
      console.error("Error getting email provider status:", error);
      res.status(500).json({ 
        error: "Failed to get email provider status",
        fallbackRequired: true,
        availableClients: [
          { id: 'gmail', name: 'Gmail', available: true },
          { id: 'outlook', name: 'Outlook', available: true },
          { id: 'default', name: 'Default Email App', available: true },
        ]
      });
    }
  });

  // GET /api/email-provider/compose-url - Generate compose URL for a specific email client
  app.get("/api/email-provider/compose-url", requireAuth, async (req: any, res) => {
    try {
      const { client, to, subject, body, cc, bcc } = req.query;
      
      if (!client || !to) {
        return res.status(400).json({ error: "client and to are required" });
      }
      
      const { generateComposeUrl, formatPlainTextBody } = await import("./emailProviderService");
      
      // Convert body to plain text if it contains HTML
      const plainBody = body ? formatPlainTextBody(body as string) : '';
      
      const url = generateComposeUrl(client as string, {
        to: to as string,
        subject: (subject as string) || '',
        body: plainBody,
        cc: cc as string,
        bcc: bcc as string,
      });
      
      res.json({ url, client });
    } catch (error) {
      console.error("Error generating compose URL:", error);
      res.status(500).json({ error: "Failed to generate compose URL" });
    }
  });

  app.post("/api/email-integration/connect-smtp", requireAuth, async (req: any, res) => {
    try {
      const { host, port, user, password, emailAddress, displayName, secure } = req.body;
      
      // Validate required fields
      if (!host || typeof host !== 'string' || !host.trim()) {
        return res.status(400).json({ error: "SMTP server host is required" });
      }
      if (!user || typeof user !== 'string' || !user.trim()) {
        return res.status(400).json({ error: "SMTP username is required" });
      }
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: "SMTP password is required" });
      }
      if (!emailAddress || typeof emailAddress !== 'string' || !emailAddress.includes('@')) {
        return res.status(400).json({ error: "Valid email address is required" });
      }
      
      // Parse and validate port
      const parsedPort = parseInt(port, 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return res.status(400).json({ error: "Port must be a valid number between 1 and 65535" });
      }
      
      // Common SMTP ports: 25, 465, 587, 2525
      const commonPorts = [25, 465, 587, 2525];
      if (!commonPorts.includes(parsedPort)) {
        console.warn(`Unusual SMTP port ${parsedPort} - common ports are: ${commonPorts.join(', ')}`);
      }

      const { connectSmtpEmail } = await import("./emailIntegrationService");
      const result = await connectSmtpEmail(req.userId, {
        host: host.trim(),
        port: parsedPort,
        user: user.trim(),
        password,
        secure: secure !== false,
        emailAddress: emailAddress.trim().toLowerCase(),
        displayName: (displayName || '').trim() || emailAddress.split('@')[0],
      });

      if (result.success) {
        res.json({ success: true, message: "Email connected successfully!" });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error connecting SMTP email:", error);
      res.status(500).json({ error: error.message || "Failed to connect email" });
    }
  });

  app.post("/api/email-integration/disconnect", requireAuth, async (req: any, res) => {
    try {
      const { disconnectEmail } = await import("./emailIntegrationService");
      const result = await disconnectEmail(req.userId);
      
      res.json({ success: result.success });
    } catch (error) {
      console.error("Error disconnecting email:", error);
      res.status(500).json({ error: "Failed to disconnect email" });
    }
  });

  app.post("/api/email-integration/test", requireAuth, async (req: any, res) => {
    try {
      const { testEmailConnection } = await import("./emailIntegrationService");
      const result = await testEmailConnection(req.userId);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error testing email connection:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to test email connection" });
    }
  });

  // ================================
  // Daily Summary Email Endpoints
  // ================================

  // GET /api/email/daily-summary/preview - Preview the daily summary without sending
  app.get("/api/email/daily-summary/preview", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const userId = userContext.effectiveUserId;
      
      const businessSettingsData = await storage.getBusinessSettings(userId);
      if (!businessSettingsData) {
        return res.status(400).json({ error: "Business settings not found" });
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get all data for today
      const [allJobs, allQuotes, allInvoices, allClients] = await Promise.all([
        storage.getJobs(userId),
        storage.getQuotes(userId),
        storage.getInvoices(userId),
        storage.getClients(userId),
      ]);

      // Filter for today's activity
      const todayJobs = allJobs.filter(job => {
        const completedAt = job.completedAt ? new Date(job.completedAt) : null;
        return completedAt && completedAt >= startOfDay && completedAt < endOfDay;
      });

      const todayQuotesSent = allQuotes.filter(quote => {
        const sentAt = quote.sentAt ? new Date(quote.sentAt) : null;
        return sentAt && sentAt >= startOfDay && sentAt < endOfDay;
      });

      const todayQuotesAccepted = allQuotes.filter(quote => {
        const acceptedAt = quote.acceptedAt ? new Date(quote.acceptedAt) : null;
        return acceptedAt && acceptedAt >= startOfDay && acceptedAt < endOfDay;
      });

      const todayQuotesRejected = allQuotes.filter(quote => {
        return quote.status === 'rejected' && quote.updatedAt && 
          new Date(quote.updatedAt) >= startOfDay && new Date(quote.updatedAt) < endOfDay;
      });

      const todayInvoicesSent = allInvoices.filter(invoice => {
        const sentAt = invoice.sentAt ? new Date(invoice.sentAt) : null;
        return sentAt && sentAt >= startOfDay && sentAt < endOfDay;
      });

      const todayInvoicesPaid = allInvoices.filter(invoice => {
        const paidAt = invoice.paidAt ? new Date(invoice.paidAt) : null;
        return paidAt && paidAt >= startOfDay && paidAt < endOfDay;
      });

      const overdueInvoices = allInvoices.filter(invoice => {
        return invoice.status === 'overdue' || 
          (invoice.dueDate && new Date(invoice.dueDate) < today && invoice.status !== 'paid');
      });

      // Calculate totals
      const quoteSentTotal = todayQuotesSent.reduce((sum, q) => sum + Number(q.total || 0), 0);
      const quoteAcceptedTotal = todayQuotesAccepted.reduce((sum, q) => sum + Number(q.total || 0), 0);
      const invoiceSentTotal = todayInvoicesSent.reduce((sum, i) => sum + Number(i.total || 0), 0);
      const invoicePaidTotal = todayInvoicesPaid.reduce((sum, i) => sum + Number(i.total || 0), 0);
      const overdueTotal = overdueInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);

      // Get client names for completed jobs and payments
      const getClientName = (clientId: string | null) => {
        if (!clientId) return 'Unknown';
        const client = allClients.find(c => c.id === clientId);
        return client?.name || 'Unknown';
      };

      const completedJobsList = todayJobs.map(job => ({
        title: job.title,
        client: getClientName(job.clientId),
        value: Number(job.value || 0),
      }));

      const paymentsList = todayInvoicesPaid.map(invoice => ({
        client: getClientName(invoice.clientId),
        amount: Number(invoice.total || 0),
        invoice: invoice.number || `INV-${invoice.id?.substring(0, 8).toUpperCase()}`,
      }));

      // Calculate conversion rate
      const pendingQuotes = allQuotes.filter(q => q.status === 'sent' || q.status === 'viewed');
      const totalQuotesConsidered = todayQuotesAccepted.length + todayQuotesRejected.length;
      const conversionRate = totalQuotesConsidered > 0 
        ? Math.round((todayQuotesAccepted.length / totalQuotesConsidered) * 100) 
        : 0;

      // Build action items
      const actionItems: Array<{ type: 'overdue' | 'followup' | 'reminder'; message: string; priority: 'high' | 'medium' | 'low' }> = [];
      
      if (overdueInvoices.length > 0) {
        actionItems.push({
          type: 'overdue',
          message: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's are' : ' is'} overdue (${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(overdueTotal)})`,
          priority: 'high',
        });
      }

      if (pendingQuotes.length > 0) {
        actionItems.push({
          type: 'followup',
          message: `${pendingQuotes.length} quote${pendingQuotes.length > 1 ? 's' : ''} awaiting client response`,
          priority: 'medium',
        });
      }

      const inProgressJobs = allJobs.filter(j => j.status === 'in_progress');
      if (inProgressJobs.length > 0) {
        actionItems.push({
          type: 'reminder',
          message: `${inProgressJobs.length} job${inProgressJobs.length > 1 ? 's' : ''} currently in progress`,
          priority: 'low',
        });
      }

      // Build summary data
      const { DailySummaryData, createDailySummaryEmail } = await import("./emailService");
      
      const summaryData = {
        date: today.toISOString().split('T')[0],
        dateFormatted: today.toLocaleDateString('en-AU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        business: {
          name: businessSettingsData.businessName || 'Your Business',
          email: businessSettingsData.email || '',
          brandColor: businessSettingsData.brandColor || undefined,
        },
        jobs: {
          completed: todayJobs.length,
          completedList: completedJobsList,
          scheduled: allJobs.filter(j => j.status === 'scheduled').length,
          inProgress: inProgressJobs.length,
        },
        quotes: {
          sent: todayQuotesSent.length,
          sentTotal: quoteSentTotal,
          accepted: todayQuotesAccepted.length,
          acceptedTotal: quoteAcceptedTotal,
          rejected: todayQuotesRejected.length,
          pending: pendingQuotes.length,
          conversionRate,
        },
        invoices: {
          sent: todayInvoicesSent.length,
          sentTotal: invoiceSentTotal,
          paid: todayInvoicesPaid.length,
          paidTotal: invoicePaidTotal,
          overdue: overdueInvoices.length,
          overdueTotal,
        },
        payments: {
          received: todayInvoicesPaid.length,
          totalAmount: invoicePaidTotal,
          paymentsList,
        },
        metrics: {
          totalRevenue: invoicePaidTotal,
          outstandingInvoices: overdueTotal,
          quoteConversionRate: conversionRate,
        },
        actionItems,
      };

      // Generate the email HTML for preview
      const emailData = createDailySummaryEmail(summaryData);

      res.json({
        success: true,
        preview: {
          subject: emailData.subject,
          html: emailData.html,
          recipientEmail: summaryData.business.email,
        },
        data: summaryData,
      });
    } catch (error: any) {
      console.error("Error generating daily summary preview:", error);
      res.status(500).json({ error: error.message || "Failed to generate preview" });
    }
  });

  // POST /api/email/daily-summary - Send the daily summary email
  app.post("/api/email/daily-summary", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const userId = userContext.effectiveUserId;
      
      const businessSettingsData = await storage.getBusinessSettings(userId);
      if (!businessSettingsData) {
        return res.status(400).json({ error: "Business settings not found" });
      }

      if (!businessSettingsData.email) {
        return res.status(400).json({ error: "Business email is required to send daily summary" });
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get all data for today
      const [allJobs, allQuotes, allInvoices, allClients] = await Promise.all([
        storage.getJobs(userId),
        storage.getQuotes(userId),
        storage.getInvoices(userId),
        storage.getClients(userId),
      ]);

      // Filter for today's activity
      const todayJobs = allJobs.filter(job => {
        const completedAt = job.completedAt ? new Date(job.completedAt) : null;
        return completedAt && completedAt >= startOfDay && completedAt < endOfDay;
      });

      const todayQuotesSent = allQuotes.filter(quote => {
        const sentAt = quote.sentAt ? new Date(quote.sentAt) : null;
        return sentAt && sentAt >= startOfDay && sentAt < endOfDay;
      });

      const todayQuotesAccepted = allQuotes.filter(quote => {
        const acceptedAt = quote.acceptedAt ? new Date(quote.acceptedAt) : null;
        return acceptedAt && acceptedAt >= startOfDay && acceptedAt < endOfDay;
      });

      const todayQuotesRejected = allQuotes.filter(quote => {
        return quote.status === 'rejected' && quote.updatedAt && 
          new Date(quote.updatedAt) >= startOfDay && new Date(quote.updatedAt) < endOfDay;
      });

      const todayInvoicesSent = allInvoices.filter(invoice => {
        const sentAt = invoice.sentAt ? new Date(invoice.sentAt) : null;
        return sentAt && sentAt >= startOfDay && sentAt < endOfDay;
      });

      const todayInvoicesPaid = allInvoices.filter(invoice => {
        const paidAt = invoice.paidAt ? new Date(invoice.paidAt) : null;
        return paidAt && paidAt >= startOfDay && paidAt < endOfDay;
      });

      const overdueInvoices = allInvoices.filter(invoice => {
        return invoice.status === 'overdue' || 
          (invoice.dueDate && new Date(invoice.dueDate) < today && invoice.status !== 'paid');
      });

      // Calculate totals
      const quoteSentTotal = todayQuotesSent.reduce((sum, q) => sum + Number(q.total || 0), 0);
      const quoteAcceptedTotal = todayQuotesAccepted.reduce((sum, q) => sum + Number(q.total || 0), 0);
      const invoiceSentTotal = todayInvoicesSent.reduce((sum, i) => sum + Number(i.total || 0), 0);
      const invoicePaidTotal = todayInvoicesPaid.reduce((sum, i) => sum + Number(i.total || 0), 0);
      const overdueTotal = overdueInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);

      // Get client names
      const getClientName = (clientId: string | null) => {
        if (!clientId) return 'Unknown';
        const client = allClients.find(c => c.id === clientId);
        return client?.name || 'Unknown';
      };

      const completedJobsList = todayJobs.map(job => ({
        title: job.title,
        client: getClientName(job.clientId),
        value: Number(job.value || 0),
      }));

      const paymentsList = todayInvoicesPaid.map(invoice => ({
        client: getClientName(invoice.clientId),
        amount: Number(invoice.total || 0),
        invoice: invoice.number || `INV-${invoice.id?.substring(0, 8).toUpperCase()}`,
      }));

      // Calculate conversion rate
      const pendingQuotes = allQuotes.filter(q => q.status === 'sent' || q.status === 'viewed');
      const totalQuotesConsidered = todayQuotesAccepted.length + todayQuotesRejected.length;
      const conversionRate = totalQuotesConsidered > 0 
        ? Math.round((todayQuotesAccepted.length / totalQuotesConsidered) * 100) 
        : 0;

      // Build action items
      const actionItems: Array<{ type: 'overdue' | 'followup' | 'reminder'; message: string; priority: 'high' | 'medium' | 'low' }> = [];
      
      if (overdueInvoices.length > 0) {
        actionItems.push({
          type: 'overdue',
          message: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's are' : ' is'} overdue (${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(overdueTotal)})`,
          priority: 'high',
        });
      }

      if (pendingQuotes.length > 0) {
        actionItems.push({
          type: 'followup',
          message: `${pendingQuotes.length} quote${pendingQuotes.length > 1 ? 's' : ''} awaiting client response`,
          priority: 'medium',
        });
      }

      const inProgressJobs = allJobs.filter(j => j.status === 'in_progress');
      if (inProgressJobs.length > 0) {
        actionItems.push({
          type: 'reminder',
          message: `${inProgressJobs.length} job${inProgressJobs.length > 1 ? 's' : ''} currently in progress`,
          priority: 'low',
        });
      }

      // Build and send summary
      const { sendDailySummaryEmail } = await import("./emailService");
      
      const summaryData = {
        date: today.toISOString().split('T')[0],
        dateFormatted: today.toLocaleDateString('en-AU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        business: {
          name: businessSettingsData.businessName || 'Your Business',
          email: businessSettingsData.email,
          brandColor: businessSettingsData.brandColor || undefined,
        },
        jobs: {
          completed: todayJobs.length,
          completedList: completedJobsList,
          scheduled: allJobs.filter(j => j.status === 'scheduled').length,
          inProgress: inProgressJobs.length,
        },
        quotes: {
          sent: todayQuotesSent.length,
          sentTotal: quoteSentTotal,
          accepted: todayQuotesAccepted.length,
          acceptedTotal: quoteAcceptedTotal,
          rejected: todayQuotesRejected.length,
          pending: pendingQuotes.length,
          conversionRate,
        },
        invoices: {
          sent: todayInvoicesSent.length,
          sentTotal: invoiceSentTotal,
          paid: todayInvoicesPaid.length,
          paidTotal: invoicePaidTotal,
          overdue: overdueInvoices.length,
          overdueTotal,
        },
        payments: {
          received: todayInvoicesPaid.length,
          totalAmount: invoicePaidTotal,
          paymentsList,
        },
        metrics: {
          totalRevenue: invoicePaidTotal,
          outstandingInvoices: overdueTotal,
          quoteConversionRate: conversionRate,
        },
        actionItems,
      };

      const result = await sendDailySummaryEmail(summaryData);

      // Update last sent timestamp
      await storage.upsertAutomationSettings(userId, {
        dailySummaryLastSent: new Date(),
      });

      res.json({
        success: true,
        message: result.message,
        sentTo: businessSettingsData.email,
      });
    } catch (error: any) {
      console.error("Error sending daily summary:", error);
      res.status(500).json({ error: error.message || "Failed to send daily summary" });
    }
  });

  // Clients Routes
  app.get("/api/clients", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let clients = await storage.getClients(userContext.effectiveUserId);
      
      // Staff tradies (team members without VIEW_ALL permission) see limited client data
      // Only clients associated with their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        const jobs = await storage.getJobs(userContext.effectiveUserId);
        const assignedJobs = jobs.filter(job => job.assignedTo === req.userId);
        const assignedClientIds = [...new Set(assignedJobs.map(j => j.clientId).filter(Boolean))];
        clients = clients.filter(c => assignedClientIds.includes(c.id));
      }
      
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Get single client (team-aware)
  app.get("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const client = await storage.getClient(req.params.id, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_CLIENTS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient({ ...data, userId: effectiveUserId });
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_CLIENTS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const data = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, effectiveUserId, data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Delete client (team-aware)
  app.delete("/api/clients/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_CLIENTS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteClient(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Client saved signature routes
  app.get("/api/clients/:id/saved-signature", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const signature = await storage.getClientSignature(req.params.id, userContext.effectiveUserId);
      if (!signature) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }
      res.json(signature);
    } catch (error) {
      console.error("Error fetching client signature:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/clients/:id/saved-signature", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_CLIENTS), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteClientSignature(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client signature:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Client Assets - Photos, signatures, documents across all jobs for a client
  app.get("/api/clients/:clientId/assets", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const userContext = await getUserContext(req.userId);
      
      // Verify client belongs to user's organization before returning assets
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }
      
      // Get all jobs for this client
      const allJobs = await storage.getJobs(userContext.effectiveUserId);
      const clientJobs = allJobs.filter(j => j.clientId === clientId);
      const jobIds = clientJobs.map(j => j.id);
      
      // Get all photos for these jobs
      const photos: any[] = [];
      for (const jobId of jobIds) {
        const jobPhotos = await storage.getJobPhotos(jobId, userContext.effectiveUserId);
        const job = clientJobs.find(j => j.id === jobId);
        photos.push(...jobPhotos.map(p => ({ ...p, jobTitle: job?.title, jobId })));
      }
      
      // Get all signatures for client's quotes and invoices
      const allQuotes = await storage.getQuotes(userContext.effectiveUserId);
      const allInvoices = await storage.getInvoices(userContext.effectiveUserId);
      const clientQuotes = allQuotes.filter(q => q.clientId === clientId);
      const clientInvoices = allInvoices.filter(i => i.clientId === clientId);
      
      const signatures: any[] = [];
      for (const quote of clientQuotes) {
        const sig = await storage.getDigitalSignatureByQuoteId(quote.id);
        if (sig) signatures.push({ ...sig, relatedType: 'quote', relatedId: quote.id, quoteNumber: quote.quoteNumber });
      }
      // Note: Invoice signatures would use a similar method if available
      
      // Get most recent signature for quick reuse
      const latestSignature = signatures.length > 0 
        ? signatures.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())[0]
        : null;
      
      res.json({
        photos,
        signatures,
        latestSignature,
        summary: {
          totalPhotos: photos.length,
          totalSignatures: signatures.length,
          jobCount: clientJobs.length,
          quoteCount: clientQuotes.length,
          invoiceCount: clientInvoices.length
        }
      });
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ error: "Failed to fetch client assets" });
    }
  });

  // Get client's saved signature for auto-fill
  app.get("/api/clients/:clientId/saved-signature", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const userContext = await getUserContext(req.userId);
      
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({
        hasSavedSignature: !!client.savedSignatureData,
        signatureData: client.savedSignatureData,
        signatureDate: client.savedSignatureDate,
        clientName: client.name,
      });
    } catch (error) {
      console.error("Error fetching client saved signature:", error);
      res.status(500).json({ error: "Failed to fetch client signature" });
    }
  });
  
  // Save/update client's signature for auto-fill
  app.post("/api/clients/:clientId/saved-signature", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const { signatureData } = req.body;
      const userContext = await getUserContext(req.userId);
      
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      await db.update(clients)
        .set({ 
          savedSignatureData: signatureData,
          savedSignatureDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(clients.id, clientId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving client signature:", error);
      res.status(500).json({ error: "Failed to save client signature" });
    }
  });
  
  // Clear client's saved signature
  app.delete("/api/clients/:clientId/saved-signature", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const userContext = await getUserContext(req.userId);
      
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      await db.update(clients)
        .set({ 
          savedSignatureData: null,
          savedSignatureDate: null,
          updatedAt: new Date()
        })
        .where(eq(clients.id, clientId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing client signature:", error);
      res.status(500).json({ error: "Failed to clear client signature" });
    }
  });

  // Smart Pre-fill - Suggest data based on client history
  app.get("/api/clients/:clientId/prefill-suggestions", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const { type } = req.query; // 'job', 'quote', 'invoice'
      const userContext = await getUserContext(req.userId);
      
      // Get client details
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Get client's previous jobs, quotes, invoices
      const allJobs = await storage.getJobs(userContext.effectiveUserId);
      const clientJobs = allJobs.filter(j => j.clientId === clientId).sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      const allQuotes = await storage.getQuotes(userContext.effectiveUserId);
      const clientQuotes = allQuotes.filter(q => q.clientId === clientId).sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      // Get catalog items frequently used for this client
      const catalogItems = await storage.getLineItemCatalog(userContext.effectiveUserId);
      const usedItemIds: Record<string, number> = {};
      
      for (const quote of clientQuotes) {
        const lineItems = (quote.lineItems as any[]) || [];
        for (const item of lineItems) {
          if (item.catalogItemId) {
            usedItemIds[item.catalogItemId] = (usedItemIds[item.catalogItemId] || 0) + 1;
          }
        }
      }
      
      // Get frequently used items
      const frequentItems = Object.entries(usedItemIds)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => catalogItems.find(c => c.id === id))
        .filter(Boolean);
      
      // Get most recent photos
      const recentPhotos: any[] = [];
      for (const job of clientJobs.slice(0, 3)) {
        const photos = await storage.getJobPhotos(job.id, userContext.effectiveUserId);
        recentPhotos.push(...photos.slice(0, 3).map(p => ({ ...p, jobTitle: job.title })));
      }
      
      // Get latest signature
      let latestSignature = null;
      for (const quote of clientQuotes.slice(0, 5)) {
        const sig = await storage.getDigitalSignatureByQuoteId(quote.id);
        if (sig) {
          latestSignature = sig;
          break;
        }
      }
      
      // Build suggestions
      const suggestions = {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
        },
        prefillData: {
          address: client.address,
          contactName: client.name,
          contactEmail: client.email,
          contactPhone: client.phone,
        },
        recentJobs: clientJobs.slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          status: j.status,
          address: j.address,
        })),
        frequentCatalogItems: frequentItems,
        recentPhotos: recentPhotos.slice(0, 6),
        savedSignature: latestSignature ? {
          signerName: latestSignature.signerName,
          signatureData: latestSignature.signatureData,
          signedAt: latestSignature.signedAt,
        } : null,
        lastJobAddress: clientJobs[0]?.address || client.address,
        lastQuoteTemplate: clientQuotes[0]?.templateId,
      };
      
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching prefill suggestions:", error);
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  // Jobs Routes
  app.get("/api/jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const includeArchived = req.query.archived === 'true';
      let jobs = await storage.getJobs(userContext.effectiveUserId, includeArchived);
      
      // Staff tradies (team members without VIEW_ALL permission) only see their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => job.assignedTo === req.userId);
      }
      
      // Filter for unassigned jobs if requested
      const { unassigned } = req.query;
      if (unassigned === 'true') {
        const unassignedJobs = jobs.filter(job => 
          !job.assignedTo && 
          job.status !== 'done' && 
          job.status !== 'invoiced'
        );
        return res.json(unassignedJobs);
      }
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Archive/Unarchive job
  app.post("/api/jobs/:id/archive", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.archiveJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error archiving job:", error);
      res.status(500).json({ error: "Failed to archive job" });
    }
  });

  app.post("/api/jobs/:id/unarchive", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.unarchiveJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error unarchiving job:", error);
      res.status(500).json({ error: "Failed to unarchive job" });
    }
  });

  // Jobs assigned to the current user (for staff tradie dashboard)
  app.get("/api/jobs/my-jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      // Filter to only jobs assigned to this user
      const myJobs = jobs
        .filter(job => job.assignedTo === req.userId)
        .map(job => {
          const client = clients.find((c: any) => c.id === job.clientId);
          return {
            ...job,
            clientName: client?.name || 'Unknown Client',
            clientPhone: client?.phone || null,
            clientEmail: client?.email || null,
          };
        })
        .sort((a, b) => {
          // Sort by scheduled date, then by status
          if (a.scheduledAt && b.scheduledAt) {
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
          }
          if (a.scheduledAt) return -1;
          if (b.scheduledAt) return 1;
          return 0;
        });
      
      res.json(myJobs);
    } catch (error) {
      console.error("Error fetching my jobs:", error);
      res.status(500).json({ error: "Failed to fetch my jobs" });
    }
  });

  // Today's jobs endpoint - Must come BEFORE the :id route
  app.get("/api/jobs/today", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let jobs = await storage.getJobs(userContext.effectiveUserId);
      const clients = await storage.getClients(userContext.effectiveUserId);
      
      // Staff tradies only see their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => job.assignedTo === req.userId);
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysJobs = jobs
        .filter(job => {
          if (!job.scheduledAt) return false;
          const schedDate = new Date(job.scheduledAt);
          return schedDate >= today && schedDate < tomorrow;
        })
        .map(job => {
          const client = clients.find((c: any) => c.id === job.clientId);
          return {
            ...job,
            clientName: client?.name || 'Unknown Client',
            clientPhone: client?.phone || null,
            clientEmail: client?.email || null,
          };
        })
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

      res.json(todaysJobs);
    } catch (error) {
      console.error("Error fetching today's jobs:", error);
      res.status(500).json({ error: "Failed to fetch today's jobs" });
    }
  });

  // Contextual jobs endpoint - returns jobs with enriched data and linked documents
  app.get("/api/jobs/contextual", requireAuth, async (req: any, res) => {
    try {
      const { status, forDocument } = req.query;
      const userId = req.userId;
      
      const [jobs, quotes, invoices, clients] = await Promise.all([
        storage.getJobs(userId),
        storage.getQuotes(userId),
        storage.getInvoices(userId),
        storage.getClients(userId)
      ]);
      
      // Create lookup maps
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      const quotesMap = new Map(quotes.filter((q: any) => q.jobId).map((q: any) => [q.jobId, q]));
      const invoicesMap = new Map(invoices.filter((i: any) => i.jobId).map((i: any) => [i.jobId, i]));
      
      // Filter by status if provided
      let filteredJobs = jobs;
      if (status) {
        const statusFilters = status.split(',');
        filteredJobs = jobs.filter((j: any) => statusFilters.includes(j.status));
      }
      
      // Sort jobs: priority for completed/done, then by recency
      const statusPriority: Record<string, number> = {
        'done': 0,
        'completed': 0,
        'invoiced': 1,
        'in_progress': 2,
        'scheduled': 3,
        'pending': 4
      };
      
      filteredJobs.sort((a: any, b: any) => {
        const priorityA = statusPriority[a.status] ?? 5;
        const priorityB = statusPriority[b.status] ?? 5;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
      
      // Enrich jobs with client data, time entries, photos, and linked documents
      const enrichedJobs = await Promise.all(
        filteredJobs
          .slice(0, 20) // Limit to 20 most recent
          .map(async (job: any) => {
            const client = clientsMap.get(job.clientId);
            const linkedQuote = quotesMap.get(job.id);
            const linkedInvoice = invoicesMap.get(job.id);
            
            // Get time entries for this job
            const timeEntries = await storage.getTimeEntries(userId, { jobId: job.id });
            const totalMinutes = timeEntries.reduce((acc: number, entry: any) => {
              if (entry.duration) return acc + entry.duration;
              if (entry.endTime && entry.startTime) {
                const diffMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
                return acc + Math.round(diffMs / 60000);
              }
              return acc;
            }, 0);
            const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
            
            // Get photos for this job
            const photos = await storage.getJobPhotos(job.id, userId);
            
            // Get line items for linked quote if exists
            const quoteLineItems = linkedQuote 
              ? await storage.getQuoteLineItems(linkedQuote.id)
              : [];
            
            return {
              ...job,
              client: client ? {
                id: client.id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                address: client.address,
              } : null,
              timeTracking: {
                totalMinutes,
                totalHours,
                entriesCount: timeEntries.length,
              },
              photos: photos.map((p: any) => ({
                id: p.id,
                fileName: p.fileName,
                category: p.category,
                caption: p.caption,
              })),
              hasQuote: !!linkedQuote,
              hasInvoice: !!linkedInvoice,
              linkedQuote: linkedQuote ? {
                id: linkedQuote.id,
                quoteNumber: linkedQuote.number,
                title: linkedQuote.title,
                description: linkedQuote.description,
                lineItems: quoteLineItems.map((item: any) => ({
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                subtotal: linkedQuote.subtotal,
                gstAmount: linkedQuote.gstAmount,
                total: linkedQuote.total,
                status: linkedQuote.status,
                notes: linkedQuote.notes,
                terms: linkedQuote.terms,
                depositPercent: linkedQuote.depositPercent,
              } : null,
              linkedInvoice: linkedInvoice ? {
                id: linkedInvoice.id,
                invoiceNumber: linkedInvoice.number,
                title: linkedInvoice.title,
                description: linkedInvoice.description,
                lineItems: linkedInvoice.lineItems,
                subtotal: linkedInvoice.subtotal,
                gstAmount: linkedInvoice.gstAmount,
                total: linkedInvoice.total,
                status: linkedInvoice.status,
                notes: linkedInvoice.notes,
                dueDate: linkedInvoice.dueDate,
              } : null,
            };
          })
      );
      
      res.json(enrichedJobs);
    } catch (error) {
      console.error("Error fetching contextual jobs:", error);
      res.status(500).json({ error: "Failed to fetch contextual jobs" });
    }
  });

  // Smart Actions endpoint - returns contextual suggested actions for any entity type
  // GET /api/smart-actions/:entityType/:entityId
  // entityType: 'job' | 'quote' | 'invoice'
  app.get("/api/smart-actions/:entityType/:entityId", requireAuth, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const userId = req.userId;
      
      if (!['job', 'quote', 'invoice'].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type. Must be 'job', 'quote', or 'invoice'" });
      }
      
      type SmartAction = {
        id: string;
        type: string;
        title: string;
        description: string;
        icon: string;
        status: 'suggested' | 'enabled' | 'disabled' | 'completed' | 'skipped';
        enabled: boolean;
        preview?: {
          recipient?: string;
          subject?: string;
          message?: string;
          amount?: string;
          scheduledFor?: string;
        };
        aiSuggestion?: string;
        requirements?: string[];
        missingRequirements?: string[];
      };
      
      const actions: SmartAction[] = [];
      
      if (entityType === 'job') {
        const job = await storage.getJob(entityId, userId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        
        const client = job.clientId ? await storage.getClient(job.clientId, userId) : null;
        const quotes = await storage.getQuotes(userId);
        const invoices = await storage.getInvoices(userId);
        const linkedQuote = quotes.find((q: any) => q.jobId === job.id);
        const linkedInvoice = invoices.find((i: any) => i.jobId === job.id);
        
        const clientEmail = client?.email;
        const clientPhone = client?.phone;
        const clientName = client?.name || 'Client';
        
        if (job.status === 'done' && !linkedInvoice) {
          actions.push({
            id: 'create_invoice',
            type: 'create_invoice',
            title: 'Create Invoice',
            description: `Generate invoice for ${job.title}`,
            icon: 'invoice',
            status: 'suggested',
            enabled: true,
            preview: {
              recipient: clientName,
              amount: linkedQuote?.total ? `$${parseFloat(linkedQuote.total).toFixed(2)}` : 'Based on job details',
            },
            aiSuggestion: linkedQuote ? 'Will use line items from the accepted quote' : 'Add line items based on work completed',
            requirements: ['Job must be completed'],
          });
          
          if (clientEmail) {
            actions.push({
              id: 'send_invoice_email',
              type: 'send_email',
              title: 'Email Invoice',
              description: `Send invoice to ${clientName}`,
              icon: 'email',
              status: 'suggested',
              enabled: true,
              preview: {
                recipient: clientEmail,
                subject: `Invoice for ${job.title}`,
                message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your invoice for "${job.title}".\n\nCheers`,
              },
              aiSuggestion: 'Friendly Australian-style email with payment link included',
              requirements: ['Invoice created', 'Client email'],
            });
          } else {
            actions.push({
              id: 'send_invoice_email',
              type: 'send_email',
              title: 'Email Invoice',
              description: 'Send invoice via email',
              icon: 'email',
              status: 'suggested',
              enabled: false,
              missingRequirements: ['Client email address'],
              requirements: ['Invoice created', 'Client email'],
            });
          }
          
          if (clientPhone) {
            actions.push({
              id: 'send_invoice_sms',
              type: 'send_sms',
              title: 'SMS Payment Link',
              description: `Text payment link to ${clientPhone}`,
              icon: 'sms',
              status: 'suggested',
              enabled: false,
              preview: {
                recipient: clientPhone,
                message: `Hi ${clientName.split(' ')[0]}! Your invoice for ${job.title} is ready. Pay here: [link]`,
              },
              requirements: ['Invoice created', 'Client phone'],
            });
          }
        }
        
        if (job.status === 'scheduled' && clientEmail) {
          actions.push({
            id: 'send_confirmation',
            type: 'send_confirmation',
            title: 'Send Confirmation',
            description: 'Confirm booking with client',
            icon: 'email',
            status: 'suggested',
            enabled: false,
            preview: {
              recipient: clientEmail,
              subject: `Booking Confirmed: ${job.title}`,
              message: `G'day! Just confirming we'll be there on ${job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'the scheduled date'}.`,
            },
          });
        }
      } else if (entityType === 'quote') {
        const quote = await storage.getQuote(entityId, userId);
        if (!quote) {
          return res.status(404).json({ error: "Quote not found" });
        }
        
        const client = quote.clientId ? await storage.getClient(quote.clientId, userId) : null;
        const jobs = await storage.getJobs(userId);
        const linkedJob = jobs.find((j: any) => j.quoteId === quote.id || quote.jobId === j.id);
        
        const clientEmail = client?.email;
        const clientName = client?.name || 'Client';
        
        if (quote.status === 'accepted') {
          if (!linkedJob) {
            actions.push({
              id: 'create_job',
              type: 'create_job',
              title: 'Create Job',
              description: 'Schedule the work',
              icon: 'job',
              status: 'suggested',
              enabled: true,
              preview: {
                recipient: clientName,
              },
              aiSuggestion: 'Create job with details from this quote',
            });
          }
          
          if (clientEmail) {
            actions.push({
              id: 'send_acceptance_confirmation',
              type: 'send_email',
              title: 'Confirm Acceptance',
              description: 'Thank client for accepting',
              icon: 'email',
              status: 'suggested',
              enabled: true,
              preview: {
                recipient: clientEmail,
                subject: `Quote Accepted - ${quote.title}`,
                message: `G'day ${clientName.split(' ')[0]},\n\nThanks for accepting the quote! We'll be in touch to schedule the work.\n\nCheers`,
              },
            });
          }
        }
        
        if (quote.status === 'draft' || quote.status === 'sent') {
          if (clientEmail) {
            actions.push({
              id: 'send_quote_email',
              type: 'send_email',
              title: 'Send Quote',
              description: `Email quote to ${clientName}`,
              icon: 'email',
              status: 'suggested',
              enabled: quote.status === 'draft',
              preview: {
                recipient: clientEmail,
                subject: `Quote #${quote.number} - ${quote.title}`,
                message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your quote for "${quote.title}".\n\nTotal: $${parseFloat(quote.total || '0').toFixed(2)}\n\nCheers`,
                amount: `$${parseFloat(quote.total || '0').toFixed(2)}`,
              },
              aiSuggestion: 'PDF will be auto-attached via Gmail',
            });
          }
          
          actions.push({
            id: 'schedule_followup',
            type: 'schedule_reminder',
            title: 'Follow-up Reminder',
            description: 'Remind me if no response in 3 days',
            icon: 'reminder',
            status: 'suggested',
            enabled: false,
            preview: {
              scheduledFor: '3 days from now',
            },
          });
        }
      } else if (entityType === 'invoice') {
        const invoice = await storage.getInvoice(entityId, userId);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        
        const client = invoice.clientId ? await storage.getClient(invoice.clientId, userId) : null;
        
        const clientEmail = client?.email;
        const clientPhone = client?.phone;
        const clientName = client?.name || 'Client';
        
        if (invoice.status === 'draft' || invoice.status === 'sent') {
          if (clientEmail) {
            actions.push({
              id: 'send_invoice_email',
              type: 'send_email',
              title: invoice.status === 'draft' ? 'Send Invoice' : 'Resend Invoice',
              description: `Email to ${clientName}`,
              icon: 'email',
              status: 'suggested',
              enabled: invoice.status === 'draft',
              preview: {
                recipient: clientEmail,
                subject: `Invoice #${invoice.number} - ${invoice.title}`,
                message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your invoice for "${invoice.title}".\n\nTotal: $${parseFloat(invoice.total || '0').toFixed(2)}\n\nCheers`,
                amount: `$${parseFloat(invoice.total || '0').toFixed(2)}`,
              },
              aiSuggestion: 'PDF and payment link will be included',
            });
          }
          
          if (invoice.status === 'sent') {
            actions.push({
              id: 'send_reminder',
              type: 'schedule_reminder',
              title: 'Payment Reminder',
              description: 'Send friendly payment reminder',
              icon: 'reminder',
              status: 'suggested',
              enabled: false,
              preview: {
                recipient: clientEmail || clientPhone || clientName,
                message: `Just a friendly reminder that invoice #${invoice.number} is due. Pay online: [link]`,
              },
            });
          }
          
          if (clientPhone) {
            actions.push({
              id: 'send_sms_reminder',
              type: 'send_sms',
              title: 'SMS Reminder',
              description: 'Text payment reminder',
              icon: 'sms',
              status: 'suggested',
              enabled: false,
              preview: {
                recipient: clientPhone,
                message: `Hi! Just a reminder about invoice #${invoice.number}. Pay online: [link]`,
              },
            });
          }
        }
        
        if (invoice.status === 'sent' || invoice.status === 'overdue') {
          actions.push({
            id: 'mark_paid',
            type: 'mark_paid',
            title: 'Mark as Paid',
            description: 'Record cash/bank payment',
            icon: 'payment',
            status: 'suggested',
            enabled: false,
            preview: {
              amount: `$${parseFloat(invoice.total || '0').toFixed(2)}`,
            },
          });
        }
      }
      
      res.json({
        entityType,
        entityId,
        actions,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching smart actions:", error);
      res.status(500).json({ error: "Failed to fetch smart actions" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const userContext = req.userContext;
      
      const job = await storage.getJob(req.params.id, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Staff tradies can only view their assigned jobs
      const hasViewAll = userContext?.permissions?.includes('view_all') || userContext?.isOwner;
      if (!hasViewAll && userContext?.teamMemberId) {
        // Check if job is assigned to this team member (by member ID or user ID)
        const isAssigned = job.assignedTo === userContext.teamMemberId || 
                          job.assignedTo === req.userId ||
                          job.assignedTeamMemberId === userContext.teamMemberId;
        if (!isAssigned) {
          return res.status(403).json({ error: "You can only view your assigned jobs" });
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Get linked documents (quote, invoice, receipts) for a specific job
  // This is a dedicated efficient endpoint for job detail views
  app.get("/api/jobs/:id/linked-documents", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobId = req.params.id;
      
      // Verify job exists and user has access
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Fetch all quotes, invoices, and receipts, then filter for this job
      const [quotes, invoices, receiptsForJob] = await Promise.all([
        storage.getQuotes(effectiveUserId),
        storage.getInvoices(effectiveUserId),
        storage.getReceiptsForJob(jobId, effectiveUserId)
      ]);
      
      // Find linked quote (most recent if multiple)
      const linkedQuotes = quotes.filter((q: any) => q.jobId === jobId);
      const linkedQuote = linkedQuotes.length > 0 ? linkedQuotes[linkedQuotes.length - 1] : null;
      
      // Find linked invoice (most recent if multiple)
      const linkedInvoices = invoices.filter((i: any) => i.jobId === jobId);
      const linkedInvoice = linkedInvoices.length > 0 ? linkedInvoices[linkedInvoices.length - 1] : null;
      
      res.json({
        linkedQuote: linkedQuote ? {
          id: linkedQuote.id,
          number: linkedQuote.number,
          quoteNumber: linkedQuote.number, // Alias for backward compatibility
          title: linkedQuote.title,
          status: linkedQuote.status,
          total: linkedQuote.total,
          createdAt: linkedQuote.createdAt,
        } : null,
        linkedInvoice: linkedInvoice ? {
          id: linkedInvoice.id,
          number: linkedInvoice.number,
          invoiceNumber: linkedInvoice.number, // Alias for backward compatibility
          title: linkedInvoice.title,
          status: linkedInvoice.status,
          total: linkedInvoice.total,
          dueDate: linkedInvoice.dueDate,
          paidAt: linkedInvoice.paidAt,
          createdAt: linkedInvoice.createdAt,
        } : null,
        // Include receipts array (all receipts for this job)
        linkedReceipts: receiptsForJob.map((r: any) => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          amount: r.amount,
          gstAmount: r.gstAmount,
          paymentMethod: r.paymentMethod,
          paidAt: r.paidAt,
          pdfUrl: r.pdfUrl,
          createdAt: r.createdAt,
        })),
        // Include counts for UI
        quoteCount: linkedQuotes.length,
        invoiceCount: linkedInvoices.length,
        receiptCount: receiptsForJob.length,
      });
    } catch (error) {
      console.error("Error fetching linked documents:", error);
      res.status(500).json({ error: "Failed to fetch linked documents" });
    }
  });

  // Get activity history for a specific job
  // Returns all activity logs related to this job (job events + linked quote/invoice events)
  app.get("/api/jobs/:id/activity", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobId = req.params.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      // Verify job exists and user has access
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get all activity logs for this user, then filter for job-related ones
      const allActivityLogs = await storage.getActivityLogs(effectiveUserId, 100);
      
      // Filter for activities related to this job
      const jobActivities = allActivityLogs.filter((log: any) => {
        // Direct job activities
        if (log.entityType === 'job' && log.entityId === jobId) {
          return true;
        }
        // Activities with jobId in metadata (quote/invoice linked to this job)
        if (log.metadata && (log.metadata as any).jobId === jobId) {
          return true;
        }
        return false;
      }).slice(0, limit);
      
      // Map to activity items with proper structure
      const activities = jobActivities.map((log: any) => ({
        id: log.id,
        type: log.type,
        title: log.title,
        description: log.description || '',
        timestamp: log.createdAt,
        status: log.metadata?.status || 'success',
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
      }));
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching job activity:", error);
      res.status(500).json({ error: "Failed to fetch job activity" });
    }
  });

  app.post("/api/jobs", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      
      // Check freemium limits first
      const limitCheck = await FreemiumService.canUserCreateJob(effectiveUserId);
      if (!limitCheck.canCreate) {
        return res.status(402).json({ 
          error: limitCheck.reason,
          type: 'SUBSCRIPTION_LIMIT',
          usageInfo: limitCheck.usageInfo
        });
      }

      // Preprocess date fields from ISO strings to Date objects (mobile sends strings)
      const body = { ...req.body };
      if (body.scheduledAt && typeof body.scheduledAt === 'string') {
        body.scheduledAt = new Date(body.scheduledAt);
      }
      if (body.completedAt && typeof body.completedAt === 'string') {
        body.completedAt = new Date(body.completedAt);
      }
      if (body.startedAt && typeof body.startedAt === 'string') {
        body.startedAt = new Date(body.startedAt);
      }

      const data = insertJobSchema.parse(body);
      
      // Validate job assignment RBAC if assignedTo is provided
      if (data.assignedTo) {
        const userContext = req.userContext || await getUserContext(req.userId);
        const assignmentCheck = await canAssignJobTo(userContext, data.assignedTo);
        if (!assignmentCheck.allowed) {
          return res.status(403).json({ 
            error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
            code: "ASSIGNMENT_NOT_ALLOWED"
          });
        }
      }
      
      // Auto-geocode address if provided but lat/lng missing
      let jobData = { ...data, userId: effectiveUserId };
      if (data.address && (!data.latitude || !data.longitude)) {
        const geocoded = await geocodeAddress(data.address);
        if (geocoded) {
          jobData.latitude = geocoded.latitude.toString();
          jobData.longitude = geocoded.longitude.toString();
          console.log(`[Geocoding] Job address "${data.address}" -> ${geocoded.latitude}, ${geocoded.longitude}`);
        }
      }
      
      const job = await storage.createJob(jobData);
      
      // Increment job count after successful creation
      await FreemiumService.incrementJobCount(effectiveUserId);
      
      // Log activity for dashboard feed
      const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
      await logActivity(
        effectiveUserId,
        'job_created',
        `New job created: ${job.title}`,
        client ? `Client: ${client.name}` : null,
        'job',
        job.id,
        { jobTitle: job.title, clientName: client?.name, status: job.status }
      );
      
      // Auto-sync to Google Calendar if user is connected and job is scheduled
      if (job.scheduledAt) {
        try {
          const { syncJobToCalendar, isGoogleCalendarConnected } = await import('./googleCalendarClient');
          const connected = await isGoogleCalendarConnected(effectiveUserId);
          if (connected) {
            const result = await syncJobToCalendar(effectiveUserId, {
              id: job.id,
              title: job.title,
              description: job.description,
              notes: job.notes,
              address: job.address,
              scheduledAt: new Date(job.scheduledAt),
              estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
              clientName: client?.name,
              clientPhone: client?.phone || undefined,
              clientEmail: client?.email || undefined,
              status: job.status,
              calendarEventId: null
            });
            // Update job with calendar event ID
            await storage.updateJob(job.id, effectiveUserId, { calendarEventId: result.eventId });
            console.log(`[GoogleCalendar] Auto-synced new job ${job.id} to calendar for user ${effectiveUserId}`);
          }
        } catch (calendarError) {
          console.error('[GoogleCalendar] Auto-sync failed for new job:', calendarError);
          // Don't fail job creation if calendar sync fails
        }
      }
      
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating job:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      
      // Debug logging for job update - track assignedTo persistence
      console.log('[PATCH /api/jobs/:id] Request body received:', JSON.stringify(req.body, null, 2));
      console.log('[PATCH /api/jobs/:id] Job ID:', req.params.id);
      console.log('[PATCH /api/jobs/:id] assignedTo value in request:', req.body.assignedTo);
      
      // Preprocess date fields from ISO strings to Date objects (mobile sends strings)
      const body = { ...req.body };
      if (body.scheduledAt && typeof body.scheduledAt === 'string') {
        body.scheduledAt = new Date(body.scheduledAt);
      }
      if (body.completedAt && typeof body.completedAt === 'string') {
        body.completedAt = new Date(body.completedAt);
      }
      if (body.startedAt && typeof body.startedAt === 'string') {
        body.startedAt = new Date(body.startedAt);
      }
      
      const data = insertJobSchema.partial().parse(body);
      console.log('[PATCH /api/jobs/:id] Parsed data after validation:', JSON.stringify(data, null, 2));
      
      const existingJob = await storage.getJob(req.params.id, effectiveUserId);
      
      // Validate: Can't set status to "invoiced" without a linked invoice
      if (data.status === 'invoiced' && existingJob?.status !== 'invoiced') {
        const invoices = await storage.getInvoices(effectiveUserId);
        const linkedInvoice = invoices.find((inv: any) => inv.jobId === req.params.id);
        if (!linkedInvoice) {
          return res.status(400).json({ 
            error: "Cannot mark job as invoiced without creating an invoice first. Please create an invoice for this job.",
            code: "INVOICE_REQUIRED"
          });
        }
      }
      
      // Validate job assignment RBAC: Manager can only assign to workers, not to other managers or owner
      if (data.assignedTo && data.assignedTo !== existingJob?.assignedTo) {
        const userContext = req.userContext || await getUserContext(req.userId);
        const assignmentCheck = await canAssignJobTo(userContext, data.assignedTo);
        if (!assignmentCheck.allowed) {
          return res.status(403).json({ 
            error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
            code: "ASSIGNMENT_NOT_ALLOWED"
          });
        }
      }
      
      // Auto-geocode if address changed (always re-geocode when address changes)
      let updateData = { ...data };
      if (data.address && data.address !== existingJob?.address) {
        const geocoded = await geocodeAddress(data.address);
        if (geocoded) {
          updateData.latitude = geocoded.latitude.toString();
          updateData.longitude = geocoded.longitude.toString();
          console.log(`[Geocoding] Updated job address "${data.address}" -> ${geocoded.latitude}, ${geocoded.longitude}`);
        }
      }
      
      // Auto-set stage timestamps when status changes
      if (data.status && existingJob && data.status !== existingJob.status) {
        const now = new Date();
        if (data.status === 'in_progress' && !existingJob.startedAt) {
          updateData.startedAt = now;
        } else if (data.status === 'done' && !existingJob.completedAt) {
          updateData.completedAt = now;
        } else if (data.status === 'invoiced' && !existingJob.invoicedAt) {
          updateData.invoicedAt = now;
        }
        // Clear timestamps if going back to earlier status (allow rollback)
        if (data.status === 'pending') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'scheduled') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'in_progress') {
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (data.status === 'done') {
          updateData.invoicedAt = null;
        }
      }
      
      // Debug logging for updateData before saving
      console.log('[PATCH /api/jobs/:id] updateData being saved:', JSON.stringify(updateData, null, 2));
      console.log('[PATCH /api/jobs/:id] assignedTo in updateData:', updateData.assignedTo);
      
      const job = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Create notifications and log activity for status changes
      if (data.status && existingJob && data.status !== existingJob.status) {
        const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
        const clientName = client?.name || 'Unknown client';

        if (data.status === 'scheduled') {
          await notifyJobScheduled(storage, effectiveUserId, job, clientName);
          await logActivity(effectiveUserId, 'job_scheduled', `Job scheduled: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else if (data.status === 'in_progress') {
          await notifyJobStarted(storage, effectiveUserId, job, clientName);
          await logActivity(effectiveUserId, 'job_started', `Job started: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else if (data.status === 'done') {
          await notifyJobCompleted(storage, effectiveUserId, job, { firstName: 'You', username: 'You' });
          await logActivity(effectiveUserId, 'job_completed', `Job completed: ${job.title}`, `Client: ${clientName}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        } else {
          await logActivity(effectiveUserId, 'job_status_changed', `Job status updated: ${job.title}`, `${existingJob.status} → ${data.status}`, 'job', job.id, { jobTitle: job.title, clientName, oldStatus: existingJob.status, newStatus: data.status });
        }
      }
      
      // Auto-sync to Google Calendar if user is connected and job has schedule changes
      const scheduleChanged = data.scheduledAt || data.title || data.address || data.description || data.notes || data.status;
      if (scheduleChanged && job.scheduledAt) {
        try {
          const { syncJobToCalendar, isGoogleCalendarConnected } = await import('./googleCalendarClient');
          const connected = await isGoogleCalendarConnected(effectiveUserId);
          if (connected) {
            const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
            const result = await syncJobToCalendar(effectiveUserId, {
              id: job.id,
              title: job.title,
              description: job.description,
              notes: job.notes,
              address: job.address,
              scheduledAt: new Date(job.scheduledAt),
              estimatedDuration: job.estimatedDuration ? job.estimatedDuration / 60 : 2,
              clientName: client?.name,
              clientPhone: client?.phone || undefined,
              clientEmail: client?.email || undefined,
              status: job.status,
              calendarEventId: job.calendarEventId
            });
            // Update job with calendar event ID if new
            if (result.eventId !== job.calendarEventId) {
              await storage.updateJob(job.id, effectiveUserId, { calendarEventId: result.eventId });
            }
            console.log(`[GoogleCalendar] Auto-synced updated job ${job.id} to calendar for user ${effectiveUserId}`);
          }
        } catch (calendarError) {
          console.error('[GoogleCalendar] Auto-sync failed for job update:', calendarError);
          // Don't fail job update if calendar sync fails
        }
      }

      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // Staff-specific endpoint to update job status (on assigned jobs only)
  // This allows staff tradies to mark their jobs as in_progress or done
  app.patch("/api/jobs/:id/status", requireAuth, async (req: any, res) => {
    try {
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      
      // Validate status value
      const validStatuses = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      // Prevent staff from setting status to "invoiced" - only owners/managers can do this after creating invoice
      if (status === 'invoiced') {
        return res.status(403).json({ 
          error: "Staff cannot mark jobs as invoiced. Only owners or managers can do this after creating an invoice.",
          code: "PERMISSION_DENIED"
        });
      }
      
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      // Get the job
      const existingJob = await storage.getJob(req.params.id, effectiveUserId);
      if (!existingJob) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Check if user is owner/manager OR assigned to this job
      const businessSettings = await storage.getBusinessSettings(effectiveUserId);
      const isOwner = businessSettings && businessSettings.userId === req.userId;
      
      let isManager = false;
      if (!isOwner) {
        const teamMemberInfo = await storage.getTeamMemberByUserIdAndBusiness(req.userId, effectiveUserId);
        if (teamMemberInfo && teamMemberInfo.roleId) {
          const role = await storage.getUserRole(teamMemberInfo.roleId);
          isManager = role?.name?.toLowerCase().includes('manager') || 
                      role?.name?.toLowerCase().includes('admin') || false;
        }
      }
      
      const isAssigned = existingJob.assignedTo === req.userId;
      
      // Staff can only update status on their assigned jobs
      if (!isOwner && !isManager && !isAssigned) {
        return res.status(403).json({ error: "You can only update status on jobs assigned to you" });
      }
      
      // Build update data with stage timestamps
      const now = new Date();
      const updateData: any = { status };
      
      // Auto-set stage timestamps when status changes
      if (status !== existingJob.status) {
        if (status === 'in_progress' && !existingJob.startedAt) {
          updateData.startedAt = now;
        } else if (status === 'done' && !existingJob.completedAt) {
          updateData.completedAt = now;
        } else if (status === 'invoiced' && !existingJob.invoicedAt) {
          updateData.invoicedAt = now;
        }
        // Clear timestamps if going back to earlier status
        if (status === 'pending' || status === 'scheduled') {
          updateData.startedAt = null;
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (status === 'in_progress') {
          updateData.completedAt = null;
          updateData.invoicedAt = null;
        } else if (status === 'done') {
          updateData.invoicedAt = null;
        }
      }
      
      // Update job status with timestamps
      const job = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get user info for notifications
      const user = await storage.getUser(req.userId);
      const userName = user?.firstName || user?.username || 'Team member';
      
      // Create notifications for status changes (notify owner/manager)
      if (status !== existingJob.status) {
        const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
        const clientName = client?.name || 'Unknown client';
        
        if (status === 'in_progress') {
          await notifyJobStarted(storage, effectiveUserId, job, clientName);
        } else if (status === 'done') {
          // Notify business owner that staff completed the job
          await notifyJobCompleted(storage, effectiveUserId, job, { firstName: userName, username: userName });
          
          // Send email to owner when staff completes job
          try {
            const owner = await storage.getUser(effectiveUserId);
            
            if (owner?.email && req.userId !== effectiveUserId) {
              // Only send email if staff (not owner) completed the job
              await sendJobCompletionNotificationEmail(
                owner.email,
                owner.firstName || null,
                userName,
                job.title,
                clientName,
                new Date(),
                getProductionBaseUrl(req),
                job.id
              );
            }
          } catch (emailError) {
            console.error('Failed to send job completion email:', emailError);
          }
        }
        
        // Trigger automation rules for job status change
        processStatusChangeAutomation(effectiveUserId, 'job', job.id, existingJob.status, status)
          .catch(err => console.error('[Automations] Error processing job status change:', err));
        
        // Send push notification for job status change
        try {
          const statusDescription = status === 'in_progress' ? 'started' : 
                                   status === 'done' ? 'completed' : 
                                   status === 'invoiced' ? 'invoiced' : 
                                   `changed to ${status}`;
          
          // Notify job owner if status changed by someone else
          if (req.userId !== effectiveUserId) {
            await notifyJobUpdate(effectiveUserId, job.title, job.id, statusDescription);
            console.log(`[PushNotification] Sent job update notification to owner ${effectiveUserId}`);
          }
          
          // Notify assignee if they exist and are different from who made the change
          // Resolve assignedTo to proper user ID (it may be a team member record ID)
          const assigneeUserId = await resolveAssigneeUserId(job.assignedTo, effectiveUserId);
          if (assigneeUserId && assigneeUserId !== req.userId && assigneeUserId !== effectiveUserId) {
            await notifyJobUpdate(assigneeUserId, job.title, job.id, statusDescription);
            console.log(`[PushNotification] Sent job update notification to assignee ${assigneeUserId}`);
          }
        } catch (pushError) {
          console.error('[PushNotification] Error sending job status update notification:', pushError);
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  // Assign job to team member (for team owners/managers)
  // Also supports unassigning by passing assignedTo: null
  app.post("/api/jobs/:id/assign", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { assignedTo } = req.body;
      
      // Allow null for unassigning jobs
      if (assignedTo === null || assignedTo === undefined) {
        // Unassign the job - only owners/managers can do this
        if (!userContext.isOwner && !userContext.hasViewAll) {
          return res.status(403).json({ error: "You don't have permission to unassign jobs" });
        }
        
        const job = await storage.updateJob(req.params.id, userContext.effectiveUserId, { 
          assignedTo: null
        });
        
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        
        return res.json(job);
      }
      
      // Validate job assignment RBAC: Owner assigns to anyone, Manager assigns to workers only
      const assignmentCheck = await canAssignJobTo(userContext, assignedTo);
      if (!assignmentCheck.allowed) {
        return res.status(403).json({ 
          error: assignmentCheck.reason || "You don't have permission to assign this job to that team member",
          code: "ASSIGNMENT_NOT_ALLOWED"
        });
      }
      
      // Verify the assignee is a valid team member (or the owner)
      // Note: assignedTo can be either memberId (team_members.member_id) or userId (users.id)
      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      const validAssignee = teamMembers.find(m => 
        (m.memberId === assignedTo || m.userId === assignedTo) && 
        m.inviteStatus === 'accepted'
      );
      const isAssigningToOwner = assignedTo === userContext.businessOwnerId || assignedTo === userContext.effectiveUserId;
      
      if (!validAssignee && !isAssigningToOwner) {
        return res.status(400).json({ error: "Invalid team member for assignment" });
      }
      
      // Update the job with the assignedTo field
      const job = await storage.updateJob(req.params.id, userContext.effectiveUserId, { 
        assignedTo,
        status: 'scheduled' // Auto-schedule when assigned
      });
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Resolve assignedTo to proper user ID for notifications
      // (assignedTo may be a team member record ID or a user ID)
      const assigneeUserId = await resolveAssigneeUserId(assignedTo, userContext.effectiveUserId) || assignedTo;
      
      // Create notification for the assigned team member
      await storage.createNotification({
        userId: assigneeUserId,
        type: 'job_assigned',
        title: 'New Job Assigned',
        message: `You have been assigned to: ${job.title}`,
        relatedId: job.id,
        relatedType: 'job',
      });
      
      // Send push notification to assigned team member
      await notifyJobAssigned(assigneeUserId, job.title, job.id);
      
      // Send email notification to assigned team member
      try {
        const assigneeUser = await storage.getUser(assigneeUserId);
        const assigner = await storage.getUser(req.userId);
        
        if (assigneeUser?.email) {
          await sendJobAssignmentEmail(
            assigneeUser.email,
            assigneeUser.firstName || null,
            assigner?.firstName || 'Your manager',
            businessSettings?.businessName || 'TradieTrack',
            job.title,
            (job as any).address || null,
            (job as any).scheduledDate || null,
            getProductionBaseUrl(req),
            job.id
          );
        }
      } catch (emailError) {
        console.error('Failed to send job assignment email:', emailError);
        // Don't fail if email fails
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("Error assigning job:", error);
      res.status(500).json({ error: error.message || "Failed to assign job" });
    }
  });

  // Send job confirmation email (team-aware)
  app.post("/api/jobs/:id/send-confirmation", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ error: "Client has no email address" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId) || {
        businessName: 'Business',
        abn: '',
        address: '',
        phone: '',
        email: '',
        brandColor: '#2563eb'
      };

      await sendJobConfirmationEmail(job, client, business);
      res.json({ success: true, message: 'Job confirmation email sent successfully' });
    } catch (error: any) {
      console.error("Error sending job confirmation email:", error);
      res.status(500).json({ error: error.message || "Failed to send job confirmation email" });
    }
  });

  // Send "On My Way" notification to client
  app.post("/api/jobs/:id/on-my-way", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.phone) {
        return res.status(400).json({ error: "Client has no phone number for SMS notification" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = business?.businessName || 'Your tradesperson';
      const user = await storage.getUser(req.userId);
      const tradieName = user?.firstName || businessName;

      const message = `Hi ${client.firstName || 'there'}, ${tradieName} from ${businessName} is on the way to your job at ${job.address || 'your location'}. ETA approximately 15-20 minutes.`;
      
      // Send SMS via shared Twilio client (supports connector and env vars)
      const smsResult = await sendSMS({
        to: client.phone,
        message: message
      });

      // Log activity - handles both real SMS and demo mode
      await logActivity(
        userContext.effectiveUserId,
        'job_started',
        `On My Way - ${job.title || 'Job'}`,
        smsResult.simulated 
          ? `On My Way notification logged (SMS not configured) for ${client.firstName || client.email || 'client'}`
          : `On My Way SMS sent to ${client.firstName || client.email || 'client'} at ${client.phone}`,
        'job',
        job.id,
        { 
          clientName: client.firstName, 
          clientPhone: client.phone,
          demoMode: smsResult.simulated || false
        }
      );

      if (!smsResult.success && !smsResult.simulated) {
        return res.status(500).json({ error: `Failed to send SMS: ${smsResult.error || 'Unknown error'}` });
      }

      res.json({ 
        success: true, 
        message: smsResult.simulated ? 'On My Way logged (SMS not configured)' : 'On My Way notification sent',
        demoMode: smsResult.simulated || false
      });
    } catch (error: any) {
      console.error("Error sending on-my-way notification:", error);
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  // Send "Running Late" notification to client
  app.post("/api/jobs/:id/running-late", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.phone) {
        return res.status(400).json({ error: "Client has no phone number for SMS notification" });
      }

      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = business?.businessName || 'Your tradesperson';
      const user = await storage.getUser(req.userId);
      const tradieName = user?.firstName || businessName;

      const message = `Hi ${client.firstName || 'there'}, ${tradieName} from ${businessName} here. Running a bit late for your job at ${job.address || 'your location'}. Apologies for the delay - will be there as soon as possible.`;
      
      // Send SMS via shared Twilio client (supports connector and env vars)
      const smsResult = await sendSMS({
        to: client.phone,
        message: message
      });

      // Log activity - handles both real SMS and demo mode
      await logActivity(
        userContext.effectiveUserId,
        'job_started',
        `Running Late - ${job.title || 'Job'}`,
        smsResult.simulated 
          ? `Running Late notification logged (SMS not configured) for ${client.firstName || client.email || 'client'}`
          : `Running Late SMS sent to ${client.firstName || client.email || 'client'} at ${client.phone}`,
        'job',
        job.id,
        { 
          clientName: client.firstName, 
          clientPhone: client.phone,
          demoMode: smsResult.simulated || false
        }
      );

      if (!smsResult.success && !smsResult.simulated) {
        return res.status(500).json({ error: `Failed to send SMS: ${smsResult.error || 'Unknown error'}` });
      }

      res.json({ 
        success: true, 
        message: smsResult.simulated ? 'Running Late logged (SMS not configured)' : 'Running Late notification sent',
        demoMode: smsResult.simulated || false
      });
    } catch (error: any) {
      console.error("Error sending running-late notification:", error);
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });

  // Quick Collect Payment - collect payment at job site without full invoice workflow
  app.post("/api/jobs/:id/quick-collect", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { quoteId, paymentMethod, amount, notes } = req.body;
      
      // Validate inputs
      if (!quoteId || !paymentMethod || !amount) {
        return res.status(400).json({ error: "Missing required fields: quoteId, paymentMethod, amount" });
      }
      
      const validMethods = ['cash', 'card', 'bank_transfer', 'stripe_link'];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: "Invalid payment method" });
      }

      // Get the job
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get the quote
      const quote = await storage.getQuote(quoteId, userContext.effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Verify quote is accepted
      if (quote.status !== 'accepted') {
        return res.status(400).json({ error: "Only accepted quotes can be used for quick payment" });
      }

      // Get client
      const client = await storage.getClient(quote.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Handle Stripe payment link flow
      if (paymentMethod === 'stripe_link') {
        // For stripe_link, create a payment request and send it
        try {
          const paymentRequest = await storage.createPaymentRequest({
            clientId: client.id,
            amount: amount,
            type: 'payment_link',
            status: 'pending',
            notes: notes || `Quick payment for ${job.title}`,
          }, userContext.effectiveUserId);

          // Create Stripe payment link if Stripe is available
          if (isStripeInitialized()) {
            const stripe = getUncachableStripeClient();
            const host = req.get('host') || 'localhost';
            const protocol = req.get('x-forwarded-proto') || (host.includes('replit') ? 'https' : 'http');
            
            const session = await stripe.checkout.sessions.create({
              mode: 'payment',
              line_items: [{
                price_data: {
                  currency: 'aud',
                  product_data: {
                    name: job.title || 'Job Payment',
                    description: `Payment for ${job.title}${job.address ? ` at ${job.address}` : ''}`,
                  },
                  unit_amount: Math.round(parseFloat(amount) * 100),
                },
                quantity: 1,
              }],
              success_url: `${protocol}://${host}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${protocol}://${host}/jobs/${job.id}`,
              metadata: {
                jobId: job.id,
                quoteId: quote.id,
                clientId: client.id,
                paymentRequestId: paymentRequest.id,
                quickCollect: 'true',
              },
            });

            // Update payment request with Stripe link
            await storage.updatePaymentRequest(paymentRequest.id, {
              paymentLink: session.url,
              stripeSessionId: session.id,
            }, userContext.effectiveUserId);

            // Send SMS with payment link if client has phone
            if (client.phone) {
              const business = await storage.getBusinessSettings(userContext.effectiveUserId);
              const message = `Hi ${client.firstName || 'there'}, here's your payment link for ${job.title || 'your recent job'} from ${business?.businessName || 'your tradesperson'}: ${session.url}. Amount: $${parseFloat(amount).toFixed(2)}`;
              await sendSMS({ to: client.phone, message });
            }

            return res.json({
              success: true,
              paymentLinkSent: true,
              paymentRequestId: paymentRequest.id,
              paymentLink: session.url,
            });
          } else {
            return res.status(400).json({ error: "Stripe is not configured for payment links" });
          }
        } catch (stripeError: any) {
          console.error("Stripe payment link error:", stripeError);
          return res.status(500).json({ error: `Failed to create payment link: ${stripeError.message}` });
        }
      }

      // For immediate payment methods (cash, card, bank_transfer), create invoice + receipt
      const parsedAmount = parseFloat(amount);
      const gstRate = 0.10; // Australian GST
      const gstAmount = parsedAmount - (parsedAmount / (1 + gstRate));
      const subtotal = parsedAmount - gstAmount;

      // Get quote line items to copy to invoice
      const quoteLineItems = await storage.getQuoteLineItems(quoteId);

      // Generate invoice number
      const existingInvoices = await storage.getInvoices(userContext.effectiveUserId);
      const year = new Date().getFullYear();
      const invoiceCount = existingInvoices.length + 1;
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const invoiceNumber = `INV${year}-${String(invoiceCount).padStart(3, '0')}-${randomSuffix}`;

      // Create invoice marked as paid
      const invoice = await storage.createInvoice({
        clientId: client.id,
        jobId: job.id,
        quoteId: quote.id,
        number: invoiceNumber,
        title: job.title || 'Job Payment',
        description: notes || `Quick payment collected for ${job.title}`,
        status: 'paid',
        subtotal: subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: parsedAmount.toFixed(2),
        dueDate: new Date(),
        sentAt: new Date(),
        paidAt: new Date(),
      }, userContext.effectiveUserId);

      // Copy line items from quote to invoice
      for (const item of quoteLineItems) {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: item.unitPrice,
          total: item.total,
        }, userContext.effectiveUserId);
      }

      // Generate receipt number
      const existingReceipts = await storage.getReceipts(userContext.effectiveUserId);
      const receiptCount = existingReceipts.length + 1;
      const receiptNumber = `REC-${String(receiptCount).padStart(6, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

      // Create receipt
      const receipt = await storage.createReceipt({
        invoiceId: invoice.id,
        clientId: client.id,
        receiptNumber: receiptNumber,
        amount: parsedAmount.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        paymentMethod: paymentMethod,
        paidAt: new Date(),
        notes: notes || `Quick collect at job site`,
      }, userContext.effectiveUserId);

      // Update job status to invoiced if not already
      if (job.status === 'done') {
        await storage.updateJob(job.id, {
          status: 'invoiced',
          invoicedAt: new Date(),
        }, userContext.effectiveUserId);
      }

      // Log activity
      await logActivity(
        userContext.effectiveUserId,
        'payment_received',
        `Quick Payment Collected - ${job.title || 'Job'}`,
        `$${parsedAmount.toFixed(2)} collected via ${paymentMethod} for ${client.firstName || client.email || 'client'}`,
        'invoice',
        invoice.id,
        {
          jobId: job.id,
          quoteId: quote.id,
          clientName: client.firstName || client.email,
          amount: parsedAmount,
          paymentMethod,
          quickCollect: true,
        }
      );

      res.json({
        success: true,
        invoiceId: invoice.id,
        receiptId: receipt.id,
        invoiceNumber: invoice.number,
        receiptNumber: receipt.receiptNumber,
        amount: parsedAmount,
      });
    } catch (error: any) {
      console.error("Error in quick collect payment:", error);
      res.status(500).json({ error: error.message || "Failed to collect payment" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      // Use effectiveUserId (business owner's ID) for multi-tenant data scoping
      const effectiveUserId = req.effectiveUserId || req.userId;
      const success = await storage.deleteJob(req.params.id, effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Checklist Items (team-aware)
  app.get("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const items = await storage.getChecklistItems(req.params.jobId, userContext.effectiveUserId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching checklist items:", error);
      res.status(500).json({ error: "Failed to fetch checklist items" });
    }
  });

  app.post("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const data = insertChecklistItemSchema.parse({
        ...req.body,
        jobId: req.params.jobId
      });
      const item = await storage.createChecklistItem(data, userContext.effectiveUserId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid checklist item data", details: error.errors });
      }
      if (error instanceof Error && error.message === "Job not found or access denied") {
        return res.status(404).json({ error: "Job not found" });
      }
      console.error("Error creating checklist item:", error);
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  app.patch("/api/checklist/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const updates = updateChecklistItemSchema.partial().parse(req.body);
      const item = await storage.updateChecklistItem(req.params.id, userContext.effectiveUserId, updates);
      if (!item) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid checklist item data", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("Invalid sortOrder")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating checklist item:", error);
      res.status(500).json({ error: "Failed to update checklist item" });
    }
  });

  app.delete("/api/checklist/:id", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteChecklistItem(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting checklist item:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  // Get jobs for client (team-aware)
  app.get("/api/clients/:clientId/jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobsForClient(req.params.clientId, userContext.effectiveUserId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs for client:", error);
      res.status(500).json({ error: "Failed to fetch jobs for client" });
    }
  });

  // Quotes Routes (team-aware: use effectiveUserId for proper data scoping)
  app.get("/api/quotes", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const includeArchived = req.query.archived === 'true';
      const [quotes, clients] = await Promise.all([
        storage.getQuotes(userContext.effectiveUserId, includeArchived),
        storage.getClients(userContext.effectiveUserId),
      ]);
      
      // Create client lookup map
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      
      // Enrich quotes with client data
      const enrichedQuotes = quotes.map((quote: any) => {
        const client = clientsMap.get(quote.clientId);
        return {
          ...quote,
          clientName: client?.name || 'Unknown Client',
          clientEmail: client?.email || null,
        };
      });
      
      res.json(enrichedQuotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Archive/Unarchive quote (team-aware)
  app.post("/api/quotes/:id/archive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const quote = await storage.archiveQuote(req.params.id, userContext.effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error archiving quote:", error);
      res.status(500).json({ error: "Failed to archive quote" });
    }
  });

  app.post("/api/quotes/:id/unarchive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const quote = await storage.unarchiveQuote(req.params.id, userContext.effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error unarchiving quote:", error);
      res.status(500).json({ error: "Failed to unarchive quote" });
    }
  });

  // Accepted quotes endpoint for invoice creation workflow (team-aware)
  // Returns accepted quotes with full data (client, job, line items) for creating invoices
  app.get("/api/quotes/accepted", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const userId = userContext.effectiveUserId;
      
      // Get quotes, clients, jobs, and invoices
      const [quotes, clients, jobs, invoices] = await Promise.all([
        storage.getQuotes(userId),
        storage.getClients(userId),
        storage.getJobs(userId),
        storage.getInvoices(userId),
      ]);
      
      // Create lookup maps
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      const jobsMap = new Map(jobs.map((j: any) => [j.id, j]));
      
      // Find which quotes already have invoices linked to them
      const quotesWithInvoices = new Set(
        invoices.filter((inv: any) => inv.quoteId).map((inv: any) => inv.quoteId)
      );
      
      // Filter to accepted quotes only and clone array to avoid mutating cached data
      const acceptedQuotes = [...quotes.filter((q: any) => q.status === 'accepted')];
      
      // Sort by acceptance date (most recent first)
      acceptedQuotes.sort((a: any, b: any) => {
        const dateA = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
        const dateB = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // Enrich all accepted quotes with client, job, and line items data
      const enrichedQuotes = await Promise.all(
        acceptedQuotes.map(async (quote: any) => {
          const client = clientsMap.get(quote.clientId);
          const job = quote.jobId ? jobsMap.get(quote.jobId) : null;
          
          // Always directly fetch line items - most reliable method
          const quoteLineItems = await storage.getQuoteLineItems(quote.id);
          
          // Normalize line items to consistent format with strings
          // Check both quantity and qty for legacy compatibility
          const lineItems = quoteLineItems.map((item: any) => ({
            id: item.id,
            description: String(item.description || ""),
            quantity: String(item.quantity ?? item.qty ?? 1),
            unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
          }));
          
          // Normalize numeric fields for consistent frontend handling
          return {
            id: quote.id,
            number: quote.number,
            title: quote.title,
            description: quote.description,
            status: quote.status,
            subtotal: String(quote.subtotal || 0),
            gstAmount: String(quote.gstAmount || 0),
            total: String(quote.total || 0),
            notes: quote.notes,
            terms: quote.terms,
            validUntil: quote.validUntil,
            acceptedAt: quote.acceptedAt,
            acceptedBy: quote.acceptedBy,
            depositRequired: quote.depositRequired,
            depositPercent: quote.depositPercent,
            depositAmount: quote.depositAmount,
            depositPaid: quote.depositPaid,
            client: client ? {
              id: client.id,
              name: client.name,
              email: client.email,
              phone: client.phone,
              address: client.address,
            } : null,
            job: job ? {
              id: job.id,
              title: job.title,
              status: job.status,
            } : null,
            lineItems,
            hasInvoice: quotesWithInvoices.has(quote.id),
          };
        })
      );
      
      res.json(enrichedQuotes);
    } catch (error) {
      console.error("Error fetching accepted quotes:", error);
      res.status(500).json({ error: "Failed to fetch accepted quotes" });
    }
  });

  // Get single quote (team-aware)
  app.get("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const quote = await storage.getQuoteWithLineItems(req.params.id, userContext.effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Include digital signature for accepted quotes
      let signature = null;
      if (quote.status === 'accepted') {
        const signatures = await db.select().from(digitalSignatures).where(
          sql`${digitalSignatures.quoteId} = ${quote.id}`
        ).orderBy(desc(digitalSignatures.signedAt)).limit(1);
        
        if (signatures.length > 0) {
          signature = {
            id: signatures[0].id,
            signerName: signatures[0].signerName,
            signatureData: signatures[0].signatureData,
            signedAt: signatures[0].signedAt,
            ipAddress: signatures[0].ipAddress,
          };
        }
      }
      
      res.json({ ...quote, signature });
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  // Create quote (team-aware)
  app.post("/api/quotes", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { lineItems, ...quoteData } = req.body;
      const data = insertQuoteSchema.parse(quoteData);
      
      // Generate quote number if not provided
      if (!data.number) {
        data.number = await storage.generateQuoteNumber(userContext.effectiveUserId);
      }
      
      const quote = await storage.createQuote({ ...data, userId: userContext.effectiveUserId });
      
      // Add line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          const lineItemData = insertQuoteLineItemSchema.parse({ ...item, quoteId: quote.id });
          await storage.createQuoteLineItem(lineItemData, userContext.effectiveUserId);
        }
      }
      
      const quoteWithItems = await storage.getQuoteWithLineItems(quote.id, userContext.effectiveUserId);
      
      // Log activity for dashboard feed
      const client = quote.clientId ? await storage.getClient(quote.clientId, userContext.effectiveUserId) : null;
      await logActivity(
        userContext.effectiveUserId,
        'quote_created',
        `Quote #${quote.number} created`,
        client ? `Client: ${client.name}` : null,
        'quote',
        quote.id,
        { quoteNumber: quote.number, clientName: client?.name, total: quote.total }
      );
      
      res.status(201).json(quoteWithItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  // Update quote (team-aware)
  app.patch("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const data = updateQuoteSchema.parse(req.body);
      const quote = await storage.updateQuote(req.params.id, userContext.effectiveUserId, data);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating quote:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  // Delete quote (team-aware)
  app.delete("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteQuote(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Generate quote from job (team-aware)
  app.post("/api/jobs/:id/generate-quote", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const job = await storage.getJob(req.params.id, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate quote number
      const quoteNumber = await storage.generateQuoteNumber(userContext.effectiveUserId);
      
      // Create quote from job data
      const quoteData = insertQuoteSchema.parse({
        clientId: job.clientId,
        jobId: job.id,
        number: quoteNumber,
        title: `Quote for ${job.title}`,
        description: job.description || '',
        status: 'draft',
        subtotal: '0.00',
        gstAmount: '0.00',
        total: '0.00'
      });

      const quote = await storage.createQuote({ ...quoteData, userId: userContext.effectiveUserId });
      const quoteWithItems = await storage.getQuoteWithLineItems(quote.id, userContext.effectiveUserId);
      
      res.status(201).json(quoteWithItems);
    } catch (error) {
      console.error("Error generating quote from job:", error);
      res.status(500).json({ error: "Failed to generate quote from job" });
    }
  });

  // Generate share token for quote (creates acceptance token without sending email)
  app.post("/api/quotes/:id/generate-share-token", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const quote = await storage.getQuote(req.params.id, userContext.effectiveUserId);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // If quote already has an acceptance token, return it
      if (quote.acceptanceToken) {
        return res.json({ acceptanceToken: quote.acceptanceToken });
      }
      
      // Generate a new acceptance token
      const { nanoid } = await import('nanoid');
      const acceptanceToken = nanoid(12);
      
      await storage.updateQuote(req.params.id, userContext.effectiveUserId, {
        acceptanceToken
      });
      
      res.json({ acceptanceToken });
    } catch (error) {
      console.error("Error generating share token:", error);
      res.status(500).json({ error: "Failed to generate share token" });
    }
  });

  // Quote actions
  app.post("/api/quotes/:id/send", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    const { handleQuoteSend } = await import('./emailRoutes');
    return handleQuoteSend(req, res, storage);
  });

  // Create Gmail draft with quote PDF automatically attached
  app.post("/api/quotes/:id/email-with-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    const { handleQuoteEmailWithPDF } = await import('./emailRoutes');
    return handleQuoteEmailWithPDF(req, res, storage);
  });

  // Send quote via SMS
  app.post("/api/quotes/:id/send-sms", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { sendSmsToClient } = await import('./services/smsService');
      const { smsTemplates } = await import('./twilioClient');
      
      const quote = await storage.getQuote(req.params.id, userContext.effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const client = await storage.getClient(quote.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (!client.phone) {
        return res.status(400).json({ error: "Client does not have a phone number. Please add a phone number to the client record." });
      }
      
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      
      // Ensure quote has acceptance token for public link
      let acceptanceToken = quote.acceptanceToken;
      if (!acceptanceToken) {
        const { nanoid } = await import('nanoid');
        acceptanceToken = nanoid(12);
        await storage.updateQuote(req.params.id, userContext.effectiveUserId, { acceptanceToken });
      }
      
      // Build public URL and message
      const publicUrl = getQuotePublicUrl(acceptanceToken, req);
      
      const message = `${smsTemplates.quoteReady(client.name, businessName, quote.number || quote.id.slice(0, 8))} View: ${publicUrl}`;
      
      // Send SMS
      const smsMessage = await sendSmsToClient({
        businessOwnerId: userContext.effectiveUserId,
        clientId: client.id,
        clientPhone: client.phone,
        clientName: client.name,
        jobId: quote.jobId || undefined,
        message,
        senderUserId: req.userId,
      });
      
      // Update quote status to sent if it was draft
      if (quote.status === 'draft') {
        await storage.updateQuote(req.params.id, userContext.effectiveUserId, {
          status: 'sent',
          sentAt: new Date(),
        });
      }
      
      // Log activity for SMS sent
      await logActivity(
        userContext.effectiveUserId,
        'quote_sent',
        `Quote ${quote.number || quote.id} sent via SMS`,
        `SMS sent to ${client.name} (${client.phone})`,
        'quote',
        quote.id,
        { deliveryMethod: 'sms', clientPhone: client.phone, smsMessageId: smsMessage.id }
      );
      
      res.json({ 
        success: true, 
        message: `Quote SMS sent to ${client.phone}`,
        smsMessageId: smsMessage.id,
        publicUrl,
      });
    } catch (error: any) {
      console.error("Error sending quote SMS:", error);
      res.status(500).json({ error: error.message || "Failed to send quote SMS" });
    }
  });

  // Accept quote (team-aware) - Enhanced to update linked job and log activity
  app.post("/api/quotes/:id/accept", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      // Get existing quote for status comparison
      const existingQuote = await storage.getQuote(req.params.id, userContext.effectiveUserId);
      const previousStatus = existingQuote?.status || 'draft';
      
      const quote = await storage.updateQuote(req.params.id, userContext.effectiveUserId, {
        status: 'accepted',
        acceptedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Log activity for quote acceptance using helper function
      await logActivity(
        userContext.effectiveUserId,
        'quote_accepted',
        `Quote ${quote.number || quote.id} accepted`,
        `Quote accepted${quote.jobId ? ' and job scheduled' : ''}`,
        'quote',
        quote.id,
        { previousStatus, quoteNumber: quote.number, linkedJobId: quote.jobId }
      );
      
      // If quote is linked to a job, update the job status and log activity
      if (quote.jobId) {
        const job = await storage.getJob(quote.jobId, userContext.effectiveUserId);
        if (job && (job.status === 'pending' || job.status === 'draft')) {
          // Update job to 'scheduled' when quote is accepted
          await storage.updateJob(quote.jobId, userContext.effectiveUserId, {
            status: 'scheduled'
          });
          
          // Log activity for job status change
          await logActivity(
            userContext.effectiveUserId,
            'job_scheduled',
            `Job ${job.title || job.id} scheduled`,
            `Job automatically scheduled after quote acceptance`,
            'job',
            quote.jobId,
            { previousStatus: job.status, trigger: 'quote_accepted', quoteId: quote.id, quoteNumber: quote.number }
          );
          
          console.log(`[Quote Accept] Job ${quote.jobId} moved to scheduled after quote ${quote.id} accepted`);
        }
      }
      
      // Trigger automation rules for quote acceptance
      processStatusChangeAutomation(userContext.effectiveUserId, 'quote', quote.id, previousStatus, 'accepted')
        .catch(err => console.error('[Automations] Error processing quote acceptance:', err));
      
      res.json(quote);
    } catch (error) {
      console.error("Error accepting quote:", error);
      res.status(500).json({ error: "Failed to accept quote" });
    }
  });
  
  // Accept quote via PATCH (team-aware) - duplicate of POST for RESTful compatibility
  app.patch("/api/quotes/:id/accept", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      // Get existing quote for status comparison
      const existingQuote = await storage.getQuote(req.params.id, userContext.effectiveUserId);
      const previousStatus = existingQuote?.status || 'draft';
      
      const quote = await storage.updateQuote(req.params.id, userContext.effectiveUserId, {
        status: 'accepted',
        acceptedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Log activity for quote acceptance using helper function
      await logActivity(
        userContext.effectiveUserId,
        'quote_accepted',
        `Quote ${quote.number || quote.id} accepted`,
        `Quote accepted${quote.jobId ? ' and job scheduled' : ''}`,
        'quote',
        quote.id,
        { previousStatus, quoteNumber: quote.number, linkedJobId: quote.jobId }
      );
      
      // If quote is linked to a job, update the job status and log activity
      if (quote.jobId) {
        const job = await storage.getJob(quote.jobId, userContext.effectiveUserId);
        if (job && (job.status === 'pending' || job.status === 'draft')) {
          // Update job to 'scheduled' when quote is accepted
          await storage.updateJob(quote.jobId, userContext.effectiveUserId, {
            status: 'scheduled'
          });
          
          // Log activity for job status change
          await logActivity(
            userContext.effectiveUserId,
            'job_scheduled',
            `Job ${job.title || job.id} scheduled`,
            `Job automatically scheduled after quote acceptance`,
            'job',
            quote.jobId,
            { previousStatus: job.status, trigger: 'quote_accepted', quoteId: quote.id, quoteNumber: quote.number }
          );
          
          console.log(`[Quote Accept PATCH] Job ${quote.jobId} moved to scheduled after quote ${quote.id} accepted`);
        }
      }
      
      // Trigger automation rules for quote acceptance
      processStatusChangeAutomation(userContext.effectiveUserId, 'quote', quote.id, previousStatus, 'accepted')
        .catch(err => console.error('[Automations] Error processing quote acceptance:', err));
      
      res.json(quote);
    } catch (error) {
      console.error("Error accepting quote via PATCH:", error);
      res.status(500).json({ error: "Failed to accept quote" });
    }
  });

  // Reject quote (team-aware)
  app.post("/api/quotes/:id/reject", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      // Get existing quote for status comparison
      const existingQuote = await storage.getQuote(req.params.id, userContext.effectiveUserId);
      const previousStatus = existingQuote?.status || 'draft';
      
      const quote = await storage.updateQuote(req.params.id, userContext.effectiveUserId, {
        status: 'declined',
        rejectedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // Trigger automation rules for quote rejection
      processStatusChangeAutomation(userContext.effectiveUserId, 'quote', quote.id, previousStatus, 'declined')
        .catch(err => console.error('[Automations] Error processing quote rejection:', err));
      
      res.json(quote);
    } catch (error) {
      console.error("Error rejecting quote:", error);
      res.status(500).json({ error: "Failed to reject quote" });
    }
  });

  // PDF Download - Quote (team-aware)
  app.get("/api/quotes/:id/pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { generateQuotePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, userContext.effectiveUserId);
      if (!quoteWithItems) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const client = await storage.getClient(quoteWithItems.clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client || !business) {
        return res.status(404).json({ error: "Client or business settings not found" });
      }
      
      // Get linked job for site address if available
      const job = quoteWithItems.jobId ? await storage.getJob(quoteWithItems.jobId, userContext.effectiveUserId) : undefined;
      
      // Get job signatures if quote is linked to a job
      let jobSignatures: any[] = [];
      if (quoteWithItems.jobId) {
        const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, quoteWithItems.jobId));
        jobSignatures = signatures.map(sig => ({
          id: sig.id,
          jobId: sig.jobId,
          signerName: sig.signerName,
          signatureData: sig.signatureData,
          signedAt: sig.signedAt,
        }));
      }
      
      // Get quote acceptance signature if quote was accepted
      let acceptanceSignature;
      if (quoteWithItems.status === 'accepted') {
        const signatures = await db.select().from(digitalSignatures).where(
          sql`${digitalSignatures.documentType} = 'quote_acceptance' AND ${digitalSignatures.quoteId} = ${quoteWithItems.id}`
        );
        if (signatures.length > 0) {
          acceptanceSignature = {
            id: signatures[0].id,
            signerName: signatures[0].signerName,
            signatureData: signatures[0].signatureData,
            signedAt: signatures[0].signedAt,
          };
        }
      }
      
      const businessForPdf = await resolveBusinessLogoForPdf(business);
      const html = generateQuotePDF({
        quote: quoteWithItems,
        lineItems: quoteWithItems.lineItems || [],
        client,
        business: businessForPdf,
        job,
        jobSignatures,
        signature: acceptanceSignature,
      });
      
      const pdfBuffer = await generatePDFBuffer(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Quote-${quoteWithItems.number}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating quote PDF:", error);
      res.status(500).json({ error: "Failed to generate quote PDF" });
    }
  });

  // Image Download - Quote (for sharing via messaging apps)
  app.get("/api/quotes/:id/image", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { generateQuotePDF, generatePDFBuffer, convertPdfToImage, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, userContext.effectiveUserId);
      if (!quoteWithItems) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const client = await storage.getClient(quoteWithItems.clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client || !business) {
        return res.status(404).json({ error: "Client or business settings not found" });
      }
      
      // Get linked job for site address if available
      const job = quoteWithItems.jobId ? await storage.getJob(quoteWithItems.jobId, userContext.effectiveUserId) : undefined;
      
      const businessForPdf = await resolveBusinessLogoForPdf(business);
      const html = generateQuotePDF({
        quote: quoteWithItems,
        lineItems: quoteWithItems.lineItems || [],
        client,
        business: businessForPdf,
        job,
      });
      
      // Generate PDF first, then convert to image
      const pdfBuffer = await generatePDFBuffer(html);
      const imageBuffer = await convertPdfToImage(pdfBuffer);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="Quote-${quoteWithItems.number}.png"`);
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error generating quote image:", error);
      res.status(500).json({ error: "Failed to generate quote image" });
    }
  });

  // Preview PDF - Generate PDF from draft quote data (before saving) (team-aware)
  app.post("/api/quotes/preview-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { generateQuotePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const { clientId, title, description, validUntil, subtotal, gstAmount, total, lineItems, notes } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Create a mock quote object for PDF generation
      const mockQuote = {
        id: 'preview',
        userId: userContext.effectiveUserId,
        clientId,
        number: 'PREVIEW',
        title: title || 'Draft Quote',
        description: description || '',
        status: 'draft' as const,
        subtotal: subtotal?.toString() || '0',
        gstAmount: gstAmount?.toString() || '0',
        total: total?.toString() || '0',
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobId: null,
        sentAt: null,
        acceptedAt: null,
        acceptedBy: null,
        rejectedAt: null,
        declinedReason: null,
        acceptToken: null,
      };
      
      // Format line items
      const formattedLineItems = (lineItems || []).map((item: any, index: number) => ({
        id: `preview-${index}`,
        quoteId: 'preview',
        description: item.description || '',
        quantity: item.quantity?.toString() || '1',
        unitPrice: item.unitPrice?.toString() || '0',
        total: (item.total || (item.quantity * item.unitPrice))?.toString() || '0',
        sortOrder: index + 1,
      }));
      
      const businessForPdf = await resolveBusinessLogoForPdf(business || {
        id: 'default',
        userId: req.userId,
        businessName: 'Your Business',
        abn: '',
        address: '',
        phone: '',
        email: '',
        brandColor: '#2563eb',
        gstEnabled: true,
      });
      const html = generateQuotePDF({
        quote: mockQuote,
        lineItems: formattedLineItems,
        client,
        business: businessForPdf
      });
      
      const pdfBuffer = await generatePDFBuffer(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Quote-Preview.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating quote preview PDF:", error);
      res.status(500).json({ error: "Failed to generate quote preview PDF" });
    }
  });

  // Invoices Routes (team-aware: use effectiveUserId for proper data scoping)
  app.get("/api/invoices", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const includeArchived = req.query.archived === 'true';
      const [invoices, clients] = await Promise.all([
        storage.getInvoices(userContext.effectiveUserId, includeArchived),
        storage.getClients(userContext.effectiveUserId),
      ]);
      
      // Create client lookup map
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      
      // Get current date for overdue calculation
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      
      // Enrich invoices with client data and normalize overdue status
      const enrichedInvoices = invoices.map((invoice: any) => {
        const client = clientsMap.get(invoice.clientId);
        
        // Normalize status: if invoice is sent and past due date, mark as overdue
        let normalizedStatus = invoice.status;
        if (invoice.status === 'sent' && invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < now) {
            normalizedStatus = 'overdue';
          }
        }
        
        return {
          ...invoice,
          status: normalizedStatus,
          clientName: client?.name || 'Unknown Client',
          clientEmail: client?.email || null,
        };
      });
      
      res.json(enrichedInvoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Archive/Unarchive invoice (team-aware)
  app.post("/api/invoices/:id/archive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const invoice = await storage.archiveInvoice(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error archiving invoice:", error);
      res.status(500).json({ error: "Failed to archive invoice" });
    }
  });

  app.post("/api/invoices/:id/unarchive", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const invoice = await storage.unarchiveInvoice(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error unarchiving invoice:", error);
      res.status(500).json({ error: "Failed to unarchive invoice" });
    }
  });

  // Get single invoice (team-aware)
  app.get("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const invoice = await storage.getInvoiceWithLineItems(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Normalize status: if invoice is sent and past due date, mark as overdue
      let normalizedStatus = invoice.status;
      if (invoice.status === 'sent' && invoice.dueDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < now) {
          normalizedStatus = 'overdue';
        }
      }
      
      res.json({ ...invoice, status: normalizedStatus });
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // Create invoice (team-aware)
  app.post("/api/invoices", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { lineItems, ...invoiceData } = req.body;
      
      // Get business settings to check GST
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      const gstEnabled = business?.gstEnabled ?? true;
      
      // Always calculate totals from line items when provided (server is source of truth)
      let calculatedSubtotal = 0;
      let calculatedGst = 0;
      let calculatedTotal = 0;
      
      if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
        // Calculate subtotal from line items - server always recalculates
        calculatedSubtotal = lineItems.reduce((sum: number, item: any) => {
          const qty = parseFloat(item.quantity || '1');
          const price = parseFloat(item.unitPrice || '0');
          return sum + (qty * price);
        }, 0);
        
        // Calculate GST if enabled
        if (gstEnabled) {
          calculatedGst = calculatedSubtotal * 0.1;
        }
        
        // Calculate total
        calculatedTotal = calculatedSubtotal + calculatedGst;
      } else {
        // No line items - use provided values or defaults
        calculatedSubtotal = parseFloat(invoiceData.subtotal || '0');
        calculatedGst = parseFloat(invoiceData.gstAmount || '0');
        calculatedTotal = parseFloat(invoiceData.total || '0');
      }
      
      // Update invoice data with calculated totals
      invoiceData.subtotal = calculatedSubtotal.toFixed(2);
      invoiceData.gstAmount = calculatedGst.toFixed(2);
      invoiceData.total = calculatedTotal.toFixed(2);
      
      const data = insertInvoiceSchema.parse(invoiceData);
      
      // Generate invoice number if not provided
      if (!data.number) {
        data.number = await storage.generateInvoiceNumber(userContext.effectiveUserId);
      }
      
      // Generate payment token if allowOnlinePayment is true
      if (data.allowOnlinePayment && !data.paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = randomBytes(12);
        let paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
        data.paymentToken = paymentToken;
      }
      
      const invoice = await storage.createInvoice({ ...data, userId: userContext.effectiveUserId });
      
      // Add line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          // Calculate line item total if not provided
          const itemQty = parseFloat(item.quantity || '1');
          const itemPrice = parseFloat(item.unitPrice || '0');
          const itemTotal = item.total || (itemQty * itemPrice).toFixed(2);
          
          const lineItemData = insertInvoiceLineItemSchema.parse({ 
            ...item, 
            invoiceId: invoice.id,
            total: itemTotal 
          });
          await storage.createInvoiceLineItem(lineItemData, userContext.effectiveUserId);
        }
      }
      
      const invoiceWithItems = await storage.getInvoiceWithLineItems(invoice.id, userContext.effectiveUserId);
      
      // Auto-update linked job status to 'invoiced' if job is in 'done' status
      if (invoice.jobId) {
        try {
          const job = await storage.getJob(invoice.jobId, userContext.effectiveUserId);
          if (job && job.status === 'done') {
            await storage.updateJob(invoice.jobId, userContext.effectiveUserId, { status: 'invoiced' });
            console.log(`✅ Auto-updated job ${invoice.jobId} status to 'invoiced'`);
          }
        } catch (e) {
          console.log('Could not auto-update job status:', e);
          // Don't fail the invoice creation if job update fails
        }
      }
      
      // Log activity for dashboard feed
      const client = invoice.clientId ? await storage.getClient(invoice.clientId, userContext.effectiveUserId) : null;
      await logActivity(
        userContext.effectiveUserId,
        'invoice_created',
        `Invoice #${invoice.number} created`,
        client ? `Client: ${client.name}` : null,
        'invoice',
        invoice.id,
        { invoiceNumber: invoice.number, clientName: client?.name, total: invoice.total }
      );
      
      res.status(201).json(invoiceWithItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Update invoice (team-aware)
  app.patch("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const data = updateInvoiceSchema.parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, userContext.effectiveUserId, data);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // Delete invoice (team-aware)
  app.delete("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const success = await storage.deleteInvoice(req.params.id, userContext.effectiveUserId);
      if (!success) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Invoice actions
  app.post("/api/invoices/:id/send", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleInvoiceSend } = await import('./emailRoutes');
    return handleInvoiceSend(req, res, storage);
  });
  
  // Send payment link email to customer
  app.post("/api/invoices/:id/send-payment-link", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleSendPaymentLink } = await import('./emailRoutes');
    return handleSendPaymentLink(req, res, storage);
  });

  // Create Gmail draft with invoice PDF automatically attached
  app.post("/api/invoices/:id/email-with-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleInvoiceEmailWithPDF } = await import('./emailRoutes');
    return handleInvoiceEmailWithPDF(req, res, storage);
  });

  // Send invoice via SMS
  app.post("/api/invoices/:id/send-sms", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { sendSmsToClient } = await import('./services/smsService');
      const { smsTemplates } = await import('./twilioClient');
      
      const invoice = await storage.getInvoice(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const client = await storage.getClient(invoice.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (!client.phone) {
        return res.status(400).json({ error: "Client does not have a phone number. Please add a phone number to the client record." });
      }
      
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      
      // Ensure invoice has payment token for public link
      let paymentToken = invoice.paymentToken;
      if (!paymentToken) {
        const bytes = randomBytes(16);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        paymentToken = '';
        for (let i = 0; i < 16; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
        await storage.updateInvoice(req.params.id, userContext.effectiveUserId, { 
          paymentToken,
          allowOnlinePayment: true 
        });
      }
      
      // Build public URL and message
      const publicUrl = `${getProductionBaseUrl(req)}/pay/${paymentToken}`;
      const amount = `$${parseFloat(String(invoice.total || '0')).toFixed(2)}`;
      
      const message = `${smsTemplates.invoiceSent(client.name, businessName, invoice.number || invoice.id.slice(0, 8), amount)} Pay: ${publicUrl}`;
      
      // Send SMS
      const smsMessage = await sendSmsToClient({
        businessOwnerId: userContext.effectiveUserId,
        clientId: client.id,
        clientPhone: client.phone,
        clientName: client.name,
        jobId: invoice.jobId || undefined,
        message,
        senderUserId: req.userId,
      });
      
      // Update invoice status to sent if it was draft
      if (invoice.status === 'draft') {
        await storage.updateInvoice(req.params.id, userContext.effectiveUserId, {
          status: 'sent',
          sentAt: new Date(),
        });
      }
      
      // Log activity for SMS sent
      await logActivity(
        userContext.effectiveUserId,
        'invoice_sent',
        `Invoice ${invoice.number || invoice.id} sent via SMS`,
        `SMS sent to ${client.name} (${client.phone})`,
        'invoice',
        invoice.id,
        { deliveryMethod: 'sms', clientPhone: client.phone, smsMessageId: smsMessage.id, amount }
      );
      
      res.json({ 
        success: true, 
        message: `Invoice SMS sent to ${client.phone}`,
        smsMessageId: smsMessage.id,
        publicUrl,
      });
    } catch (error: any) {
      console.error("Error sending invoice SMS:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice SMS" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleInvoiceMarkPaid } = await import('./emailRoutes');
    return handleInvoiceMarkPaid(req, res, storage);
  });

  // Send receipt email for paid invoice (with PDF attachment)
  app.post("/api/invoices/:id/send-receipt", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const invoice = await storage.getInvoice(req.params.id, userContext.effectiveUserId);
      
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.status !== 'paid') {
        return res.status(400).json({ error: "Can only send receipts for paid invoices" });
      }
      
      const client = await storage.getClient(invoice.clientId, userContext.effectiveUserId);
      if (!client?.email) {
        return res.status(400).json({ error: "Client email required to send receipt" });
      }
      
      const businessSettings = await storage.getBusinessSettings(req.userId);
      
      // Use unified receipt email function that handles PDF generation internally
      const { sendReceiptEmailWithPdf } = await import('./emailService');
      const result = await sendReceiptEmailWithPdf(
        storage,
        invoice,
        client,
        businessSettings || {},
        undefined, // Let it look up or create receipt internally
        userContext.effectiveUserId
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error sending receipt:", error);
      res.status(500).json({ error: error.message || "Failed to send receipt" });
    }
  });

  // Record payment - shared handler for both endpoint aliases
  const handleRecordPayment = async (req: any, res: any) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { amount, paymentMethod, reference, notes, createReceipt = false } = req.body;
      
      // Validate and parse amount with proper string handling
      const amountStr = String(amount || '').trim();
      if (!amountStr) {
        return res.status(400).json({ error: "Amount is required" });
      }
      const parsedAmount = parseFloat(amountStr);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }
      
      const validPaymentMethods = ['cash', 'bank_transfer', 'cheque', 'card', 'other'];
      if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: `Payment method must be one of: ${validPaymentMethods.join(', ')}` });
      }
      
      // Get invoice
      const invoice = await storage.getInvoice(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Check if already paid (idempotency check)
      if (invoice.status === 'paid') {
        const paidDate = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-AU') : 'previously';
        return res.status(400).json({ 
          error: `Invoice is already marked as paid on ${paidDate}`,
          alreadyPaid: true
        });
      }
      
      // Log if payment amount differs from invoice total (allows partial or over-payments)
      const invoiceTotal = parseFloat(String(invoice.total || '0'));
      if (parsedAmount !== invoiceTotal) {
        console.log(`Manual payment: $${parsedAmount.toFixed(2)} recorded for invoice total $${invoiceTotal.toFixed(2)}`);
      }
      
      // Update invoice with payment details
      const updatedInvoice = await storage.updateInvoice(req.params.id, userContext.effectiveUserId, {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod,
        paymentReference: reference || null,
        notes: notes ? (invoice.notes ? `${invoice.notes}\n\nPayment notes: ${notes}` : `Payment notes: ${notes}`) : invoice.notes,
      });
      
      if (!updatedInvoice) {
        return res.status(500).json({ error: "Failed to record payment" });
      }
      
      // Update linked job status if applicable (best effort, don't fail if this errors)
      if (invoice.jobId) {
        try {
          const job = await storage.getJob(invoice.jobId, userContext.effectiveUserId);
          if (job && job.status !== 'invoiced') {
            await storage.updateJob(invoice.jobId, userContext.effectiveUserId, { status: 'invoiced' });
          }
        } catch (jobError) {
          console.log("Job status update skipped:", jobError);
        }
      }
      
      // Send push notification for payment received
      const amountInCents = Math.round(parsedAmount * 100);
      await notifyPaymentReceived(req.userId, amountInCents, invoice.number || `INV-${invoice.id}`, invoice.id);
      
      // Trigger automation rules for payment received
      processPaymentReceivedAutomation(req.userId, invoice.id)
        .catch(err => console.error('[Automations] Error processing payment received:', err));
      
      // Only create receipt if explicitly requested (not automatic)
      let receiptId = null;
      if (createReceipt) {
        try {
          const receiptNumber = await storage.generateReceiptNumber(userContext.effectiveUserId);
          const gstAmount = parsedAmount / 11; // GST = 1/11 of total (Australian standard)
          const subtotal = parsedAmount - gstAmount;
          
          // Get client info if available
          let clientId = null;
          if (invoice.clientId) {
            clientId = invoice.clientId;
          }
          
          const receipt = await storage.createReceipt({
            userId: userContext.effectiveUserId,
            receiptNumber,
            invoiceId: invoice.id,
            jobId: invoice.jobId,
            clientId,
            amount: parsedAmount.toFixed(2),
            gstAmount: gstAmount.toFixed(2),
            subtotal: subtotal.toFixed(2),
            paymentMethod: paymentMethod,
            paymentReference: reference || null,
            description: `Payment for Invoice ${invoice.number || invoice.id.substring(0, 8).toUpperCase()}`,
            paidAt: new Date(),
          });
          
          receiptId = receipt.id;
          
          // Log receipt creation activity using helper function
          await logActivity(
            userContext.effectiveUserId,
            'payment_received',
            `Receipt ${receiptNumber} created`,
            `Payment of $${parsedAmount.toFixed(2)} received via ${paymentMethod}`,
            'invoice',
            invoice.id,
            { receiptNumber, receiptId: receipt.id, amount: parsedAmount.toFixed(2), invoiceId: invoice.id, jobId: invoice.jobId, paymentMethod }
          );
          
          console.log(`✅ Created receipt ${receiptNumber} for invoice payment`);
        } catch (receiptError) {
          console.error('Failed to create receipt:', receiptError);
          // Don't fail the payment if receipt creation fails
        }
      }
      
      res.json({
        ...updatedInvoice,
        receiptId,
        message: `Payment of $${parsedAmount.toFixed(2)} recorded via ${paymentMethod}${receiptId ? ' - Receipt created' : ''}`
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
  };

  // Record manual payment with details - RESTful alias endpoint
  app.post("/api/invoices/:id/payments", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), handleRecordPayment);
  
  // Record manual payment with details (legacy endpoint)
  app.post("/api/invoices/:id/record-payment", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), handleRecordPayment);

  // Toggle online payment for invoice
  app.patch("/api/invoices/:id/online-payment", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const { allowOnlinePayment } = req.body;
      
      if (typeof allowOnlinePayment !== 'boolean') {
        return res.status(400).json({ error: "allowOnlinePayment must be a boolean" });
      }
      
      const invoice = await storage.getInvoice(req.params.id, req.userId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Check if business has Stripe Connect enabled
      const businessSettings = await storage.getBusinessSettings(req.userId);
      if (!businessSettings?.connectChargesEnabled) {
        return res.status(400).json({ 
          error: "Stripe Connect not enabled. Please connect your Stripe account in Settings first." 
        });
      }
      
      // Generate payment token if enabling online payment and no token exists
      // Uses 12-char alphanumeric for shorter URLs
      let paymentToken = invoice.paymentToken;
      if (allowOnlinePayment && !paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = randomBytes(12);
        paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
      }
      
      const updatedInvoice = await storage.updateInvoice(req.params.id, req.userId, {
        allowOnlinePayment,
        paymentToken: allowOnlinePayment ? paymentToken : invoice.paymentToken
      });
      
      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating online payment setting:", error);
      res.status(500).json({ error: "Failed to update online payment setting" });
    }
  });

  // PDF Download - Invoice (team-aware)
  app.get("/api/invoices/:id/pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    const invoiceId = req.params.id;
    try {
      const userContext = await getUserContext(req.userId);
      const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const invoiceWithItems = await storage.getInvoiceWithLineItems(invoiceId, userContext.effectiveUserId);
      if (!invoiceWithItems) {
        console.error(`[Invoice PDF] Invoice not found: ${invoiceId}`);
        return res.status(404).json({ error: "Invoice not found", details: `Invoice ${invoiceId} could not be found` });
      }
      
      const client = await storage.getClient(invoiceWithItems.clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client) {
        console.error(`[Invoice PDF] Client not found for invoice ${invoiceId}, clientId: ${invoiceWithItems.clientId}`);
        return res.status(404).json({ error: "Client not found", details: `Client for invoice ${invoiceId} could not be found` });
      }
      
      if (!business) {
        console.error(`[Invoice PDF] Business settings not found for user ${userContext.effectiveUserId}`);
        return res.status(404).json({ error: "Business settings not found", details: "Please complete your business profile in settings" });
      }
      
      // Get linked job and time entries for site address and time tracking
      let job = undefined;
      let timeEntries: any[] = [];
      try {
        job = invoiceWithItems.jobId ? await storage.getJob(invoiceWithItems.jobId, userContext.effectiveUserId) : undefined;
        timeEntries = invoiceWithItems.jobId ? await storage.getTimeEntries(userContext.effectiveUserId, invoiceWithItems.jobId) : [];
      } catch (jobError) {
        console.warn(`[Invoice PDF] Could not fetch job/time entries for invoice ${invoiceId}:`, jobError);
      }
      
      // Get job signatures if there's a linked job
      let jobSignatures: any[] = [];
      if (invoiceWithItems.jobId) {
        try {
          const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, invoiceWithItems.jobId));
          jobSignatures = signatures.filter(s => s.documentType === 'job_completion');
        } catch (sigError) {
          console.warn(`[Invoice PDF] Could not fetch signatures for job ${invoiceWithItems.jobId}:`, sigError);
        }
      }
      
      // Fetch business templates for terms and warranty
      let termsTemplate = undefined;
      let warrantyTemplate = undefined;
      try {
        const termsTemplateResult = await db.select().from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userContext.effectiveUserId),
            eq(businessTemplates.family, 'terms_conditions'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        const warrantyTemplateResult = await db.select().from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userContext.effectiveUserId),
            eq(businessTemplates.family, 'warranty'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        
        termsTemplate = termsTemplateResult[0]?.content;
        warrantyTemplate = warrantyTemplateResult[0]?.content;
      } catch (templateError) {
        console.warn(`[Invoice PDF] Could not fetch templates for invoice ${invoiceId}:`, templateError);
      }
      
      let html: string;
      try {
        const businessForPdf = await resolveBusinessLogoForPdf(business);
        html = generateInvoicePDF({
          invoice: invoiceWithItems,
          lineItems: invoiceWithItems.lineItems || [],
          client,
          business: businessForPdf,
          job,
          timeEntries,
          jobSignatures,
          termsTemplate,
          warrantyTemplate
        });
      } catch (htmlError: any) {
        console.error(`[Invoice PDF] HTML generation failed for invoice ${invoiceId}:`, htmlError);
        return res.status(500).json({ 
          error: "Failed to generate invoice document", 
          details: htmlError?.message || "Error creating invoice HTML content"
        });
      }
      
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generatePDFBuffer(html);
      } catch (pdfError: any) {
        console.error(`[Invoice PDF] PDF buffer generation failed for invoice ${invoiceId}:`, pdfError);
        return res.status(500).json({ 
          error: "Failed to create PDF file", 
          details: pdfError?.message || "Error converting invoice to PDF"
        });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceWithItems.number || invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error(`[Invoice PDF] Unexpected error generating PDF for invoice ${invoiceId}:`, error);
      res.status(500).json({ 
        error: "Failed to generate invoice PDF", 
        details: error?.message || "An unexpected error occurred while generating the PDF"
      });
    }
  });

  // Image Download - Invoice (for sharing via messaging apps)
  app.get("/api/invoices/:id/image", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    const invoiceId = req.params.id;
    try {
      const userContext = await getUserContext(req.userId);
      const { generateInvoicePDF, generatePDFBuffer, convertPdfToImage, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const invoiceWithItems = await storage.getInvoiceWithLineItems(invoiceId, userContext.effectiveUserId);
      if (!invoiceWithItems) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const client = await storage.getClient(invoiceWithItems.clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client || !business) {
        return res.status(404).json({ error: "Client or business settings not found" });
      }
      
      // Get linked job for site address
      const job = invoiceWithItems.jobId ? await storage.getJob(invoiceWithItems.jobId, userContext.effectiveUserId) : undefined;
      
      const businessForPdf = await resolveBusinessLogoForPdf(business);
      const html = generateInvoicePDF({
        invoice: invoiceWithItems,
        lineItems: invoiceWithItems.lineItems || [],
        client,
        business: businessForPdf,
        job,
      });
      
      // Generate PDF first, then convert to image
      const pdfBuffer = await generatePDFBuffer(html);
      const imageBuffer = await convertPdfToImage(pdfBuffer);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoiceWithItems.number || invoiceId}.png"`);
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error generating invoice image:", error);
      res.status(500).json({ error: "Failed to generate invoice image" });
    }
  });

  // Preview PDF - Generate PDF from draft invoice data (before saving) (team-aware)
  app.post("/api/invoices/preview-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const { clientId, title, description, dueDate, subtotal, gstAmount, total, lineItems, notes } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      const client = await storage.getClient(clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Create a mock invoice object for PDF generation
      const mockInvoice = {
        id: 'preview',
        userId: userContext.effectiveUserId,
        clientId,
        number: 'PREVIEW',
        title: title || 'Draft Invoice',
        description: description || '',
        status: 'draft' as const,
        subtotal: subtotal?.toString() || '0',
        gstAmount: gstAmount?.toString() || '0',
        total: total?.toString() || '0',
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobId: null,
        quoteId: null,
        sentAt: null,
        paidAt: null,
        paymentMethod: null,
        allowOnlinePayment: false,
        paymentToken: null,
      };
      
      // Format line items
      const formattedLineItems = (lineItems || []).map((item: any, index: number) => ({
        id: `preview-${index}`,
        invoiceId: 'preview',
        description: item.description || '',
        quantity: item.quantity?.toString() || '1',
        unitPrice: item.unitPrice?.toString() || '0',
        total: (item.total || (item.quantity * item.unitPrice))?.toString() || '0',
        sortOrder: index + 1,
      }));
      
      // Fetch business templates for terms and warranty
      const termsTemplateResult = await db.select().from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, userContext.effectiveUserId),
          eq(businessTemplates.family, 'terms_conditions'),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      const warrantyTemplateResult = await db.select().from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, userContext.effectiveUserId),
          eq(businessTemplates.family, 'warranty'),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      
      const termsTemplate = termsTemplateResult[0]?.content;
      const warrantyTemplate = warrantyTemplateResult[0]?.content;
      
      const businessForPdf = await resolveBusinessLogoForPdf(business || {
        id: 'default',
        userId: req.userId,
        businessName: 'Your Business',
        abn: '',
        address: '',
        phone: '',
        email: '',
        brandColor: '#dc2626',
        gstEnabled: true,
      });
      const html = generateInvoicePDF({
        invoice: mockInvoice,
        lineItems: formattedLineItems,
        client,
        business: businessForPdf,
        termsTemplate,
        warrantyTemplate
      });
      
      const pdfBuffer = await generatePDFBuffer(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-Preview.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating invoice preview PDF:", error);
      res.status(500).json({ error: "Failed to generate invoice preview PDF" });
    }
  });

  // Create payment link for invoice (uses custom tradie-branded payment page, NOT Stripe Checkout)
  app.post("/api/invoices/:id/create-checkout-session", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      // Get invoice with line items
      const invoice = await storage.getInvoiceWithLineItems(req.params.id, userContext.effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get client and business settings
      const client = await storage.getClient(invoice.clientId, userContext.effectiveUserId);
      const business = await storage.getBusinessSettings(userContext.effectiveUserId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }

      const parsedTotal = parseFloat(String(invoice.total || '0'));
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return res.status(400).json({ error: "Invalid invoice total amount" });
      }
      const totalAmountCents = Math.round(parsedTotal * 100);
      
      // Minimum invoice amount check - must cover platform fee + Stripe fees ($5.00 AUD minimum)
      if (totalAmountCents < 500) {
        return res.status(400).json({ error: "Minimum payment amount is $5.00 AUD" });
      }
      
      // Generate or use existing payment token (12-char alphanumeric for shorter URLs)
      let paymentToken = invoice.paymentToken;
      if (!paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = randomBytes(12);
        paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
      }
      
      // Use custom tradie-branded payment page (NOT Stripe's checkout.stripe.com)
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${paymentToken}`;
      
      // Save the payment token and URL to the invoice
      await storage.updateInvoice(invoice.id, userContext.effectiveUserId, {
        paymentToken,
        stripePaymentLink: paymentUrl,
        allowOnlinePayment: true,
      });

      console.log(`✅ Custom payment link created for invoice ${invoice.number}: ${paymentUrl}`);
      
      // Check if Connect is properly configured
      const connectEnabled = !!(business.stripeConnectAccountId && business.connectChargesEnabled);

      res.json({ 
        paymentUrl,
        url: paymentUrl,
        mode: 'custom',
        connectEnabled,
        message: connectEnabled 
          ? 'Payment link created - funds will go to your connected bank account'
          : 'Payment link created with your tradie branding'
      });
    } catch (error) {
      console.error("Error creating payment link:", error);
      res.status(500).json({ error: "Failed to create payment link" });
    }
  });

  // Generate and persist payment link for invoice (uses custom tradie-branded payment page, NOT Stripe Checkout)
  app.post("/api/invoices/:id/generate-payment-link", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      // Get invoice with line items
      const invoice = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Don't generate for already paid invoices
      if (invoice.status === 'paid') {
        return res.status(400).json({ error: "Invoice is already paid" });
      }

      // Get client and business settings
      const client = await storage.getClient(invoice.clientId, req.userId);
      const business = await storage.getBusinessSettings(req.userId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }

      const parsedTotal = parseFloat(String(invoice.total || '0'));
      if (isNaN(parsedTotal) || parsedTotal <= 0) {
        return res.status(400).json({ error: "Invalid invoice total amount" });
      }
      const totalAmountCents = Math.round(parsedTotal * 100);
      
      // Minimum invoice amount check - must cover platform fee + Stripe fees ($5.00 AUD minimum)
      if (totalAmountCents < 500) {
        return res.status(400).json({ error: "Minimum payment amount is $5.00 AUD" });
      }
      
      // Generate or use existing payment token (12-char alphanumeric for shorter URLs)
      let paymentToken = invoice.paymentToken;
      if (!paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = randomBytes(12);
        paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
      }
      
      // Use custom tradie-branded payment page (NOT Stripe's checkout.stripe.com)
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${paymentToken}`;
      
      // Save the payment token and URL to the invoice
      await storage.updateInvoice(invoice.id, req.userId, {
        paymentToken,
        stripePaymentLink: paymentUrl,
        allowOnlinePayment: true,
      });

      console.log(`✅ Custom payment link generated for invoice ${invoice.number}: ${paymentUrl}`);
      
      // Check if Connect is properly configured
      const connectEnabled = !!(business.stripeConnectAccountId && business.connectChargesEnabled);

      res.json({ 
        paymentUrl,
        url: paymentUrl,
        saved: true,
        connectEnabled,
        message: connectEnabled 
          ? 'Payment link created - funds will go to your connected bank account'
          : 'Payment link created - please set up Stripe Connect to receive payments directly'
      });
    } catch (error) {
      console.error("Error generating payment link:", error);
      res.status(500).json({ error: "Failed to generate payment link" });
    }
  });

  // Standalone payment link generation (for mobile collect screen QR codes)
  // Requires WRITE_INVOICES permission as payment collection is an invoicing capability
  const paymentLinkSchema = z.object({
    amount: z.number().int().min(500, "Minimum payment amount is $5.00 AUD (500 cents)"),
    description: z.string().optional(),
    clientId: z.string().uuid().optional(),
  });

  app.post("/api/payment-links", paymentRateLimiter, requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      // Validate request body with Zod
      const validationResult = paymentLinkSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.errors[0]?.message || "Invalid request" });
      }
      const { amount, description, clientId } = validationResult.data;

      const business = await storage.getBusinessSettings(req.userId);
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }

      const baseUrl = getProductionBaseUrl(req);

      const stripe = await getUncachableStripeClient();

      if (stripe) {
        const sessionConfig: any = {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'aud',
                product_data: {
                  name: description || 'Payment',
                  description: `Payment to ${business.businessName || 'Business'}`,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${baseUrl}/collect?payment=success`,
          cancel_url: `${baseUrl}/collect?payment=cancelled`,
          metadata: {
            userId: req.userId,
            businessName: business.businessName || '',
            type: 'standalone_payment',
          },
        };

        // Add Stripe Connect destination charges if tradie has Connect account
        if (business.stripeConnectAccountId && business.connectChargesEnabled) {
          const platformFee = Math.max(Math.round(amount * 0.025), 50);
          sessionConfig.payment_intent_data = {
            application_fee_amount: platformFee,
            transfer_data: {
              destination: business.stripeConnectAccountId,
            },
            on_behalf_of: business.stripeConnectAccountId,
          };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ 
          url: session.url,
          qrCode: session.url, // Mobile app can generate QR from this URL
          sessionId: session.id,
          mode: 'stripe'
        });
      } else {
        // Mock payment link for testing
        const mockUrl = `${baseUrl}/pay/collect-${Date.now()}?amount=${amount}`;
        res.json({ 
          url: mockUrl,
          qrCode: mockUrl,
          sessionId: `mock_${Date.now()}`,
          mode: 'mock',
          message: 'Mock payment link created for testing'
        });
      }
    } catch (error) {
      console.error("Error creating payment link:", error);
      res.status(500).json({ error: "Failed to create payment link" });
    }
  });

  // Send payment link via SMS or Email (for mobile collect screen)
  // Requires WRITE_INVOICES permission as payment collection is an invoicing capability
  const paymentLinkSendSchema = z.object({
    amount: z.number().int().min(500, "Minimum payment amount is $5.00 AUD (500 cents)"),
    description: z.string().optional(),
    method: z.enum(['sms', 'email'], { errorMap: () => ({ message: "Method must be 'sms' or 'email'" }) }),
    recipient: z.string().optional(),
  });

  app.post("/api/payment-links/send", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      // Validate request body with Zod
      const validationResult = paymentLinkSendSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.errors[0]?.message || "Invalid request" });
      }
      const { amount, description, method, recipient } = validationResult.data;

      const business = await storage.getBusinessSettings(req.userId);
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }

      const baseUrl = getProductionBaseUrl(req);

      const stripe = await getUncachableStripeClient();
      let paymentUrl: string;

      if (stripe) {
        const sessionConfig: any = {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'aud',
                product_data: {
                  name: description || 'Payment',
                  description: `Payment to ${business.businessName || 'Business'}`,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${baseUrl}/collect?payment=success`,
          cancel_url: `${baseUrl}/collect?payment=cancelled`,
          metadata: {
            userId: req.userId,
            businessName: business.businessName || '',
            type: 'standalone_payment',
          },
        };

        if (business.stripeConnectAccountId && business.connectChargesEnabled) {
          const platformFee = Math.max(Math.round(amount * 0.025), 50);
          sessionConfig.payment_intent_data = {
            application_fee_amount: platformFee,
            transfer_data: {
              destination: business.stripeConnectAccountId,
            },
            on_behalf_of: business.stripeConnectAccountId,
          };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);
        paymentUrl = session.url || '';
      } else {
        paymentUrl = `${baseUrl}/pay/collect-${Date.now()}?amount=${amount}`;
      }

      // For now, return success - actual SMS/email sending would require recipient info
      // The mobile app prompts user for recipient after this call
      res.json({ 
        success: true,
        paymentUrl,
        method,
        message: `Payment link ready to send via ${method.toUpperCase()}`
      });
    } catch (error) {
      console.error("Error sending payment link:", error);
      res.status(500).json({ error: "Failed to send payment link" });
    }
  });

  // Convert quote to invoice
  app.post("/api/quotes/:id/convert-to-invoice", requireAuth, createPermissionMiddleware([PERMISSIONS.WRITE_QUOTES, PERMISSIONS.WRITE_INVOICES]), async (req: any, res) => {
    try {
      const quote = await storage.getQuoteWithLineItems(req.params.id, req.userId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      if (quote.status !== 'accepted') {
        return res.status(400).json({ error: "Only accepted quotes can be converted to invoices" });
      }

      // Generate invoice number
      const invoiceNumber = await storage.generateInvoiceNumber(req.userId);

      // Create invoice from quote
      const invoice = await storage.createInvoice({
        userId: req.userId,
        clientId: quote.clientId,
        jobId: quote.jobId,
        quoteId: quote.id,
        number: invoiceNumber,
        title: quote.title,
        description: quote.description,
        subtotal: quote.subtotal,
        gstAmount: quote.gstAmount,
        total: quote.total,
        notes: quote.notes,
        status: 'draft'
      });

      // Copy line items
      for (const item of quote.lineItems) {
        await storage.createInvoiceLineItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sortOrder: item.sortOrder
        }, req.userId);
      }

      const invoiceWithItems = await storage.getInvoiceWithLineItems(invoice.id, req.userId);
      res.status(201).json(invoiceWithItems);
    } catch (error) {
      console.error("Error converting quote to invoice:", error);
      res.status(500).json({ error: "Failed to convert quote to invoice" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let [jobs, quotes, invoices] = await Promise.all([
        storage.getJobs(userContext.effectiveUserId),
        storage.getQuotes(userContext.effectiveUserId),
        storage.getInvoices(userContext.effectiveUserId)
      ]);
      
      // Staff tradies only see stats for their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => job.assignedTo === req.userId);
        // For staff, don't show financial stats - they only see job stats
        quotes = [];
        invoices = [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const jobsToday = jobs.filter(job => {
        if (!job.scheduledAt) return false;
        const schedDate = new Date(job.scheduledAt);
        return schedDate >= today && schedDate < tomorrow;
      }).length;

      const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
      const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);

      const quotesAwaiting = quotes.filter(q => q.status === 'sent').length;

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const monthlyEarnings = invoices
        .filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= currentMonth)
        .reduce((sum, inv) => sum + parseFloat(inv.total), 0);

      res.json({
        jobsToday,
        unpaidInvoicesCount: unpaidInvoices.length,
        unpaidInvoicesTotal: unpaidTotal,
        quotesAwaiting,
        monthlyEarnings,
        isStaffView: !hasViewAll && userContext.teamMemberId ? true : false,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Dashboard KPIs - main metrics for tradie dashboard
  app.get("/api/dashboard/kpis", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let [jobs, quotes, invoices] = await Promise.all([
        storage.getJobs(userContext.effectiveUserId),
        storage.getQuotes(userContext.effectiveUserId),
        storage.getInvoices(userContext.effectiveUserId)
      ]);
      
      // Staff tradies only see stats for their assigned jobs
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => job.assignedTo === req.userId);
        quotes = [];
        invoices = [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Jobs scheduled for today
      const jobsToday = jobs.filter(job => {
        if (!job.scheduledAt) return false;
        const schedDate = new Date(job.scheduledAt);
        return schedDate >= today && schedDate < tomorrow;
      }).length;

      // Unpaid invoices (money owed to tradie)
      const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft');
      const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      // Quotes awaiting response
      const quotesAwaiting = quotes.filter(q => q.status === 'sent').length;

      // Jobs completed but not yet invoiced (money left on the table!)
      // Exclude jobs that already have an invoice linked
      const invoicedJobIds = new Set(invoices.filter(inv => inv.jobId).map(inv => inv.jobId));
      const jobsToInvoice = jobs.filter(j => 
        j.status === 'done' && !invoicedJobIds.has(j.id)
      ).length;

      // This week's earnings (motivation to see money coming in!)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weeklyEarnings = invoices
        .filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= startOfWeek)
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      // This month's earnings
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const monthlyEarnings = invoices
        .filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= currentMonth)
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      res.json({
        jobsToday,
        unpaidInvoicesCount: unpaidInvoices.length,
        unpaidInvoicesTotal: unpaidTotal,
        quotesAwaiting,
        monthlyEarnings,
        weeklyEarnings,
        jobsToInvoice,
      });
    } catch (error) {
      console.error("Error fetching dashboard KPIs:", error);
      res.status(500).json({ error: "Failed to fetch dashboard KPIs" });
    }
  });

  // Unified dashboard endpoint - single call for web/mobile consistency
  app.get("/api/dashboard/unified", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
      const isOwner = userContext.isOwner;
      const canManageTeam = hasViewAll; // Owners and managers with view_all can see team data
      
      // Fetch all data in parallel
      let [jobs, quotes, invoices, clients, teamMembers, activities] = await Promise.all([
        storage.getJobs(effectiveUserId),
        storage.getQuotes(effectiveUserId),
        storage.getInvoices(effectiveUserId),
        storage.getClients(effectiveUserId),
        canManageTeam ? storage.getTeamMembers(effectiveUserId) : Promise.resolve([]),
        storage.getActivityLogs(effectiveUserId, 5)
      ]);
      
      // Staff view filter
      if (!hasViewAll && userContext.teamMemberId) {
        jobs = jobs.filter(job => job.assignedTo === req.userId);
        quotes = [];
        invoices = [];
      }
      
      // Calculate today's jobs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todaysJobs = jobs.filter(job => {
        if (!job.scheduledAt) return false;
        const schedDate = new Date(job.scheduledAt);
        return schedDate >= today && schedDate < tomorrow;
      });
      
      // Unassigned jobs for team owners and managers with view_all permissions
      const unassignedJobs = canManageTeam && teamMembers.length > 0 
        ? jobs.filter(job => !job.assignedTo && job.status !== 'completed' && job.status !== 'invoiced')
        : [];
      
      // Calculate stats
      const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
      const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
      const quotesAwaiting = quotes.filter(q => q.status === 'sent').length;
      
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const monthlyEarnings = invoices
        .filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= currentMonth)
        .reduce((sum, inv) => sum + parseFloat(inv.total), 0);
      
      // Active team members only
      const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
      
      res.json({
        stats: {
          jobsToday: todaysJobs.length,
          unpaidInvoicesCount: unpaidInvoices.length,
          unpaidInvoicesTotal: unpaidTotal,
          quotesAwaiting,
          monthlyEarnings,
          isStaffView: !hasViewAll && userContext.teamMemberId ? true : false,
        },
        todaysJobs: todaysJobs.map(job => {
          const client = clients.find(c => c.id === job.clientId);
          return { ...job, client };
        }),
        unassignedJobs: unassignedJobs.map(job => {
          const client = clients.find(c => c.id === job.clientId);
          return { ...job, client };
        }),
        teamMembers: activeTeamMembers.map(m => ({
          id: m.id,
          userId: m.memberId, // Mobile expects userId, database stores memberId
          name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          role: m.roleId,
          status: m.inviteStatus,
        })),
        activities,
        isOwner,
        canManageTeam,
        hasActiveTeam: activeTeamMembers.length > 0,
      });
    } catch (error) {
      console.error("Error fetching unified dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Dashboard activity feed
  app.get("/api/dashboard/activity", requireAuth, async (req: any, res) => {
    try {
      // This would typically come from an activity log table
      // For now, we'll generate from recent quote/invoice activities
      const [quotes, invoices] = await Promise.all([
        storage.getQuotes(req.userId),
        storage.getInvoices(req.userId)
      ]);

      const activities: any[] = [];
      
      // Recent quote activities
      quotes.slice(0, 5).forEach(quote => {
        if (quote.acceptedAt) {
          activities.push({
            id: `quote-accepted-${quote.id}`,
            action: `Quote ${quote.number} accepted`,
            time: formatRelativeTime(quote.acceptedAt),
            type: "success"
          });
        } else if (quote.sentAt) {
          activities.push({
            id: `quote-sent-${quote.id}`,
            action: `Quote ${quote.number} sent`,
            time: formatRelativeTime(quote.sentAt),
            type: "info"
          });
        }
      });

      // Recent invoice activities
      invoices.slice(0, 5).forEach(invoice => {
        if (invoice.paidAt) {
          activities.push({
            id: `invoice-paid-${invoice.id}`,
            action: `Payment received for ${invoice.number}`,
            time: formatRelativeTime(invoice.paidAt),
            type: "success"
          });
        } else if (invoice.sentAt) {
          activities.push({
            id: `invoice-sent-${invoice.id}`,
            action: `Invoice ${invoice.number} sent`,
            time: formatRelativeTime(invoice.sentAt),
            type: "info"
          });
        }
      });

      // Sort by most recent and limit
      activities.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      
      res.json(activities.slice(0, 10));
    } catch (error) {
      console.error("Error fetching dashboard activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });


  // Test data endpoint (for development only)
  app.post("/api/test-data", requireAuth, requireDevelopment, async (req: any, res) => {
    try {
      // Create a test client
      const client = await storage.createClient({
        userId: req.userId,
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "+61 4123 456 789",
        address: "15 Oak Street, Cairns, QLD 4870"
      });

      // Create a test job for today
      const job = await storage.createJob({
        userId: req.userId,
        clientId: client.id,
        title: "Kitchen Renovation - Plumbing",
        description: "Install new kitchen sink and connect plumbing",
        status: "pending",
        scheduledAt: new Date(),
        address: "15 Oak Street, Cairns",
        assignedTo: "Mike"
      });

      // Create a quote
      const quote = await storage.createQuote({
        userId: req.userId,
        clientId: client.id,
        title: "Kitchen Plumbing Quote",
        description: "Quote for kitchen renovation plumbing work",
        status: "sent",
        jobId: job.id,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        subtotal: "850.00",
        gstAmount: "85.00",
        total: "935.00",
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      });

      // Create quote line items
      await storage.createQuoteLineItem({
        quoteId: quote.id,
        description: "Kitchen sink installation",
        quantity: "1",
        unitPrice: "450.00",
        total: "450.00",
        sortOrder: 1
      }, req.userId);

      await storage.createQuoteLineItem({
        quoteId: quote.id,
        description: "Plumbing connections and fittings",
        quantity: "1",
        unitPrice: "400.00",
        total: "400.00",
        sortOrder: 2
      }, req.userId);

      // Create an invoice
      const invoice = await storage.createInvoice({
        userId: req.userId,
        clientId: client.id,
        title: "Bathroom Repair Invoice",
        description: "Emergency bathroom leak repair",
        status: "sent",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: "320.00",
        gstAmount: "32.00",
        total: "352.00",
        sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      });

      // Create invoice line items
      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: "Emergency leak repair",
        quantity: "1",
        unitPrice: "320.00",
        total: "320.00",
        sortOrder: 1
      }, req.userId);

      res.json({ message: "Test data created successfully" });
    } catch (error) {
      console.error("Error creating test data:", error);
      res.status(500).json({ error: "Failed to create test data" });
    }
  });

  // =========== PAYMENT REQUESTS (Phone-to-Phone Payments) ===========
  // Get all payment requests for the user
  app.get("/api/payment-requests", requireAuth, async (req: any, res) => {
    try {
      const requests = await storage.getPaymentRequests(req.userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      res.status(500).json({ error: "Failed to fetch payment requests" });
    }
  });

  // Get a specific payment request
  app.get("/api/payment-requests/:id", requireAuth, async (req: any, res) => {
    try {
      const request = await storage.getPaymentRequest(req.params.id, req.userId);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error fetching payment request:", error);
      res.status(500).json({ error: "Failed to fetch payment request" });
    }
  });

  // Create a new payment request
  app.post("/api/payment-requests", requireAuth, async (req: any, res) => {
    try {
      const { amount, description, reference, invoiceId, jobId, clientId, expiresInHours = 24 } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Amount is required and must be positive" });
      }
      
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      // Generate secure token for payment link
      const token = randomBytes(32).toString('hex');
      
      // Calculate GST (10% for Australian businesses)
      const settings = await storage.getBusinessSettings(req.userId);
      const gstEnabled = settings?.gstEnabled ?? true;
      const gstAmount = gstEnabled ? parseFloat(amount) / 11 : 0; // GST inclusive calculation
      
      // Set expiration time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      
      const paymentRequest = await storage.createPaymentRequest({
        userId: req.userId,
        amount: amount.toString(),
        gstAmount: gstAmount.toFixed(2),
        description,
        reference: reference || null,
        invoiceId: invoiceId || null,
        jobId: jobId || null,
        clientId: clientId || null,
        token,
        status: 'pending',
        expiresAt,
      });
      
      // Generate the payment URL using production-ready base URL detection
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${token}`;
      
      res.status(201).json({
        ...paymentRequest,
        paymentUrl,
      });
    } catch (error) {
      console.error("Error creating payment request:", error);
      res.status(500).json({ error: "Failed to create payment request" });
    }
  });

  // Update a payment request
  app.patch("/api/payment-requests/:id", requireAuth, async (req: any, res) => {
    try {
      const { amount, description, reference, status, expiresInHours } = req.body;
      
      const updates: any = {};
      if (amount !== undefined) {
        updates.amount = amount.toString();
        // Recalculate GST
        const settings = await storage.getBusinessSettings(req.userId);
        const gstEnabled = settings?.gstEnabled ?? true;
        updates.gstAmount = gstEnabled ? (parseFloat(amount) / 11).toFixed(2) : '0.00';
      }
      if (description !== undefined) updates.description = description;
      if (reference !== undefined) updates.reference = reference;
      if (status !== undefined) updates.status = status;
      if (expiresInHours !== undefined) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);
        updates.expiresAt = expiresAt;
      }
      
      const updated = await storage.updatePaymentRequest(req.params.id, req.userId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment request:", error);
      res.status(500).json({ error: "Failed to update payment request" });
    }
  });

  // Delete a payment request
  app.delete("/api/payment-requests/:id", requireAuth, async (req: any, res) => {
    try {
      const deleted = await storage.deletePaymentRequest(req.params.id, req.userId);
      if (!deleted) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting payment request:", error);
      res.status(500).json({ error: "Failed to delete payment request" });
    }
  });

  // Cancel a payment request
  app.post("/api/payment-requests/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const updated = await storage.updatePaymentRequest(req.params.id, req.userId, {
        status: 'cancelled'
      });
      if (!updated) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling payment request:", error);
      res.status(500).json({ error: "Failed to cancel payment request" });
    }
  });

  // Share payment request via SMS - Disabled for beta
  app.post("/api/payment-requests/:id/send-sms", requireAuth, async (req: any, res) => {
    res.status(501).json({ 
      error: "SMS notifications are disabled in beta. Use email instead, or copy the payment link to share manually." 
    });
  });

  // Share payment request via email
  app.post("/api/payment-requests/:id/send-email", requireAuth, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const request = await storage.getPaymentRequest(req.params.id, req.userId);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      const settings = await storage.getBusinessSettings(req.userId);
      const businessName = settings?.businessName || 'Your tradie';
      
      // Use production-ready base URL detection
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${request.token}`;
      
      // Import and use email service
      const { sendPaymentRequestEmail } = await import('./emailService');
      await sendPaymentRequestEmail({
        to: email,
        businessName,
        amount: parseFloat(request.amount),
        description: request.description,
        paymentUrl,
        reference: request.reference || undefined,
      });
      
      // Update notifications sent
      const notificationsSent = (request.notificationsSent as any[] || []);
      notificationsSent.push({ type: 'email', email, sentAt: new Date().toISOString() });
      
      await storage.updatePaymentRequest(req.params.id, req.userId, {
        notificationsSent
      } as any);
      
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending payment request email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Generate QR code for a payment request
  app.get("/api/payment-requests/:id/qrcode", requireAuth, async (req: any, res) => {
    try {
      const request = await storage.getPaymentRequest(req.params.id, req.userId);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      const QRCode = require('qrcode');
      // Use production-ready base URL detection
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${request.token}`;
      
      // Generate QR code as data URL (base64)
      const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      res.json({ 
        success: true, 
        qrCode: qrDataUrl,
        paymentUrl
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // =========== STRIPE TERMINAL (Tap to Pay) ===========
  
  // Get Terminal connection token - required for SDK initialization
  app.post("/api/terminal/connection-token", requireAuth, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ 
          error: "Payment processing not configured",
          message: "Stripe is not configured. Please set up Stripe integration first."
        });
      }
      
      // Get or create a location for this user
      const settings = await storage.getBusinessSettings(req.userId);
      let locationId = settings?.stripeTerminalLocationId;
      
      if (!locationId) {
        // Create a location for the user
        const location = await stripe.terminal.locations.create({
          display_name: settings?.businessName || 'Business Location',
          address: {
            line1: settings?.businessAddress || '1 Main St',
            city: settings?.businessCity || 'Sydney',
            state: settings?.businessState || 'NSW',
            postal_code: settings?.businessPostcode || '2000',
            country: 'AU',
          },
        });
        locationId = location.id;
        
        // Save location ID to business settings
        await storage.updateBusinessSettings(req.userId, {
          stripeTerminalLocationId: locationId,
        } as any);
      }
      
      // Create connection token
      const connectionToken = await stripe.terminal.connectionTokens.create({
        location: locationId,
      });
      
      res.json({ 
        secret: connectionToken.secret,
        locationId 
      });
    } catch (error: any) {
      console.error("Error creating terminal connection token:", error);
      res.status(500).json({ 
        error: "Failed to create connection token",
        message: error.message 
      });
    }
  });

  // Create a payment intent for terminal payment
  app.post("/api/terminal/payment-intent", paymentRateLimiter, requireAuth, async (req: any, res) => {
    try {
      const { amount, description, clientId, invoiceId, jobId, idempotencyKey } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Amount is required and must be positive" });
      }
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "Payment processing not configured" });
      }
      
      const settings = await storage.getBusinessSettings(req.userId);
      const amountInCents = Math.round(parseFloat(amount) * 100);
      
      // Create PaymentIntent with card_present payment method type
      const paymentIntentParams: any = {
        amount: amountInCents,
        currency: 'aud',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        description: description || 'In-person payment',
        metadata: {
          userId: req.userId,
          clientId: clientId || '',
          invoiceId: invoiceId || '',
          jobId: jobId || '',
          source: 'tap_to_pay',
        },
      };
      
      // If using Stripe Connect, add transfer data
      if (settings?.stripeConnectAccountId && settings.connectChargesEnabled) {
        paymentIntentParams.transfer_data = {
          destination: settings.stripeConnectAccountId,
        };
      }
      
      // Use idempotency key to prevent duplicate charges (client provides or we generate)
      const requestOptions: { idempotencyKey?: string } = {};
      if (idempotencyKey) {
        requestOptions.idempotencyKey = idempotencyKey;
      } else {
        // Generate idempotency key from user, amount, and timestamp (5-minute window)
        const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
        requestOptions.idempotencyKey = `terminal_${req.userId}_${amountInCents}_${invoiceId || jobId || 'direct'}_${timeWindow}`;
      }
      
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, requestOptions);
      
      // Store terminal payment record
      await storage.createTerminalPayment({
        userId: req.userId,
        stripePaymentIntentId: paymentIntent.id,
        amount: amount.toString(),
        description: description || 'In-person payment',
        clientId: clientId || null,
        invoiceId: invoiceId || null,
        jobId: jobId || null,
        status: 'pending',
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInCents,
      });
    } catch (error: any) {
      console.error("Error creating terminal payment intent:", error);
      res.status(500).json({ 
        error: "Failed to create payment intent",
        message: error.message 
      });
    }
  });

  // Confirm terminal payment succeeded (webhook or client callback)
  app.post("/api/terminal/payment-success", requireAuth, async (req: any, res) => {
    try {
      const { paymentIntentId, cardBrand, cardLast4 } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID is required" });
      }
      
      // Update the terminal payment record
      const updatedPayment = await storage.updateTerminalPaymentByIntent(paymentIntentId, {
        status: 'succeeded',
        cardBrand,
        cardLast4,
        completedAt: new Date(),
        paymentMethod: 'card_present',
      });
      
      if (!updatedPayment) {
        return res.status(404).json({ error: "Terminal payment not found" });
      }
      
      // If linked to an invoice, update invoice status
      if (updatedPayment.invoiceId) {
        await storage.updateInvoice(updatedPayment.invoiceId, req.userId, {
          status: 'paid',
          paidAt: new Date(),
          paidAmount: updatedPayment.amount,
        });
      }
      
      res.json({ 
        success: true, 
        payment: updatedPayment 
      });
    } catch (error: any) {
      console.error("Error confirming terminal payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // Cancel a terminal payment
  app.post("/api/terminal/payment-cancel", requireAuth, async (req: any, res) => {
    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID is required" });
      }
      
      const stripe = await getUncachableStripeClient();
      if (stripe) {
        await stripe.paymentIntents.cancel(paymentIntentId);
      }
      
      await storage.updateTerminalPaymentByIntent(paymentIntentId, {
        status: 'cancelled',
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error cancelling terminal payment:", error);
      res.status(500).json({ error: "Failed to cancel payment" });
    }
  });

  // Get terminal payment history
  app.get("/api/terminal/payments", requireAuth, async (req: any, res) => {
    try {
      const payments = await storage.getTerminalPayments(req.userId);
      res.json(payments);
    } catch (error: any) {
      console.error("Error fetching terminal payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Check if Terminal/Tap to Pay is available
  app.get("/api/terminal/availability", requireAuth, async (req: any, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const stripeConfigured = !!stripe;
      
      // Check if Stripe account has Terminal enabled
      let terminalEnabled = false;
      if (stripe) {
        try {
          // Try to create a connection token to verify Terminal is enabled
          const settings = await storage.getBusinessSettings(req.userId);
          if (settings?.stripeTerminalLocationId) {
            terminalEnabled = true;
          } else {
            // Try creating a test location to check capability
            const testCheck = await stripe.terminal.locations.list({ limit: 1 });
            terminalEnabled = true;
          }
        } catch (e: any) {
          // Terminal not enabled or not available
          terminalEnabled = false;
        }
      }
      
      res.json({
        stripeConfigured,
        terminalEnabled,
        tapToPayAvailable: stripeConfigured && terminalEnabled,
        message: !stripeConfigured 
          ? 'Stripe is not configured' 
          : !terminalEnabled 
            ? 'Stripe Terminal is not enabled for this account'
            : 'Tap to Pay is available',
      });
    } catch (error: any) {
      console.error("Error checking terminal availability:", error);
      res.status(500).json({ error: "Failed to check availability" });
    }
  });

  // ========== RECEIPT ENDPOINTS ==========
  
  // Get all receipts for user
  app.get("/api/receipts", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const allReceipts = await storage.getReceipts(effectiveUserId);
      res.json(allReceipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  // Get a specific receipt
  app.get("/api/receipts/:id", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const receipt = await storage.getReceipt(req.params.id, effectiveUserId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({ error: "Failed to fetch receipt" });
    }
  });

  // Get receipts for a specific job
  app.get("/api/jobs/:id/receipts", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const jobReceipts = await storage.getReceiptsForJob(req.params.id, effectiveUserId);
      res.json(jobReceipts);
    } catch (error) {
      console.error("Error fetching job receipts:", error);
      res.status(500).json({ error: "Failed to fetch job receipts" });
    }
  });

  // Get receipt for a specific invoice
  app.get("/api/invoices/:id/receipt", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const invoiceId = req.params.id;
      
      // First verify the invoice belongs to this user
      const invoice = await storage.getInvoice(invoiceId, effectiveUserId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Query receipts with proper tenant isolation
      const userReceipts = await storage.getReceipts(effectiveUserId);
      const receipt = userReceipts.find((r: any) => r.invoiceId === invoiceId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found for this invoice" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error fetching invoice receipt:", error);
      res.status(500).json({ error: "Failed to fetch invoice receipt" });
    }
  });

  // Create a receipt (typically called after payment is collected)
  app.post("/api/receipts", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      
      // Generate receipt number
      const receiptNumber = await storage.generateReceiptNumber(effectiveUserId);
      
      const receiptData = {
        ...req.body,
        userId: effectiveUserId,
        receiptNumber,
        paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
      };
      
      const receipt = await storage.createReceipt(receiptData);
      
      // Log activity using helper function
      await logActivity(
        effectiveUserId,
        'payment_received',
        `Receipt ${receiptNumber} created`,
        `Payment of $${receipt.amount} received`,
        'invoice',
        receipt.invoiceId,
        { receiptNumber, receiptId: receipt.id, amount: receipt.amount, jobId: receipt.jobId, invoiceId: receipt.invoiceId }
      );
      
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(500).json({ error: "Failed to create receipt" });
    }
  });

  // Generate receipt PDF
  app.get("/api/receipts/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { generatePaymentReceiptPDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const receipt = await storage.getReceipt(req.params.id, effectiveUserId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      const business = await storage.getBusinessSettings(effectiveUserId);
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      
      // Resolve logo URL to base64 for PDF rendering
      const businessWithLogo = await resolveBusinessLogoForPdf(business);
      
      // Get client, job, and invoice data if available
      let client = null;
      let job = null;
      let invoice = null;
      
      if (receipt.clientId) {
        client = await storage.getClient(receipt.clientId, effectiveUserId);
      }
      if (receipt.jobId) {
        job = await storage.getJob(receipt.jobId, effectiveUserId);
      }
      if (receipt.invoiceId) {
        invoice = await storage.getInvoice(receipt.invoiceId, effectiveUserId);
      }
      
      // Generate PDF HTML using existing receipt template
      const pdfHtml = generatePaymentReceiptPDF({
        payment: {
          id: receipt.id,
          amount: parseFloat(receipt.amount),
          gstAmount: parseFloat(receipt.gstAmount || '0'),
          subtotal: parseFloat(receipt.subtotal || receipt.amount),
          paymentMethod: receipt.paymentMethod || 'card',
          paymentReference: receipt.paymentReference,
          paidAt: receipt.paidAt,
          receiptNumber: receipt.receiptNumber,
          description: receipt.description,
        },
        client: client ? {
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
        } : null,
        business: {
          businessName: businessWithLogo.businessName,
          abn: businessWithLogo.abn,
          address: businessWithLogo.address,
          phone: businessWithLogo.phone,
          email: businessWithLogo.email,
          logoUrl: businessWithLogo.logoUrl,
          brandColor: businessWithLogo.brandColor || '#dc2626',
        },
        invoice: invoice ? {
          id: invoice.id,
          number: invoice.number,
        } : null,
        job: job ? {
          id: job.id,
          title: job.title,
        } : null,
      });
      
      // Generate PDF buffer
      const pdfBuffer = await generatePDFBuffer(pdfHtml);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating receipt PDF:", error);
      res.status(500).json({ error: "Failed to generate receipt PDF" });
    }
  });

  // Generate receipt image (for sharing via messaging apps)
  app.get("/api/receipts/:id/image", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { generatePaymentReceiptPDF, generatePDFBuffer, convertPdfToImage, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const receipt = await storage.getReceipt(req.params.id, effectiveUserId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      const business = await storage.getBusinessSettings(effectiveUserId);
      if (!business) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      
      const businessWithLogo = await resolveBusinessLogoForPdf(business);
      
      let client = null;
      let job = null;
      let invoice = null;
      
      if (receipt.clientId) {
        client = await storage.getClient(receipt.clientId, effectiveUserId);
      }
      if (receipt.jobId) {
        job = await storage.getJob(receipt.jobId, effectiveUserId);
      }
      if (receipt.invoiceId) {
        invoice = await storage.getInvoice(receipt.invoiceId, effectiveUserId);
      }
      
      const pdfHtml = generatePaymentReceiptPDF({
        payment: {
          id: receipt.id,
          amount: parseFloat(receipt.amount),
          gstAmount: parseFloat(receipt.gstAmount || '0'),
          subtotal: parseFloat(receipt.subtotal || receipt.amount),
          paymentMethod: receipt.paymentMethod || 'card',
          paymentReference: receipt.paymentReference,
          paidAt: receipt.paidAt,
          receiptNumber: receipt.receiptNumber,
          description: receipt.description,
        },
        client: client ? {
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
        } : null,
        business: {
          businessName: businessWithLogo.businessName,
          abn: businessWithLogo.abn,
          address: businessWithLogo.address,
          phone: businessWithLogo.phone,
          email: businessWithLogo.email,
          logoUrl: businessWithLogo.logoUrl,
          brandColor: businessWithLogo.brandColor || '#dc2626',
        },
        invoice: invoice ? {
          id: invoice.id,
          number: invoice.number,
        } : null,
        job: job ? {
          id: job.id,
          title: job.title,
        } : null,
      });
      
      // Generate PDF first, then convert to image
      const pdfBuffer = await generatePDFBuffer(pdfHtml);
      const imageBuffer = await convertPdfToImage(pdfBuffer);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNumber}.png"`);
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error generating receipt image:", error);
      res.status(500).json({ error: "Failed to generate receipt image" });
    }
  });

  // Send receipt via email
  app.post("/api/receipts/:id/send-email", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { email, customSubject, customMessage } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const receipt = await storage.getReceipt(req.params.id, effectiveUserId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      const business = await storage.getBusinessSettings(effectiveUserId);
      const businessName = business?.businessName || 'Your tradie';
      const brandColor = business?.brandColor || '#dc2626';
      
      // Generate PDF for attachment
      const { generatePaymentReceiptPDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      let client = null;
      if (receipt.clientId) {
        client = await storage.getClient(receipt.clientId, effectiveUserId);
      }
      
      // Resolve logo URL to base64 for PDF rendering
      const businessWithLogo = business ? await resolveBusinessLogoForPdf(business) : null;
      
      const pdfHtml = generatePaymentReceiptPDF({
        payment: {
          id: receipt.id,
          amount: parseFloat(receipt.amount),
          gstAmount: parseFloat(receipt.gstAmount || '0'),
          subtotal: parseFloat(receipt.subtotal || receipt.amount),
          paymentMethod: receipt.paymentMethod || 'card',
          paymentReference: receipt.paymentReference,
          paidAt: receipt.paidAt,
          receiptNumber: receipt.receiptNumber,
          description: receipt.description,
        },
        client: client ? {
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
        } : null,
        business: {
          businessName: businessWithLogo?.businessName || 'Business',
          abn: businessWithLogo?.abn,
          address: businessWithLogo?.address,
          phone: businessWithLogo?.phone,
          email: businessWithLogo?.email,
          logoUrl: businessWithLogo?.logoUrl,
          brandColor: brandColor,
        },
        invoice: null,
        job: null,
      });
      
      const pdfBuffer = await generatePDFBuffer(pdfHtml);
      
      // Determine email subject and body based on custom message or default
      let emailSubject: string;
      let emailHtml: string;
      
      if (customSubject && customMessage) {
        // Use custom subject and message with professional branded template
        emailSubject = customSubject;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${businessName}</h1>
              ${business?.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${business.abn}</p>` : ''}
              <div style="margin-top: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 20px;">
                <span style="color: white; font-size: 13px; font-weight: 600;">RECEIPT ${receipt.receiptNumber}</span>
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
              ${customMessage.split('\n').map((p: string) => p.trim() ? `<p style="margin: 0 0 16px 0;">${p}</p>` : '<br>').join('')}
              
              <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Payment Confirmed:</p>
                <p style="margin: 0; font-size: 20px; color: #22c55e; font-weight: 700;">$${parseFloat(receipt.amount).toFixed(2)} AUD</p>
              </div>
            </div>
            
            <div style="margin-top: 20px; padding: 16px; text-align: center; color: #666; font-size: 12px;">
              ${business?.phone ? `<p style="margin: 4px 0;">Phone: ${business.phone}</p>` : ''}
              ${business?.email ? `<p style="margin: 4px 0;">Email: ${business.email}</p>` : ''}
              ${business?.address ? `<p style="margin: 4px 0;">${business.address}</p>` : ''}
            </div>
          </body>
          </html>
        `;
      } else {
        // Use default template
        emailSubject = `Payment Receipt from ${businessName} - ${receipt.receiptNumber}`;
        emailHtml = `
          <h2>Thank you for your payment!</h2>
          <p>Please find your payment receipt attached.</p>
          <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
          <p><strong>Amount Paid:</strong> $${parseFloat(receipt.amount).toFixed(2)} AUD</p>
          <p><strong>Payment Date:</strong> ${new Date(receipt.paidAt).toLocaleDateString('en-AU')}</p>
          <br/>
          <p>Best regards,<br/>${businessName}</p>
        `;
      }
      
      // Send email with receipt attachment
      const { sendEmailWithAttachment } = await import('./emailService');
      await sendEmailWithAttachment({
        to: email,
        subject: emailSubject,
        html: emailHtml,
        fromName: businessName || 'TradieTrack',
        replyTo: business?.email,
        attachments: [{
          filename: `${receipt.receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });
      
      // Update receipt with email sent timestamp
      await storage.updateReceipt(receipt.id, effectiveUserId, {
        emailSentAt: new Date(),
        recipientEmail: email,
      });
      
      res.json({ success: true, message: "Receipt email sent successfully" });
    } catch (error) {
      console.error("Error sending receipt email:", error);
      res.status(500).json({ error: "Failed to send receipt email" });
    }
  });

  // Send receipt via SMS
  app.post("/api/receipts/:id/send-sms", requireAuth, async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { sendSmsToClient } = await import('./services/smsService');
      const { smsTemplates } = await import('./twilioClient');
      const crypto = await import('crypto');
      
      let receipt = await storage.getReceipt(req.params.id, effectiveUserId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      // Get client info - either from receipt.clientId or find via invoice
      let client = null;
      let clientPhone: string | null = null;
      let clientName: string | null = null;
      
      if (receipt.clientId) {
        client = await storage.getClient(receipt.clientId, effectiveUserId);
        clientPhone = client?.phone || null;
        clientName = client?.name || null;
      }
      
      // If no client phone from direct link, try via invoice
      if (!clientPhone && receipt.invoiceId) {
        const invoice = await storage.getInvoice(receipt.invoiceId, effectiveUserId);
        if (invoice?.clientId) {
          client = await storage.getClient(invoice.clientId, effectiveUserId);
          clientPhone = client?.phone || null;
          clientName = client?.name || null;
        }
      }
      
      if (!clientPhone) {
        return res.status(400).json({ error: "No phone number found for this receipt's client. Please add a phone number to the client record." });
      }
      
      const businessSettings = await storage.getBusinessSettings(effectiveUserId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      
      const amount = `$${parseFloat(receipt.amount).toFixed(2)}`;
      
      // Generate view token if not exists for public receipt access
      let viewToken = receipt.viewToken;
      if (!viewToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = crypto.randomBytes(12);
        viewToken = '';
        for (let i = 0; i < 12; i++) {
          viewToken += chars[bytes[i] % chars.length];
        }
        await storage.updateReceipt(receipt.id, effectiveUserId, { viewToken });
        receipt = { ...receipt, viewToken };
      }
      
      // Generate receipt URL for SMS
      const receiptUrl = getReceiptPublicUrl(viewToken, req);
      
      // Use paymentReceived template with receipt URL
      const message = smsTemplates.paymentReceived(clientName || 'Customer', amount, businessName, receiptUrl);
      
      // Send SMS
      const smsMessage = await sendSmsToClient({
        businessOwnerId: effectiveUserId,
        clientId: client?.id,
        clientPhone,
        clientName: clientName || undefined,
        jobId: receipt.jobId || undefined,
        message,
        senderUserId: req.userId,
      });
      
      // Update receipt with SMS sent timestamp
      await storage.updateReceipt(receipt.id, effectiveUserId, {
        smsSentAt: new Date(),
        recipientPhone: clientPhone,
      });
      
      // Log activity for SMS sent
      await logActivity(
        effectiveUserId,
        'payment_received',
        `Receipt ${receipt.receiptNumber} sent via SMS`,
        `SMS sent to ${clientName || 'customer'} (${clientPhone})`,
        'invoice',
        receipt.invoiceId || null,
        { deliveryMethod: 'sms', clientPhone, smsMessageId: smsMessage.id, receiptNumber: receipt.receiptNumber, amount, receiptUrl }
      );
      
      res.json({ 
        success: true, 
        message: `Receipt SMS sent to ${clientPhone}`,
        smsMessageId: smsMessage.id,
        receiptUrl,
      });
    } catch (error: any) {
      console.error("Error sending receipt SMS:", error);
      res.status(500).json({ error: error.message || "Failed to send receipt SMS" });
    }
  });

  // PUBLIC: Get payment request by token (for customer payment page)
  app.get("/api/public/payment-request/:token", async (req, res) => {
    try {
      const request = await storage.getPaymentRequestByToken(req.params.token);
      
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      // Check if expired
      if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Payment request has expired" });
      }
      
      // Check if already paid or cancelled
      if (request.status === 'paid') {
        return res.status(409).json({ error: "Payment request has already been paid" });
      }
      
      if (request.status === 'cancelled') {
        return res.status(410).json({ error: "Payment request has been cancelled" });
      }
      
      // Get business settings for branding
      const settings = await storage.getBusinessSettings(request.userId);
      
      // Return payment details (exclude sensitive data)
      res.json({
        id: request.id,
        amount: request.amount,
        gstAmount: request.gstAmount,
        description: request.description,
        reference: request.reference,
        status: request.status,
        expiresAt: request.expiresAt,
        businessName: settings?.businessName || 'Business',
        businessLogo: settings?.logoUrl,
        brandColor: settings?.brandColor || '#dc2626',
      });
    } catch (error) {
      console.error("Error fetching public payment request:", error);
      res.status(500).json({ error: "Failed to fetch payment request" });
    }
  });

  // PUBLIC: Create Stripe payment intent for payment request
  app.post("/api/public/payment-request/:token/create-payment-intent", async (req, res) => {
    try {
      const request = await storage.getPaymentRequestByToken(req.params.token);
      
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      // Validate status and expiry
      if (request.status === 'paid') {
        return res.status(409).json({ error: "Payment has already been made" });
      }
      
      if (request.status === 'cancelled') {
        return res.status(410).json({ error: "Payment request has been cancelled" });
      }
      
      if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Payment request has expired" });
      }
      
      // Get business settings for Stripe Connect
      const settings = await storage.getBusinessSettings(request.userId);
      
      // Get Stripe client
      const stripe = await getUncachableStripeClient();
      
      if (!stripe) {
        return res.status(503).json({ error: "Payment processing is not available" });
      }
      
      const amountInCents = Math.round(parseFloat(request.amount) * 100);
      
      // Create payment intent
      const paymentIntentParams: any = {
        amount: amountInCents,
        currency: 'aud',
        description: request.description,
        metadata: {
          paymentRequestId: request.id,
          paymentRequestToken: request.token,
          businessName: settings?.businessName || 'Unknown',
        },
      };
      
      // If tradie has Stripe Connect account, use destination charges
      if (settings?.stripeConnectAccountId) {
        // Calculate platform fee (2.5%)
        const platformFee = Math.round(amountInCents * 0.025);
        paymentIntentParams.transfer_data = {
          destination: settings.stripeConnectAccountId,
        };
        paymentIntentParams.application_fee_amount = platformFee;
      }
      
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
      
      // Update payment request with Stripe data
      await storage.updatePaymentRequestByToken(request.token, {
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
      } as any);
      
      // Get publishable key
      const publishableKey = await getStripePublishableKey();
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // PUBLIC: Confirm payment was successful
  app.post("/api/public/payment-request/:token/confirm-payment", async (req, res) => {
    try {
      const { paymentIntentId, paymentMethod } = req.body;
      
      const request = await storage.getPaymentRequestByToken(req.params.token);
      
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      
      // Verify payment intent matches
      if (request.stripePaymentIntentId !== paymentIntentId) {
        return res.status(400).json({ error: "Payment intent mismatch" });
      }
      
      // Update payment request status
      await storage.updatePaymentRequestByToken(request.token, {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod || 'card',
      } as any);
      
      // If linked to an invoice, mark it as paid too
      if (request.invoiceId) {
        const invoice = await storage.getInvoice(request.invoiceId, request.userId);
        if (invoice) {
          await storage.updateInvoice(request.invoiceId, request.userId, {
            status: 'paid',
            paidAt: new Date(),
            paymentMethod: 'online',
          });
        }
      }
      
      // Create notification for the tradie
      await storage.createNotification({
        userId: request.userId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `Payment of $${parseFloat(request.amount).toFixed(2)} received for: ${request.description}`,
        data: { paymentRequestId: request.id },
      });
      
      // Auto-create receipt for the online payment
      try {
        const receiptNumber = await storage.generateReceiptNumber(request.userId);
        const amount = parseFloat(request.amount);
        const gstAmount = parseFloat(request.gstAmount || String(amount / 11));
        const subtotal = amount - gstAmount;
        
        // Get client info from invoice if linked
        let clientId = null;
        let jobId = null;
        if (request.invoiceId) {
          const invoice = await storage.getInvoice(request.invoiceId, request.userId);
          if (invoice) {
            clientId = invoice.clientId;
            jobId = invoice.jobId;
          }
        }
        
        const receipt = await storage.createReceipt({
          userId: request.userId,
          receiptNumber,
          invoiceId: request.invoiceId,
          jobId,
          clientId,
          amount: amount.toFixed(2),
          gstAmount: gstAmount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          paymentMethod: paymentMethod || 'card',
          paymentReference: paymentIntentId,
          description: request.description || 'Online payment',
          paidAt: new Date(),
        });
        
        // Log receipt creation activity using helper function
        await logActivity(
          request.userId,
          'payment_received',
          `Receipt ${receiptNumber} created`,
          `Online payment of $${amount.toFixed(2)} received`,
          'invoice',
          request.invoiceId,
          { receiptNumber, receiptId: receipt.id, amount: amount.toFixed(2), invoiceId: request.invoiceId, paymentMethod: 'online' }
        );
        
        console.log(`✅ Auto-created receipt ${receiptNumber} for online payment`);
      } catch (receiptError) {
        console.error('Failed to auto-create receipt for online payment:', receiptError);
        // Don't fail the payment confirmation if receipt creation fails
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // Document Templates Routes
  app.get("/api/templates", requireAuth, async (req: any, res) => {
    try {
      const { type, tradeType } = req.query;
      const templates = await storage.getDocumentTemplates(req.userId, type, tradeType);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/templates", requireAuth, async (req: any, res) => {
    try {
      const data = insertDocumentTemplateSchema.parse(req.body);
      const template = await storage.createDocumentTemplate({ ...data, userId: req.userId });
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const data = insertDocumentTemplateSchema.partial().parse(req.body);
      const template = await storage.updateDocumentTemplate(req.params.id, data);
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req: any, res) => {
    try {
      await storage.deleteDocumentTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Message Templates (Email/SMS)
  app.get("/api/message-templates", requireAuth, async (req: any, res) => {
    try {
      const channel = req.query.channel as string | undefined;
      // Ensure user has default templates
      await storage.ensureDefaultTemplates(req.userId);
      const templates = await storage.getMessageTemplates(req.userId, channel);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching message templates:', error);
      res.status(500).json({ error: 'Failed to fetch message templates' });
    }
  });

  app.get("/api/message-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const template = await storage.getMessageTemplate(req.params.id, req.userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching message template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  app.post("/api/message-templates", requireAuth, async (req: any, res) => {
    try {
      const { insertMessageTemplateSchema } = await import('@shared/schema');
      const validated = insertMessageTemplateSchema.parse({
        ...req.body,
        userId: req.userId,
      });
      const template = await storage.createMessageTemplate(validated);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid template data', details: error.errors });
      }
      console.error('Error creating message template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  app.patch("/api/message-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { updateMessageTemplateSchema } = await import('@shared/schema');
      const validated = updateMessageTemplateSchema.parse(req.body);
      const template = await storage.updateMessageTemplate(req.params.id, req.userId, validated);
      if (!template) {
        return res.status(404).json({ error: 'Template not found or cannot modify default template' });
      }
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid template data', details: error.errors });
      }
      console.error('Error updating message template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  app.delete("/api/message-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.deleteMessageTemplate(req.params.id, req.userId);
      if (!success) {
        return res.status(404).json({ error: 'Template not found or cannot delete default template' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // Business Templates API (unified Templates Hub)
  // GET /api/business-templates - List all templates (optionally filter by family)
  app.get("/api/business-templates", requireAuth, async (req: any, res) => {
    try {
      const family = req.query.family as string | undefined;
      // Validate family if provided
      if (family && !BUSINESS_TEMPLATE_FAMILIES.includes(family as any)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      const templates = await storage.getBusinessTemplates(req.userId, family);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching business templates:', error);
      res.status(500).json({ error: 'Failed to fetch business templates' });
    }
  });

  // GET /api/business-templates/active/:family - Get active template for a family
  app.get("/api/business-templates/active/:family", requireAuth, async (req: any, res) => {
    try {
      const { family } = req.params;
      // Validate family
      if (!BUSINESS_TEMPLATE_FAMILIES.includes(family as any)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      const template = await storage.getActiveBusinessTemplate(req.userId, family);
      if (!template) {
        return res.status(404).json({ error: 'No active template found for this family' });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching active business template:', error);
      res.status(500).json({ error: 'Failed to fetch active template' });
    }
  });

  // GET /api/business-templates/by-purpose/:family/:purpose - Get active template for family+purpose
  app.get("/api/business-templates/by-purpose/:family/:purpose", requireAuth, async (req: any, res) => {
    try {
      const { family, purpose } = req.params;
      // Validate family
      if (!BUSINESS_TEMPLATE_FAMILIES.includes(family as any)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      const template = await storage.getActiveBusinessTemplateByPurpose(req.userId, family, purpose);
      if (!template) {
        return res.status(404).json({ error: 'No active template found for this family and purpose' });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching business template by purpose:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  // GET /api/business-templates/families - Get all template families with metadata
  // NOTE: This route MUST be defined BEFORE /:id to avoid "families" matching as an ID
  app.get("/api/business-templates/families", requireAuth, async (req: any, res) => {
    try {
      const families = await storage.getBusinessTemplateFamilies(req.userId);
      res.json(families);
    } catch (error) {
      console.error('Error fetching template families:', error);
      res.status(500).json({ error: 'Failed to fetch template families' });
    }
  });

  // GET /api/business-templates/purposes/:family - Get valid purposes for a template family
  // NOTE: This route MUST be defined BEFORE /:id to avoid route conflicts
  app.get("/api/business-templates/purposes/:family", requireAuth, async (req: any, res) => {
    try {
      const { family } = req.params;
      if (!BUSINESS_TEMPLATE_FAMILIES.includes(family as any)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      
      const validPurposes = getValidPurposesForFamily(family as any);
      const { PURPOSE_LABELS } = await import("@shared/schema");
      
      // Return purposes with human-readable labels
      const purposesWithLabels = validPurposes.map(purpose => ({
        id: purpose,
        label: PURPOSE_LABELS[purpose] || purpose,
      }));
      
      res.json({ family, purposes: purposesWithLabels });
    } catch (error) {
      console.error('Error fetching valid purposes:', error);
      res.status(500).json({ error: 'Failed to fetch valid purposes' });
    }
  });

  // GET /api/business-templates/:id - Get single template
  app.get("/api/business-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const template = await storage.getBusinessTemplate(req.params.id, req.userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching business template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  // POST /api/business-templates - Create new template
  app.post("/api/business-templates", requireAuth, async (req: any, res) => {
    try {
      console.log('[Templates] Creating template with body:', JSON.stringify(req.body, null, 2));
      const validated = insertBusinessTemplateSchema.parse({
        ...req.body,
        userId: req.userId,
      });
      console.log('[Templates] Validated data:', JSON.stringify(validated, null, 2));
      
      // Validate family
      const family = validated.family as BusinessTemplateFamily;
      if (!BUSINESS_TEMPLATE_FAMILIES.includes(family)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      
      // Validate purpose is valid for this family (prevents misassignment)
      const purpose = (validated.purpose || 'general') as BusinessTemplatePurpose;
      if (!isValidPurposeForFamily(family, purpose)) {
        const validPurposes = getValidPurposesForFamily(family);
        return res.status(400).json({ 
          error: `Invalid purpose "${purpose}" for ${family} templates. Valid purposes: ${validPurposes.join(', ')}`,
          validPurposes 
        });
      }
      
      const template = await storage.createBusinessTemplate(validated);
      console.log('[Templates] Template created successfully:', template.id);
      res.status(201).json(template);
    } catch (error: any) {
      console.error('[Templates] Error creating template:', error.message, error.stack);
      if (error.name === 'ZodError') {
        console.error('[Templates] Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: 'Invalid template data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // PATCH /api/business-templates/:id - Update template
  app.patch("/api/business-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const validated = updateBusinessTemplateSchema.parse(req.body);
      
      // Validate family if being updated
      if (validated.family && !BUSINESS_TEMPLATE_FAMILIES.includes(validated.family as any)) {
        return res.status(400).json({ error: `Invalid family. Must be one of: ${BUSINESS_TEMPLATE_FAMILIES.join(', ')}` });
      }
      
      // If purpose is being updated, validate it matches the family
      if (validated.purpose) {
        // Get existing template to know the family
        const existing = await storage.getBusinessTemplate(req.params.id, req.userId);
        if (!existing) {
          return res.status(404).json({ error: 'Template not found' });
        }
        const family = (validated.family || existing.family) as BusinessTemplateFamily;
        const purpose = validated.purpose as BusinessTemplatePurpose;
        
        if (!isValidPurposeForFamily(family, purpose)) {
          const validPurposes = getValidPurposesForFamily(family);
          return res.status(400).json({ 
            error: `Invalid purpose "${purpose}" for ${family} templates. Valid purposes: ${validPurposes.join(', ')}`,
            validPurposes 
          });
        }
      }
      
      const template = await storage.updateBusinessTemplate(req.params.id, req.userId, validated);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid template data', details: error.errors });
      }
      console.error('Error updating business template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // DELETE /api/business-templates/:id - Delete template
  app.delete("/api/business-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.deleteBusinessTemplate(req.params.id, req.userId);
      if (!success) {
        return res.status(404).json({ error: 'Template not found or cannot delete default template' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting business template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // POST /api/business-templates/:id/activate - Set as active template for its family
  app.post("/api/business-templates/:id/activate", requireAuth, async (req: any, res) => {
    try {
      await storage.setActiveBusinessTemplate(req.params.id, req.userId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res.status(404).json({ error: 'Template not found' });
      }
      console.error('Error activating business template:', error);
      res.status(500).json({ error: 'Failed to activate template' });
    }
  });

  // POST /api/business-templates/seed - Seed default templates for user
  app.post("/api/business-templates/seed", requireAuth, async (req: any, res) => {
    try {
      const templates = await storage.seedDefaultBusinessTemplates(req.userId);
      res.json({ success: true, templatesCreated: templates.length });
    } catch (error) {
      console.error('Error seeding default templates:', error);
      res.status(500).json({ error: 'Failed to seed default templates' });
    }
  });

  // Template Analysis Routes - AI-powered PDF template analysis
  const templateUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for PDFs
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    }
  });

  // POST /api/templates/analyze - Upload and analyze a PDF template
  app.post("/api/templates/analyze", requireAuth, templateUpload.single('file'), async (req: any, res) => {
    try {
      const { analyzeTemplate } = await import('./aiTemplateAnalysis');
      const { convertPdfToImage } = await import('./pdfService');
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const templateType = req.body.templateType;
      if (!templateType || !['quote', 'invoice'].includes(templateType)) {
        return res.status(400).json({ error: "templateType must be 'quote' or 'invoice'" });
      }

      const templateName = req.body.name || `Analyzed ${templateType} template`;
      const pdfBuffer = req.file.buffer;
      const originalFileName = req.file.originalname;

      // Create the analysis job first
      const jobId = crypto.randomUUID();
      const fileKey = `/.private/template-uploads/${req.userId}/${jobId}.pdf`;

      // Store PDF in object storage
      try {
        const objectStorage = await ObjectStorageService.getInstance();
        await objectStorage.storeObject(fileKey, pdfBuffer, 'application/pdf');
      } catch (storageError) {
        console.error("Failed to store PDF:", storageError);
        return res.status(500).json({ error: "Failed to store uploaded file" });
      }

      // Create job record
      const job = await storage.createTemplateAnalysisJob({
        userId: req.userId,
        templateType,
        originalFileName,
        originalFileKey: fileKey,
        status: 'processing',
      });

      // Return immediately with job ID - processing happens async
      res.status(202).json({ 
        jobId: job.id, 
        status: 'processing',
        message: 'Template analysis started'
      });

      // Process asynchronously (non-blocking)
      (async () => {
        try {
          console.log(`[Template Analysis] Starting analysis for job ${job.id}`);
          
          // Convert PDF to image
          const imageBuffer = await convertPdfToImage(pdfBuffer);
          console.log(`[Template Analysis] PDF converted to image for job ${job.id}`);
          
          // Analyze with GPT-4o Vision
          const analysisResult = await analyzeTemplate(imageBuffer, templateType);
          console.log(`[Template Analysis] Analysis complete for job ${job.id}`);
          
          // Create document template from analysis
          const templateSettings = {
            tableStyle: analysisResult.typography.style === 'minimal' ? 'minimal' : 
                        analysisResult.typography.style === 'modern' ? 'striped' : 'bordered',
            headerBorderWidth: '2px',
            showHeaderDivider: true,
            noteStyle: analysisResult.layout.footer.has_terms ? 'bordered' : 'simple',
            accentColor: analysisResult.brandColors.primary,
          };

          const template = await storage.createDocumentTemplate({
            userId: req.userId,
            name: templateName || analysisResult.suggestedTemplateName,
            type: templateType,
            tradeType: 'general',
            settings: templateSettings,
            isDefault: false,
          });

          // Update job with success
          await storage.updateTemplateAnalysisJob(job.id, {
            status: 'completed',
            analysisResult: analysisResult as any,
            createdTemplateId: template.id,
          });

          console.log(`[Template Analysis] Job ${job.id} completed, template ${template.id} created`);
        } catch (error) {
          console.error(`[Template Analysis] Job ${job.id} failed:`, error);
          await storage.updateTemplateAnalysisJob(job.id, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error during analysis',
          });
        }
      })();

    } catch (error) {
      console.error("Error starting template analysis:", error);
      res.status(500).json({ error: "Failed to start template analysis" });
    }
  });

  // GET /api/templates/analyze/:jobId - Check status of template analysis job
  app.get("/api/templates/analyze/:jobId", requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getTemplateAnalysisJob(req.params.jobId, req.userId);
      
      if (!job) {
        return res.status(404).json({ error: "Analysis job not found" });
      }

      res.json({
        id: job.id,
        status: job.status,
        templateType: job.templateType,
        originalFileName: job.originalFileName,
        analysisResult: job.analysisResult,
        createdTemplateId: job.createdTemplateId,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching analysis job:", error);
      res.status(500).json({ error: "Failed to fetch analysis job" });
    }
  });

  // PATCH /api/templates/:id/set-default - Set a template as the default
  app.patch("/api/templates/:id/set-default", requireAuth, async (req: any, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Update business settings to use this template
      await storage.updateBusinessSettings(req.userId, {
        documentTemplate: template.name,
        documentTemplateSettings: template.settings as any,
      });

      // Mark this template as default and unmark others
      await storage.updateDocumentTemplate(req.params.id, { isDefault: true });

      res.json({ success: true, templateId: req.params.id });
    } catch (error) {
      console.error("Error setting default template:", error);
      res.status(500).json({ error: "Failed to set default template" });
    }
  });

  // Line Item Catalog Routes
  app.get("/api/catalog", requireAuth, async (req: any, res) => {
    try {
      const { tradeType } = req.query;
      const catalog = await storage.getLineItemCatalog(req.userId, tradeType);
      res.json(catalog);
    } catch (error) {
      console.error("Error fetching catalog:", error);
      res.status(500).json({ error: "Failed to fetch catalog" });
    }
  });

  app.post("/api/catalog", requireAuth, async (req: any, res) => {
    try {
      const data = insertLineItemCatalogSchema.parse(req.body);
      const item = await storage.createLineItemCatalogItem({ ...data, userId: req.userId });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating catalog item:", error);
      res.status(500).json({ error: "Failed to create catalog item" });
    }
  });

  // Rate Cards Routes
  app.get("/api/rate-cards", requireAuth, async (req: any, res) => {
    try {
      const { tradeType } = req.query;
      const rateCards = await storage.getRateCards(req.userId, tradeType);
      res.json(rateCards);
    } catch (error) {
      console.error("Error fetching rate cards:", error);
      res.status(500).json({ error: "Failed to fetch rate cards" });
    }
  });

  app.post("/api/rate-cards", requireAuth, async (req: any, res) => {
    try {
      const data = insertRateCardSchema.parse(req.body);
      const rateCard = await storage.createRateCard({ ...data, userId: req.userId });
      res.status(201).json(rateCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating rate card:", error);
      res.status(500).json({ error: "Failed to create rate card" });
    }
  });

  // Seed tradie templates endpoint
  app.post("/api/seed-tradie-templates", requireAuth, async (req: any, res) => {
    try {
      const results = {
        templates: [] as any[],
        lineItems: [] as any[],
        rateCards: [] as any[]
      };

      // Create templates
      for (const template of tradieQuoteTemplates) {
        try {
          const created = await storage.createDocumentTemplate({
            type: template.type,
            familyKey: template.familyKey,
            name: template.name,
            tradeType: template.tradeType,
            userId: 'shared', // Make templates shared across all users
            styling: template.styling,
            sections: template.sections,
            defaults: template.defaults,
            defaultLineItems: template.defaultLineItems
          });
          results.templates.push(created);
        } catch (error) {
          console.log(`Template ${template.name} may already exist, skipping...`);
        }
      }

      // Create line items
      for (const item of tradieLineItems) {
        try {
          const created = await storage.createLineItemCatalogItem({
            tradeType: item.tradeType,
            name: item.name,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice.toString(),
            defaultQty: item.defaultQty.toString(),
            userId: 'shared', // Make line items shared across all users
            tags: []
          });
          results.lineItems.push(created);
        } catch (error) {
          console.log(`Line item ${item.name} may already exist, skipping...`);
        }
      }

      // Create rate cards
      for (const rateCard of tradieRateCards) {
        try {
          const created = await storage.createRateCard({
            name: rateCard.name,
            tradeType: rateCard.tradeType,
            hourlyRate: rateCard.hourlyRate.toString(),
            calloutFee: rateCard.calloutFee.toString(),
            materialMarkupPct: rateCard.materialMarkupPct.toString(),
            afterHoursMultiplier: rateCard.afterHoursMultiplier.toString(),
            gstEnabled: rateCard.gstEnabled,
            userId: 'shared' // Make rate cards shared across all users
          });
          results.rateCards.push(created);
        } catch (error) {
          console.log(`Rate card ${rateCard.name} may already exist, skipping...`);
        }
      }

      res.json({
        message: "Tradie templates seeded successfully",
        created: {
          templates: results.templates.length,
          lineItems: results.lineItems.length,
          rateCards: results.rateCards.length
        }
      });
    } catch (error) {
      console.error("Error seeding tradie templates:", error);
      res.status(500).json({ error: "Failed to seed tradie templates" });
    }
  });

  // Object Storage Routes for logo uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req: any, res) => {
    try {
      console.log("[Upload] Generating upload URL for user:", req.userId);
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("[Upload] Upload URL generated successfully");
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("[Upload] Error getting upload URL:", error?.message || error);
      console.error("[Upload] Stack:", error?.stack);
      res.status(500).json({ error: "Failed to get upload URL", details: error?.message });
    }
  });

  app.put("/api/logo", requireAuth, async (req: any, res) => {
    if (!req.body.logoURL) {
      return res.status(400).json({ error: "logoURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.logoURL);
      
      // Update business settings with logo URL and detected colors
      const updateData: any = { logoUrl: objectPath };
      if (req.body.detectedColors && Array.isArray(req.body.detectedColors)) {
        updateData.detectedColors = req.body.detectedColors;
      }

      const settings = await storage.updateBusinessSettings(req.userId, updateData);
      
      res.status(200).json({
        objectPath,
        settings
      });
    } catch (error) {
      console.error("Error setting logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== ADVANCED FEATURES API ROUTES =====

  // Time Tracking Routes
  app.get("/api/time-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.query.jobId as string | undefined;
      
      const timeEntries = await storage.getTimeEntries(userId, jobId);
      res.json(timeEntries);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      res.status(500).json({ error: 'Failed to fetch time entries' });
    }
  });

  app.get("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const timeEntry = await storage.getTimeEntry(id, userId);
      if (!timeEntry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      res.json(timeEntry);
    } catch (error) {
      console.error('Error fetching time entry:', error);
      res.status(500).json({ error: 'Failed to fetch time entry' });
    }
  });

  app.post("/api/time-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const data = insertTimeEntrySchema.parse(req.body);
      
      // Check for existing active timer to prevent overlap (with team context)
      const activeEntry = await storage.getActiveTimeEntry(userId);
      if (activeEntry) {
        return res.status(409).json({ 
          error: 'Active timer already running', 
          activeEntry: {
            id: activeEntry.id,
            description: activeEntry.description,
            startTime: activeEntry.startTime,
            jobId: activeEntry.jobId
          }
        });
      }

      // For team-based businesses, check if job already has active timer from any team member
      if (data.jobId) {
        const activeJobTimer = await storage.getActiveTimeEntryForJob(data.jobId);
        if (activeJobTimer && activeJobTimer.userId !== userId) {
          return res.status(409).json({
            error: 'Job already has active timer from another team member',
            activeJobTimer: {
              id: activeJobTimer.id,
              description: activeJobTimer.description,
              startTime: activeJobTimer.startTime,
              userId: activeJobTimer.userId
            }
          });
        }
      }
      
      const timeEntry = await storage.createTimeEntry({
        ...data,
        userId,
        startTime: data.startTime || new Date(),
        isBreak: data.isBreak || false,
        isOvertime: data.isOvertime || false,
        hourlyRate: data.hourlyRate || '85.00', // Ensure string format for decimal
      } as InsertTimeEntry & { userId: string });
      
      res.status(201).json(timeEntry);
    } catch (error) {
      console.error('Error creating time entry:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid time entry data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create time entry' });
    }
  });

  app.put("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const data = insertTimeEntrySchema.partial().parse(req.body);
      
      // Verify ownership before update (with team/supervisor context)
      const existingEntry = await storage.getTimeEntry(id, userId);
      if (!existingEntry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      // Allow supervisors to edit team member timers
      let canManageEntry = (existingEntry as any).userId === userId; // Owner can always manage
      
      // Check if current user can manage this entry (supervisor access)
      if (!canManageEntry && (existingEntry as any).userId !== userId) {
        // For now, implement basic supervisor logic - get all team members under this user
        const teamMembers = await storage.getTeamMembers(userId);
        const isTeamMember = teamMembers.some((member: any) => member.id === (existingEntry as any).userId);
        canManageEntry = isTeamMember;
      }
      
      if (!canManageEntry) {
        return res.status(403).json({ error: 'Access denied - not your time entry or team member' });
      }
      
      // Prevent modification of startTime on active timer, but allow setting endTime to stop it
      if (!existingEntry.endTime && data.startTime) {
        return res.status(400).json({ error: 'Cannot modify start time of active timer' });
      }
      
      const timeEntry = await storage.updateTimeEntry(id, userId, data);
      if (!timeEntry) {
        return res.status(500).json({ error: 'Failed to update time entry' });
      }
      
      res.json(timeEntry);
    } catch (error) {
      console.error('Error updating time entry:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid time entry data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update time entry' });
    }
  });

  app.delete("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteTimeEntry(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting time entry:', error);
      res.status(500).json({ error: 'Failed to delete time entry' });
    }
  });

  app.post("/api/time-entries/:id/stop", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Verify ownership and current active status (with team/supervisor context)
      const existingEntry = await storage.getTimeEntry(id, userId);
      if (!existingEntry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      if (existingEntry.endTime) {
        return res.status(400).json({ error: 'Time entry already stopped' });
      }
      
      // Allow supervisors to stop team member timers
      let canManageEntry = (existingEntry as any).userId === userId; // Owner can always manage
      
      // Check if current user can manage this entry (supervisor access)
      if (!canManageEntry && (existingEntry as any).userId !== userId) {
        // For now, implement basic supervisor logic - get all team members under this user
        const teamMembers = await storage.getTeamMembers(userId);
        const isTeamMember = teamMembers.some((member: any) => member.id === (existingEntry as any).userId);
        canManageEntry = isTeamMember;
      }
      
      if (!canManageEntry) {
        return res.status(403).json({ error: 'Access denied - not your time entry or team member' });
      }
      
      // Server-side timestamp for integrity
      const stoppedEntry = await storage.stopTimeEntry(id, userId);
      if (!stoppedEntry) {
        return res.status(500).json({ error: 'Failed to stop time entry' });
      }
      
      res.json(stoppedEntry);
    } catch (error) {
      console.error('Error stopping time entry:', error);
      res.status(500).json({ error: 'Failed to stop time entry' });
    }
  });

  app.get("/api/time-entries/active/current", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const activeEntry = await storage.getActiveTimeEntry(userId);
      res.json(activeEntry || null);
    } catch (error) {
      console.error('Error fetching active time entry:', error);
      res.status(500).json({ error: 'Failed to fetch active time entry' });
    }
  });

  app.post("/api/time-entries/:id/pause", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const existingEntry = await storage.getTimeEntry(id, userId);
      if (!existingEntry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      if (existingEntry.endTime) {
        return res.status(400).json({ error: 'Cannot pause a completed time entry' });
      }
      
      if ((existingEntry as any).isPaused) {
        return res.status(400).json({ error: 'Time entry is already paused' });
      }
      
      let canManageEntry = (existingEntry as any).userId === userId;
      if (!canManageEntry) {
        const teamMembers = await storage.getTeamMembers(userId);
        const isTeamMember = teamMembers.some((member: any) => member.id === (existingEntry as any).userId);
        canManageEntry = isTeamMember;
      }
      
      if (!canManageEntry) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const pausedEntry = await storage.updateTimeEntry(id, userId, {
        isPaused: true,
        pausedAt: new Date().toISOString(),
      });
      
      res.json(pausedEntry);
    } catch (error) {
      console.error('Error pausing time entry:', error);
      res.status(500).json({ error: 'Failed to pause time entry' });
    }
  });

  app.post("/api/time-entries/:id/resume", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const existingEntry = await storage.getTimeEntry(id, userId);
      if (!existingEntry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }
      
      if (existingEntry.endTime) {
        return res.status(400).json({ error: 'Cannot resume a completed time entry' });
      }
      
      if (!(existingEntry as any).isPaused) {
        return res.status(400).json({ error: 'Time entry is not paused' });
      }
      
      let canManageEntry = (existingEntry as any).userId === userId;
      if (!canManageEntry) {
        const teamMembers = await storage.getTeamMembers(userId);
        const isTeamMember = teamMembers.some((member: any) => member.id === (existingEntry as any).userId);
        canManageEntry = isTeamMember;
      }
      
      if (!canManageEntry) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const pausedAt = new Date((existingEntry as any).pausedAt || Date.now());
      const pauseDuration = Math.floor((Date.now() - pausedAt.getTime()) / 60000);
      const currentPausedDuration = (existingEntry as any).pausedDuration || 0;
      
      const resumedEntry = await storage.updateTimeEntry(id, userId, {
        isPaused: false,
        pausedAt: null,
        pausedDuration: currentPausedDuration + pauseDuration,
      });
      
      res.json(resumedEntry);
    } catch (error) {
      console.error('Error resuming time entry:', error);
      res.status(500).json({ error: 'Failed to resume time entry' });
    }
  });

  // Timesheet Routes with Enterprise Features
  app.get("/api/timesheets", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate, includeEntries } = req.query;
      
      const timesheets = await storage.getTimesheets(userId);
      
      // Add enterprise-grade aggregation if includeEntries is requested
      if (includeEntries === 'true') {
        const enrichedTimesheets = await Promise.all(
          timesheets.map(async (timesheet) => {
            const entries = await storage.getTimeEntries(userId);
            const weekStart = new Date(timesheet.weekStarting);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            // Filter entries for this week
            const weekEntries = entries.filter(entry => {
              const entryDate = new Date(entry.startTime);
              return entryDate >= weekStart && entryDate < weekEnd;
            });
            
            // Calculate aggregations
            const totalHours = weekEntries.reduce((sum, entry) => {
              return sum + (entry.duration || 0);
            }, 0) / 60; // Convert minutes to hours
            
            const regularHours = weekEntries
              .filter(entry => !entry.isOvertime)
              .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 60;
            
            const overtimeHours = weekEntries
              .filter(entry => entry.isOvertime)
              .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 60;
            
            const breakHours = weekEntries
              .filter(entry => entry.isBreak)
              .reduce((sum, entry) => sum + (entry.duration || 0), 0) / 60;
            
            // Calculate earnings if hourly rate available
            const avgHourlyRate = weekEntries
              .filter(entry => entry.hourlyRate)
              .reduce((sum, entry, _, arr) => sum + parseFloat(entry.hourlyRate!), 0) / 
              weekEntries.filter(entry => entry.hourlyRate).length || 0;
            
            const regularEarnings = regularHours * avgHourlyRate;
            const overtimeEarnings = overtimeHours * avgHourlyRate * 1.5; // 1.5x overtime rate
            const totalEarnings = regularEarnings + overtimeEarnings;
            
            return {
              ...timesheet,
              entries: weekEntries,
              aggregations: {
                totalHours: parseFloat(totalHours.toFixed(2)),
                regularHours: parseFloat(regularHours.toFixed(2)),
                overtimeHours: parseFloat(overtimeHours.toFixed(2)),
                breakHours: parseFloat(breakHours.toFixed(2)),
                avgHourlyRate: parseFloat(avgHourlyRate.toFixed(2)),
                regularEarnings: parseFloat(regularEarnings.toFixed(2)),
                overtimeEarnings: parseFloat(overtimeEarnings.toFixed(2)),
                totalEarnings: parseFloat(totalEarnings.toFixed(2)),
                entryCount: weekEntries.length
              }
            };
          })
        );
        
        return res.json(enrichedTimesheets);
      }
      
      res.json(timesheets);
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      res.status(500).json({ error: 'Failed to fetch timesheets' });
    }
  });

  app.get("/api/timesheets/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const timesheet = await storage.getTimesheet(id, userId);
      if (!timesheet) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }
      
      res.json(timesheet);
    } catch (error) {
      console.error('Error fetching timesheet:', error);
      res.status(500).json({ error: 'Failed to fetch timesheet' });
    }
  });

  app.post("/api/timesheets", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const data = insertTimesheetSchema.parse(req.body);
      
      const timesheet = await storage.createTimesheet({
        ...data,
        userId
      });
      
      res.status(201).json(timesheet);
    } catch (error) {
      console.error('Error creating timesheet:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid timesheet data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create timesheet' });
    }
  });

  app.put("/api/timesheets/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const data = insertTimesheetSchema.partial().parse(req.body);
      
      const timesheet = await storage.updateTimesheet(id, userId, data);
      if (!timesheet) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }
      
      res.json(timesheet);
    } catch (error) {
      console.error('Error updating timesheet:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid timesheet data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update timesheet' });
    }
  });

  // Expense Management Routes
  // Expense Categories
  app.get("/api/expense-categories", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      let categories = await storage.getExpenseCategories(userId);
      
      if (categories.length === 0) {
        const defaultCategories = [
          { name: 'Materials', description: 'Construction materials, parts, supplies' },
          { name: 'Equipment', description: 'Tools, machinery, equipment hire' },
          { name: 'Travel', description: 'Fuel, mileage, transport costs' },
          { name: 'Subcontractor', description: 'Payments to subcontractors' },
          { name: 'Other', description: 'Miscellaneous expenses' },
        ];
        for (const cat of defaultCategories) {
          await storage.createExpenseCategory({ ...cat, userId, isActive: true });
        }
        categories = await storage.getExpenseCategories(userId);
      }
      
      res.json(categories);
    } catch (error) {
      console.error("Get expense categories error:", error);
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expense-categories", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const data = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory({
        ...data,
        userId,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Create expense category error:", error);
      res.status(400).json({ error: "Invalid expense category data" });
    }
  });

  app.put("/api/expense-categories/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const data = insertExpenseCategorySchema.partial().parse(req.body);
      const category = await storage.updateExpenseCategory(id, userId, data);
      if (!category) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Update expense category error:", error);
      res.status(400).json({ error: "Invalid expense category data" });
    }
  });

  app.delete("/api/expense-categories/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const success = await storage.deleteExpenseCategory(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete expense category error:", error);
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });

  // Expenses
  app.get("/api/expenses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, categoryId, startDate, endDate } = req.query;
      const expenses = await storage.getExpenses(userId, {
        jobId: jobId as string,
        categoryId: categoryId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const expense = await storage.getExpense(id, userId);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Get expense error:", error);
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const data = insertExpenseSchema.parse(req.body);
      
      // Validate job ownership if jobId is provided
      if (data.jobId) {
        const job = await storage.getJob(data.jobId, userId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
      }

      const expense = await storage.createExpense({
        ...data,
        userId,
      });
      res.status(201).json(expense);
    } catch (error) {
      console.error("Create expense error:", error);
      res.status(400).json({ error: "Invalid expense data" });
    }
  });

  app.put("/api/expenses/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const data = insertExpenseSchema.partial().parse(req.body);
      
      // Validate job ownership if jobId is being updated
      if (data.jobId) {
        const job = await storage.getJob(data.jobId, userId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
      }

      const expense = await storage.updateExpense(id, userId, data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(400).json({ error: "Invalid expense data" });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const success = await storage.deleteExpense(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Job Profitability Reports
  app.get("/api/jobs/:id/profitability", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      
      // Get job details
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get job revenue (from invoices)
      const invoices = await storage.getInvoices(userId);
      const jobInvoices = invoices.filter(invoice => invoice.jobId === jobId);
      const totalRevenue = jobInvoices.reduce((sum, invoice) => {
        return sum + (invoice.status === 'paid' ? parseFloat(invoice.total || '0') : 0);
      }, 0);

      // Get job expenses
      const expenses = await storage.getExpenses(userId, { jobId });
      const totalExpenses = expenses.reduce((sum, expense) => {
        return sum + parseFloat(expense.amount || '0');
      }, 0);

      // Get time tracking costs
      const timeEntries = await storage.getTimeEntries(userId, jobId);
      const totalLaborCost = timeEntries
        .filter(entry => entry.endTime)
        .reduce((sum, entry) => {
          const start = new Date(entry.startTime);
          const end = new Date(entry.endTime!);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const rate = parseFloat(entry.hourlyRate?.toString() || '0');
          return sum + (hours * rate);
        }, 0);

      const totalCosts = totalExpenses + totalLaborCost;
      const profit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;

      res.json({
        jobId,
        jobTitle: job.title,
        revenue: {
          invoiced: totalRevenue,
          pending: jobInvoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0)
        },
        costs: {
          materials: totalExpenses,
          labor: totalLaborCost,
          total: totalCosts
        },
        profit: {
          amount: profit,
          margin: profitMargin
        },
        expenses: expenses.map(expense => ({
          id: expense.id,
          description: expense.description,
          amount: parseFloat(expense.amount || '0'),
          category: expense.categoryName || 'Uncategorized',
          date: expense.expenseDate,
          receiptUrl: expense.receiptUrl
        })),
        timeEntries: timeEntries.filter(entry => entry.endTime).map(entry => ({
          id: entry.id,
          description: entry.description,
          hours: ((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60)).toFixed(2),
          rate: entry.hourlyRate,
          cost: ((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60)) * parseFloat(entry.hourlyRate?.toString() || '0'),
          date: entry.startTime
        }))
      });
    } catch (error) {
      console.error("Get job profitability error:", error);
      res.status(500).json({ error: "Failed to fetch job profitability" });
    }
  });

  // Expense Reports
  app.get("/api/reports/expenses", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { period = 'month', startDate, endDate, groupBy = 'category' } = req.query;
      
      let dateFilter: { startDate?: string; endDate?: string } = {};
      
      if (startDate && endDate) {
        dateFilter = { startDate: startDate as string, endDate: endDate as string };
      } else {
        // Default period handling
        const now = new Date();
        const start = new Date();
        
        switch (period) {
          case 'week':
            start.setDate(now.getDate() - 7);
            break;
          case 'month':
            start.setMonth(now.getMonth() - 1);
            break;
          case 'quarter':
            start.setMonth(now.getMonth() - 3);
            break;
          case 'year':
            start.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        dateFilter = {
          startDate: start.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      }

      const expenses = await storage.getExpenses(userId, dateFilter);
      const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || '0'), 0);

      // Group expenses
      let groupedExpenses: any = {};
      
      if (groupBy === 'category') {
        groupedExpenses = expenses.reduce((groups: any, expense) => {
          const category = expense.categoryName || 'Uncategorized';
          if (!groups[category]) {
            groups[category] = { total: 0, count: 0, expenses: [] };
          }
          groups[category].total += parseFloat(expense.amount || '0');
          groups[category].count += 1;
          groups[category].expenses.push(expense);
          return groups;
        }, {});
      } else if (groupBy === 'job') {
        groupedExpenses = expenses.reduce((groups: any, expense) => {
          const jobTitle = expense.jobTitle || 'No Job';
          if (!groups[jobTitle]) {
            groups[jobTitle] = { total: 0, count: 0, expenses: [] };
          }
          groups[jobTitle].total += parseFloat(expense.amount || '0');
          groups[jobTitle].count += 1;
          groups[jobTitle].expenses.push(expense);
          return groups;
        }, {});
      }

      res.json({
        period: {
          start: dateFilter.startDate,
          end: dateFilter.endDate,
          type: period
        },
        summary: {
          totalExpenses: expenses.length,
          totalAmount,
          averageExpense: expenses.length > 0 ? totalAmount / expenses.length : 0
        },
        grouped: groupedExpenses,
        expenses: expenses.slice(0, 50) // Limit for performance
      });
    } catch (error) {
      console.error("Get expense reports error:", error);
      res.status(500).json({ error: "Failed to generate expense report" });
    }
  });

  // Enterprise-grade time reporting endpoints
  app.get("/api/time-tracking/reports/payroll", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate, format = 'summary' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Get all time entries in the date range
      const allEntries = await storage.getTimeEntries(userId);
      const rangeEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate >= start && entryDate <= end && entry.endTime; // Only completed entries
      });
      
      if (format === 'detailed') {
        // Group by job for detailed breakdown
        const jobBreakdown = rangeEntries.reduce((acc, entry) => {
          const jobId = entry.jobId || 'unassigned';
          if (!acc[jobId]) {
            acc[jobId] = {
              jobId,
              entries: [],
              totalHours: 0,
              regularHours: 0,
              overtimeHours: 0,
              breakHours: 0,
              totalEarnings: 0
            };
          }
          
          const duration = (entry.duration || 0) / 60; // Convert to hours
          const hourlyRate = parseFloat(entry.hourlyRate || '0');
          
          acc[jobId].entries.push(entry);
          acc[jobId].totalHours += duration;
          
          if (entry.isBreak) {
            acc[jobId].breakHours += duration;
          } else if (entry.isOvertime) {
            acc[jobId].overtimeHours += duration;
            acc[jobId].totalEarnings += duration * hourlyRate * 1.5;
          } else {
            acc[jobId].regularHours += duration;
            acc[jobId].totalEarnings += duration * hourlyRate;
          }
          
          return acc;
        }, {} as any);
        
        return res.json({
          period: { startDate, endDate },
          jobBreakdown: Object.values(jobBreakdown),
          totalJobs: Object.keys(jobBreakdown).length
        });
      }
      
      // Summary format (default)
      const summary = rangeEntries.reduce((acc, entry) => {
        const duration = (entry.duration || 0) / 60;
        const hourlyRate = parseFloat(entry.hourlyRate || '0');
        
        acc.totalHours += duration;
        acc.totalEntries += 1;
        
        if (entry.isBreak) {
          acc.breakHours += duration;
        } else if (entry.isOvertime) {
          acc.overtimeHours += duration;
          acc.totalEarnings += duration * hourlyRate * 1.5;
        } else {
          acc.regularHours += duration;
          acc.totalEarnings += duration * hourlyRate;
        }
        
        if (hourlyRate > 0) {
          acc.rateEntries += 1;
          acc.totalRate += hourlyRate;
        }
        
        return acc;
      }, {
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        breakHours: 0,
        totalEarnings: 0,
        totalEntries: 0,
        rateEntries: 0,
        totalRate: 0
      });
      
      const avgHourlyRate = summary.rateEntries > 0 ? summary.totalRate / summary.rateEntries : 0;
      
      res.json({
        period: { startDate, endDate },
        summary: {
          totalHours: parseFloat(summary.totalHours.toFixed(2)),
          regularHours: parseFloat(summary.regularHours.toFixed(2)),
          overtimeHours: parseFloat(summary.overtimeHours.toFixed(2)),
          breakHours: parseFloat(summary.breakHours.toFixed(2)),
          billableHours: parseFloat((summary.totalHours - summary.breakHours).toFixed(2)),
          totalEarnings: parseFloat(summary.totalEarnings.toFixed(2)),
          avgHourlyRate: parseFloat(avgHourlyRate.toFixed(2)),
          totalEntries: summary.totalEntries
        }
      });
    } catch (error) {
      console.error('Error generating payroll report:', error);
      res.status(500).json({ error: 'Failed to generate payroll report' });
    }
  });

  app.get("/api/time-tracking/dashboard", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Get current active timer
      const activeTimer = await storage.getActiveTimeEntry(userId);
      
      // Get today's entries
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const allEntries = await storage.getTimeEntries(userId);
      const todayEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate >= startOfDay && entryDate < endOfDay;
      });
      
      // Calculate today's totals
      const todayTotals = todayEntries.reduce((acc, entry) => {
        const duration = (entry.duration || 0) / 60;
        acc.totalHours += duration;
        if (!entry.isBreak) {
          acc.billableHours += duration;
        }
        return acc;
      }, { totalHours: 0, billableHours: 0 });
      
      // Get this week's totals
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weekEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate >= startOfWeek;
      });
      
      const weekTotals = weekEntries.reduce((acc, entry) => {
        const duration = (entry.duration || 0) / 60;
        acc.totalHours += duration;
        if (!entry.isBreak) {
          acc.billableHours += duration;
        }
        return acc;
      }, { totalHours: 0, billableHours: 0 });
      
      res.json({
        activeTimer: activeTimer ? {
          id: activeTimer.id,
          description: activeTimer.description,
          startTime: activeTimer.startTime,
          jobId: activeTimer.jobId,
          elapsedMinutes: activeTimer.startTime ? 
            Math.floor((new Date().getTime() - new Date(activeTimer.startTime).getTime()) / (1000 * 60)) : 0
        } : null,
        today: {
          totalHours: parseFloat(todayTotals.totalHours.toFixed(2)),
          billableHours: parseFloat(todayTotals.billableHours.toFixed(2)),
          entriesCount: todayEntries.length
        },
        week: {
          totalHours: parseFloat(weekTotals.totalHours.toFixed(2)),
          billableHours: parseFloat(weekTotals.billableHours.toFixed(2)),
          entriesCount: weekEntries.length
        },
        recentEntries: todayEntries.slice(0, 5)
      });
    } catch (error) {
      console.error('Error fetching time tracking dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // ===== JOB CHECK-INS (GPS Location Tracking) =====
  
  // Get check-ins for a job
  app.get("/api/job-checkins/:jobId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const checkins = await storage.getJobCheckins(jobId, userId);
      res.json(checkins);
    } catch (error) {
      console.error('Error fetching job check-ins:', error);
      res.status(500).json({ error: 'Failed to fetch check-ins' });
    }
  });
  
  // Create a new check-in
  app.post("/api/job-checkins", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, type, latitude, longitude, accuracy, notes } = req.body;
      
      if (!jobId || !type) {
        return res.status(400).json({ error: 'jobId and type are required' });
      }
      
      const checkin = await storage.createJobCheckin({
        jobId,
        userId,
        type,
        latitude: latitude || null,
        longitude: longitude || null,
        accuracy: accuracy || null,
        notes: notes || null,
      });
      
      res.status(201).json(checkin);
    } catch (error) {
      console.error('Error creating job check-in:', error);
      res.status(500).json({ error: 'Failed to create check-in' });
    }
  });
  
  // Get latest check-in for a job
  app.get("/api/job-checkins/:jobId/latest", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const latestCheckin = await storage.getLatestCheckin(jobId, userId);
      res.json(latestCheckin || null);
    } catch (error) {
      console.error('Error fetching latest check-in:', error);
      res.status(500).json({ error: 'Failed to fetch latest check-in' });
    }
  });

  // ===== TEAM MANAGEMENT ROUTES =====
  
  // Distinct color palette for team members - auto-assigned based on index
  const TEAM_MEMBER_COLOR_PALETTE = [
    '#3B82F6', // Blue
    '#22C55E', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#84CC16', // Lime
    '#06B6D4', // Cyan
    '#A855F7', // Violet
  ];

  // Get all team members for the current user (business owner)
  app.get("/api/team/members", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Fetch team members, all roles, and member user data in parallel
      const [teamMembers, allRoles] = await Promise.all([
        storage.getTeamMembers(userId),
        storage.getUserRoles()
      ]);
      
      // Create a lookup map for O(1) role access
      const roleMap = new Map(allRoles.map(role => [role.id, role]));
      
      // Fetch user data for members that have accepted invites
      // Auto-persist default colors if not already set
      const memberUserPromises = teamMembers.map(async (member, index) => {
        const defaultColor = TEAM_MEMBER_COLOR_PALETTE[index % TEAM_MEMBER_COLOR_PALETTE.length];
        let themeColor = defaultColor;
        
        if (member.memberId) {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser?.themeColor) {
            themeColor = memberUser.themeColor;
          } else if (memberUser) {
            // Auto-persist default color so it's consistent across all endpoints
            await storage.updateUser(member.memberId, { themeColor: defaultColor });
            console.log(`[TeamMembers] Auto-assigned color ${defaultColor} to ${memberUser.email}`);
          }
        }
        
        const role = roleMap.get(member.roleId);
        return {
          ...member,
          userId: member.memberId, // Mobile app expects userId, database stores memberId
          roleName: role?.name || 'Team Member',
          roleDescription: role?.description || '',
          themeColor,
        };
      });
      
      const enrichedMembers = await Promise.all(memberUserPromises);
      
      res.json(enrichedMembers);
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({ error: 'Failed to fetch team members' });
    }
  });

  // Update team member's theme color
  app.patch("/api/team/members/:memberId/color", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { memberId } = req.params;
      const { themeColor } = req.body;
      
      if (!themeColor || !/^#[0-9A-Fa-f]{6}$/.test(themeColor)) {
        return res.status(400).json({ error: 'Invalid color format. Use hex format like #3B82F6' });
      }
      
      // Get the team member to find their user ID
      const teamMember = await storage.getTeamMember(memberId, userId);
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      if (!teamMember.memberId) {
        return res.status(400).json({ error: 'Team member has not accepted invitation yet' });
      }
      
      // Update the user's theme color
      const updatedUser = await storage.updateUser(teamMember.memberId, { themeColor });
      
      res.json({ success: true, themeColor: updatedUser?.themeColor || themeColor });
    } catch (error) {
      console.error('Error updating team member color:', error);
      res.status(500).json({ error: 'Failed to update color' });
    }
  });

  // Invite a new team member
  app.post("/api/team/members/invite", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Validate request data - omit fields that the server provides
      const inviteRequestSchema = insertTeamMemberSchema.omit({
        businessOwnerId: true,
        memberId: true,
        inviteToken: true,
        inviteSentAt: true,
        inviteStatus: true,
        inviteAcceptedAt: true,
      });
      
      let inviteData;
      try {
        inviteData = inviteRequestSchema.parse(req.body);
      } catch (validationError: any) {
        console.error('[TeamInvite] Validation failed for invite request');
        return res.status(400).json({ 
          error: 'Invalid invite data. Please check all required fields.'
        });
      }
      
      // Generate invite token
      const inviteToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const newMember = await storage.createTeamMember({
        ...inviteData,
        businessOwnerId: userId,
        inviteToken,
        inviteSentAt: new Date(),
        inviteStatus: 'pending',
      });
      
      // Send invitation email
      try {
        const owner = await AuthService.getUserById(userId);
        const businessSettings = await storage.getBusinessSettings(userId);
        const role = await storage.getUserRole(inviteData.roleId);
        
        const inviteeName = [inviteData.firstName, inviteData.lastName].filter(Boolean).join(' ') || null;
        await sendTeamInviteEmail(
          inviteData.email,
          inviteeName,
          owner?.firstName || 'The business owner',
          businessSettings?.businessName || 'A TradieTrack business',
          role?.name || 'Team Member',
          inviteToken,
          getProductionBaseUrl(req)
        );
      } catch (emailError) {
        console.error('Failed to send team invite email:', emailError);
        // Don't fail the invite if email fails
      }
      
      res.json(newMember);
    } catch (error) {
      console.error('Error inviting team member:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  });

  // Resend invite to a team member
  app.post("/api/team/members/:id/resend-invite", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const memberId = req.params.id;
      
      const member = await storage.getTeamMember(memberId, userId);
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      if (member.inviteStatus !== 'pending') {
        return res.status(400).json({ error: 'Can only resend invites for pending members' });
      }
      
      // Update invite sent timestamp
      const updated = await storage.updateTeamMember(memberId, userId, {
        inviteSentAt: new Date(),
      });
      
      // Resend invitation email
      try {
        const owner = await AuthService.getUserById(userId);
        const businessSettings = await storage.getBusinessSettings(userId);
        const role = await storage.getUserRole(member.roleId);
        
        await sendTeamInviteEmail(
          member.email,
          member.name || null,
          owner?.firstName || 'The business owner',
          businessSettings?.businessName || 'A TradieTrack business',
          role?.name || 'Team Member',
          member.inviteToken!,
          getProductionBaseUrl(req)
        );
      } catch (emailError) {
        console.error('Failed to resend team invite email:', emailError);
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error resending invite:', error);
      res.status(500).json({ error: 'Failed to resend invitation' });
    }
  });

  // Update a team member (role, details, etc.) - owner only
  app.patch("/api/team/members/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId!;
      const memberId = req.params.id;
      const { firstName, lastName, phone, hourlyRate, role, roleId } = req.body;
      
      // getTeamMember already scopes by owner, returning null if not found or not owned
      const member = await storage.getTeamMember(memberId, effectiveUserId);
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;
      if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate?.toString();
      if (roleId !== undefined) updateData.roleId = roleId;
      
      const updated = await storage.updateTeamMember(memberId, effectiveUserId, updateData);
      res.json(updated);
    } catch (error) {
      console.error('Error updating team member:', error);
      res.status(500).json({ error: 'Failed to update team member' });
    }
  });

  // Remove a team member - owner only
  app.delete("/api/team/members/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId!;
      const memberId = req.params.id;
      
      // getTeamMember already scopes by owner, returning null if not found or not owned
      const member = await storage.getTeamMember(memberId, effectiveUserId);
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      await storage.deleteTeamMember(memberId, effectiveUserId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing team member:', error);
      res.status(500).json({ error: 'Failed to remove team member' });
    }
  });

  // Validate team invite token (public endpoint - no auth required)
  app.get("/api/team/invite/validate/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.json({ valid: false, error: 'No token provided' });
      }
      
      const teamMember = await storage.getTeamMemberByInviteToken(token);
      
      if (!teamMember) {
        return res.json({ valid: false, error: 'Invalid or expired invitation token' });
      }
      
      if (teamMember.inviteStatus !== 'pending') {
        return res.json({ valid: false, error: 'This invitation has already been used' });
      }
      
      // Get additional info for the invite
      const [businessSettings, role, owner] = await Promise.all([
        storage.getBusinessSettings(teamMember.businessOwnerId),
        storage.getUserRole(teamMember.roleId),
        AuthService.getUserById(teamMember.businessOwnerId)
      ]);
      
      res.json({
        valid: true,
        invite: {
          businessName: businessSettings?.businessName || 'A TradieTrack business',
          roleName: role?.name || 'Team Member',
          email: teamMember.email,
          inviterName: owner?.firstName ? `${owner.firstName}${owner.lastName ? ' ' + owner.lastName : ''}` : 'The business owner',
          firstName: teamMember.firstName,
          lastName: teamMember.lastName,
        }
      });
    } catch (error) {
      console.error('Error validating invite token:', error);
      res.status(500).json({ valid: false, error: 'Failed to validate invitation' });
    }
  });

  // Accept team invitation (public endpoint - handles both logged in and new users)
  app.post("/api/team/invite/accept/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ success: false, error: 'No token provided' });
      }
      
      const teamMember = await storage.getTeamMemberByInviteToken(token);
      
      if (!teamMember) {
        return res.status(404).json({ success: false, error: 'Invalid or expired invitation token' });
      }
      
      if (teamMember.inviteStatus !== 'pending') {
        return res.status(400).json({ success: false, error: 'This invitation has already been used' });
      }
      
      let user: any;
      let isNewUser = false;
      
      // Check if user is already authenticated
      if (req.session?.userId) {
        // User is logged in - link their existing account
        user = await AuthService.getUserById(req.session.userId);
        if (!user) {
          return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
        }
        
        // Check if this user is already a member of this team
        const existingMembership = await storage.getTeamMemberByUserIdAndBusiness(user.id, teamMember.businessOwnerId);
        if (existingMembership) {
          return res.status(400).json({ success: false, error: 'You are already a member of this team' });
        }
      } else {
        // User is not logged in - check for registration data
        const { email, password, firstName, lastName } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({ 
            success: false, 
            error: 'Please provide registration details (email, password) or log in first' 
          });
        }
        
        // Validate email matches the invitation
        if (email.toLowerCase() !== teamMember.email.toLowerCase()) {
          return res.status(400).json({ 
            success: false, 
            error: 'Email address must match the invitation email' 
          });
        }
        
        // Check if user already exists with this email
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            error: 'An account with this email already exists. Please log in first to accept this invitation.' 
          });
        }
        
        // Create new user account
        const registerResult = await AuthService.register({
          email,
          password,
          username: email.split('@')[0] + '_' + Date.now().toString(36),
          firstName: firstName || teamMember.firstName || undefined,
          lastName: lastName || teamMember.lastName || undefined,
        });
        
        if (!registerResult.success) {
          return res.status(400).json({ success: false, error: registerResult.error });
        }
        
        user = registerResult.user;
        isNewUser = true;
        
        // Mark email as verified since they received the invite email
        await storage.updateUser(user.id, { emailVerified: true });
      }
      
      // Update the team member record to accept the invitation
      await storage.updateTeamMember(teamMember.id, teamMember.businessOwnerId, {
        memberId: user.id,
        inviteStatus: 'accepted',
        inviteAcceptedAt: new Date(),
        inviteToken: null, // Clear the token so it can't be reused
      });
      
      // Auto-login the user if they just registered
      if (isNewUser) {
        req.session.userId = user.id;
      }
      
      // Get the updated user data
      const safeUser = await AuthService.getUserById(user.id);
      
      res.json({ 
        success: true, 
        user: safeUser, 
        message: 'Invitation accepted successfully' 
      });
    } catch (error) {
      console.error('Error accepting team invitation:', error);
      res.status(500).json({ success: false, error: 'Failed to accept invitation' });
    }
  });

  // Get all user roles
  app.get("/api/team/roles", requireAuth, async (req: any, res) => {
    try {
      const roles = await storage.getUserRoles();
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  // Create a new user role
  app.post("/api/team/roles", requireAuth, async (req: any, res) => {
    try {
      const roleData = insertUserRoleSchema.parse(req.body);
      const newRole = await storage.createUserRole(roleData);
      res.json(newRole);
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ error: 'Failed to create role' });
    }
  });

  // Update a user role
  app.patch("/api/team/roles/:id", requireAuth, async (req: any, res) => {
    try {
      const roleId = req.params.id;
      const { name, description } = req.body;
      
      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Role name is required and cannot be empty' });
      }
      
      // Don't allow editing system roles (OWNER)
      const existingRoles = await storage.getUserRoles();
      const roleToEdit = existingRoles.find(r => r.id === roleId);
      
      if (!roleToEdit) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      if (roleToEdit.name === 'OWNER') {
        return res.status(403).json({ error: 'Cannot edit system roles' });
      }
      
      const updatedRole = await storage.updateUserRole(roleId, { 
        name: name.trim(), 
        description: description?.trim() || '' 
      });
      res.json(updatedRole);
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  // Get current user's role (if they're a team member or business owner)
  app.get("/api/team/my-role", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Check if this user is a team member of someone else's business
      const myMembership = await storage.getTeamMembershipByMemberId(userId);
      
      if (!myMembership || myMembership.inviteStatus !== 'accepted') {
        // User is not a team member - check if they're a business owner
        const user = await storage.getUser(userId);
        if (user) {
          // Return owner role for business owners
          return res.json({
            role: 'owner',
            permissions: {
              canViewDashboard: true,
              canManageJobs: true,
              canManageClients: true,
              canManageQuotes: true,
              canManageInvoices: true,
              canManageTeam: true,
              canViewReports: true,
              canManageSettings: true,
              canViewMap: true,
              canAccessDispatch: true,
            },
            ownerId: userId,
            isOwner: true,
          });
        }
        return res.status(404).json({ error: 'Not a team member' });
      }
      
      // Get role details
      const role = await storage.getUserRole(myMembership.roleId);
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      // Use custom permissions if enabled, otherwise use role defaults
      const effectivePermissions = (myMembership.useCustomPermissions && myMembership.customPermissions)
        ? myMembership.customPermissions
        : (role.permissions || []);
      
      res.json({
        roleId: role.id,
        roleName: role.name,
        permissions: effectivePermissions,
        hasCustomPermissions: myMembership.useCustomPermissions || false,
        customPermissions: myMembership.customPermissions || null
      });
    } catch (error) {
      console.error('Error fetching user role:', error);
      res.status(500).json({ error: 'Failed to fetch user role' });
    }
  });
  
  // Update custom permissions for a team member (owner only)
  app.patch("/api/team/members/:id/permissions", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const memberId = req.params.id;
      const { permissions, useCustomPermissions } = req.body;
      
      // Verify the team member belongs to this owner
      const effectiveUserId = req.effectiveUserId || req.userId;
      const allMembers = await storage.getTeamMembers(effectiveUserId);
      const member = allMembers.find(m => m.id === memberId);
      
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Update the team member's custom permissions
      const updated = await storage.updateTeamMemberPermissions(memberId, {
        customPermissions: permissions,
        useCustomPermissions: useCustomPermissions ?? true
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating team member permissions:', error);
      res.status(500).json({ error: 'Failed to update permissions' });
    }
  });
  
  // Get available permissions list
  app.get("/api/team/permissions", requireAuth, async (req: any, res) => {
    try {
      const { PERMISSIONS } = await import('./permissions');
      
      // Return permissions with human-readable labels
      const permissionsList = Object.entries(PERMISSIONS).map(([key, value]) => ({
        key: value,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        category: getCategoryForPermission(value)
      }));
      
      res.json(permissionsList);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  });
  
  function getCategoryForPermission(permission: string): string {
    // Job media permissions get their own category
    if (permission.includes('job_notes') || permission.includes('job_media')) return 'Job Media';
    if (permission.includes('job')) return 'Jobs';
    if (permission.includes('quote')) return 'Quotes';
    if (permission.includes('invoice')) return 'Invoices';
    if (permission.includes('client')) return 'Clients';
    if (permission.includes('team')) return 'Team';
    if (permission.includes('time')) return 'Time Tracking';
    if (permission.includes('expense')) return 'Expenses';
    if (permission.includes('report')) return 'Reports';
    if (permission.includes('template')) return 'Templates';
    if (permission.includes('catalog')) return 'Catalog';
    if (permission.includes('setting')) return 'Settings';
    if (permission.includes('payment')) return 'Payments';
    return 'Other';
  }

  // Toggle location sharing for a team member (owner only)
  app.patch("/api/team/members/:id/location", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const memberId = req.params.id;
      const { locationEnabledByOwner } = req.body;
      
      if (typeof locationEnabledByOwner !== 'boolean') {
        return res.status(400).json({ error: 'locationEnabledByOwner must be a boolean' });
      }
      
      // Verify the team member belongs to this owner
      const effectiveUserId = req.effectiveUserId || req.userId;
      const allMembers = await storage.getTeamMembers(effectiveUserId);
      const member = allMembers.find(m => m.id === memberId);
      
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Update the team member's location setting
      const updated = await storage.updateTeamMemberLocationSettings(memberId, {
        locationEnabledByOwner
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating team member location settings:', error);
      res.status(500).json({ error: 'Failed to update location settings' });
    }
  });

  // Worker Command Center - Get comprehensive worker details (owner/manager only)
  app.get("/api/team/members/:id/command-center", requireAuth, async (req: any, res) => {
    try {
      const memberId = req.params.id;
      const effectiveUserId = req.effectiveUserId || req.userId;
      const requestingUserId = req.userId;
      
      // Authorization: Only business owner or managers with TEAM_VIEW permission can access
      if (requestingUserId !== effectiveUserId) {
        // Check if requesting user has TEAM_VIEW permission
        const userContext = req.userContext;
        if (!userContext?.permissions?.includes('team_view') && !userContext?.permissions?.includes('team_manage')) {
          return res.status(403).json({ error: 'You do not have permission to view team member details' });
        }
      }
      
      // Verify the team member belongs to this business
      const allMembers = await storage.getTeamMembers(effectiveUserId);
      const member = allMembers.find(m => m.id === memberId || m.memberId === memberId);
      
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Get the member's user profile
      const memberUser = member.memberId ? await storage.getUser(member.memberId) : null;
      
      // Get member's role
      const role = await storage.getUserRole(member.roleId);
      
      // Get current location status (Life360-style)
      const tradieStatusData = member.memberId ? await storage.getTradieStatus(member.memberId) : null;
      
      // Fall back to location tracking if no tradie status
      const locationData = member.memberId ? await storage.getLatestLocationForUser(member.memberId) : null;
      
      // Get recent activity logs for this member
      const allActivityLogs = await storage.getActivityLogs(effectiveUserId, 50);
      const memberActivityLogs = allActivityLogs.filter(log => 
        log.userId === member.memberId || 
        log.metadata && (log.metadata as any).assignedTo === member.memberId
      ).slice(0, 10);
      
      // Get all jobs
      const allJobs = await storage.getJobs(effectiveUserId);
      
      // Jobs assigned to this member
      const assignedJobs = allJobs.filter(job => 
        job.assignedTo === member.memberId || 
        job.assignedTo === member.id ||
        job.assignedTeamMemberId === member.id
      );
      
      // Unscheduled/unassigned jobs that could be assigned
      const unassignedJobs = allJobs.filter(job => 
        !job.assignedTo && 
        !job.assignedTeamMemberId &&
        job.status !== 'done' && 
        job.status !== 'invoiced' &&
        job.status !== 'archived'
      );
      
      // Get time entries for this member (today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const timeEntries = member.memberId ? await storage.getTimeEntriesByDateRange(
        effectiveUserId,
        today,
        new Date(),
        member.memberId
      ) : [];
      
      // Calculate today's hours
      const todayHours = timeEntries.reduce((total, entry) => {
        const start = new Date(entry.startTime);
        const end = entry.endTime ? new Date(entry.endTime) : new Date();
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);
      
      // Build location object
      const location = tradieStatusData ? {
        latitude: tradieStatusData.latitude ? parseFloat(String(tradieStatusData.latitude)) : null,
        longitude: tradieStatusData.longitude ? parseFloat(String(tradieStatusData.longitude)) : null,
        lastUpdated: tradieStatusData.updatedAt,
        status: tradieStatusData.status || 'unknown',
        currentActivity: tradieStatusData.currentActivity || null,
        batteryLevel: tradieStatusData.batteryLevel || null,
      } : locationData ? {
        latitude: locationData.latitude ? parseFloat(locationData.latitude) : null,
        longitude: locationData.longitude ? parseFloat(locationData.longitude) : null,
        lastUpdated: locationData.timestamp,
        status: 'unknown',
        currentActivity: null,
        batteryLevel: null,
      } : null;
      
      res.json({
        member: {
          id: member.id,
          memberId: member.memberId,
          firstName: member.firstName || memberUser?.firstName || '',
          lastName: member.lastName || memberUser?.lastName || '',
          email: member.email,
          phone: member.phone || memberUser?.phone || null,
          profileImageUrl: memberUser?.profileImageUrl || null,
          themeColor: memberUser?.themeColor || null,
          role: role?.name || 'Team Member',
          roleId: member.roleId,
          isActive: member.isActive,
          inviteStatus: member.inviteStatus,
          hourlyRate: member.hourlyRate,
          locationEnabledByOwner: member.locationEnabledByOwner ?? true,
          locationEnabledByUser: member.locationEnabledByUser ?? true,
        },
        location,
        stats: {
          todayHours: Math.round(todayHours * 100) / 100,
          activeTimeEntry: timeEntries.find(e => !e.endTime) || null,
          totalAssignedJobs: assignedJobs.length,
          activeJobs: assignedJobs.filter(j => j.status === 'in_progress').length,
          completedJobs: assignedJobs.filter(j => j.status === 'done' || j.status === 'invoiced').length,
        },
        assignedJobs: assignedJobs.slice(0, 10).map(job => ({
          id: job.id,
          title: job.title,
          status: job.status,
          address: job.address,
          scheduledDate: job.scheduledDate,
          priority: job.priority,
          clientId: job.clientId,
          isXeroImport: job.isXeroImport || false,
        })),
        unassignedJobs: unassignedJobs.slice(0, 10).map(job => ({
          id: job.id,
          title: job.title,
          status: job.status,
          address: job.address,
          scheduledDate: job.scheduledDate,
          priority: job.priority,
          clientId: job.clientId,
          isXeroImport: job.isXeroImport || false,
        })),
        recentActivity: memberActivityLogs.map(log => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          description: log.description,
          createdAt: log.createdAt,
          metadata: log.metadata,
        })),
      });
    } catch (error) {
      console.error('Error fetching worker command center data:', error);
      res.status(500).json({ error: 'Failed to fetch worker details' });
    }
  });

  // ===== THEME COLOR ROUTES =====
  
  // Predefined color palette for team members (professional tradie colors)
  const TEAM_COLOR_PALETTE = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Purple
    '#22C55E', // Green
    '#FACC15', // Yellow
    '#FB7185', // Rose
  ];
  
  // Get available colors for a team (colors not used by other members)
  app.get("/api/team/colors/available", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const effectiveUserId = req.effectiveUserId || userId;
      
      // Get all team members for this business
      const teamMembers = await storage.getTeamMembers(effectiveUserId);
      
      // Get the owner's color too
      const owner = await storage.getUser(effectiveUserId);
      
      // Collect all used colors (excluding current user)
      const usedColors = new Set<string>();
      
      if (owner && owner.themeColor && owner.id !== userId) {
        usedColors.add(owner.themeColor.toUpperCase());
      }
      
      for (const member of teamMembers) {
        if (member.memberId && member.memberId !== userId) {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser?.themeColor) {
            usedColors.add(memberUser.themeColor.toUpperCase());
          }
        }
      }
      
      // Get current user's color
      const currentUser = await storage.getUser(userId);
      const currentColor = currentUser?.themeColor || null;
      
      // Return palette with availability status
      const colorOptions = TEAM_COLOR_PALETTE.map(color => ({
        color,
        available: !usedColors.has(color.toUpperCase()),
        isCurrentUser: currentColor?.toUpperCase() === color.toUpperCase(),
      }));
      
      res.json({
        colors: colorOptions,
        currentColor,
        usedCount: usedColors.size,
        availableCount: TEAM_COLOR_PALETTE.length - usedColors.size,
      });
    } catch (error) {
      console.error('Error fetching available colors:', error);
      res.status(500).json({ error: 'Failed to fetch available colors' });
    }
  });
  
  // Update user preferences (theme mode, etc.) - syncs across web and mobile
  app.patch("/api/user/preferences", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const effectiveUserId = req.effectiveUserId || userId;
      const { themeMode } = req.body;
      
      // Get or create business settings
      let settings = await storage.getBusinessSettings(effectiveUserId);
      
      if (!settings) {
        return res.status(404).json({ error: 'Business settings not found' });
      }
      
      // Update theme mode if provided
      if (themeMode && ['light', 'dark', 'system'].includes(themeMode)) {
        settings = await storage.updateBusinessSettings(settings.id, { themeMode });
      }
      
      res.json({ 
        success: true,
        themeMode: settings?.themeMode || 'system'
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  // Set current user's theme color
  app.patch("/api/user/theme-color", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { themeColor } = req.body;
      
      if (!themeColor || !/^#[0-9A-Fa-f]{6}$/.test(themeColor)) {
        return res.status(400).json({ error: 'Invalid color format. Use hex format (e.g. #FF5733)' });
      }
      
      // Get effective user ID (owner of the business)
      const effectiveUserId = req.effectiveUserId || userId;
      
      // Check if color is already used by another team member
      const teamMembers = await storage.getTeamMembers(effectiveUserId);
      const owner = await storage.getUser(effectiveUserId);
      
      // Check owner's color (if not the current user)
      if (owner && owner.id !== userId && owner.themeColor?.toUpperCase() === themeColor.toUpperCase()) {
        return res.status(400).json({ error: 'This color is already used by the business owner' });
      }
      
      // Check team members' colors
      for (const member of teamMembers) {
        if (member.memberId && member.memberId !== userId) {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser?.themeColor?.toUpperCase() === themeColor.toUpperCase()) {
            return res.status(400).json({ error: 'This color is already used by another team member' });
          }
        }
      }
      
      // Update user's theme color
      const updated = await storage.updateUser(userId, { themeColor });
      
      res.json({ 
        success: true, 
        themeColor: updated.themeColor,
        message: 'Theme color updated successfully'
      });
    } catch (error) {
      console.error('Error updating theme color:', error);
      res.status(500).json({ error: 'Failed to update theme color' });
    }
  });
  
  // Get all team members with their colors and initials (for map display)
  app.get("/api/team/members/colors", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const effectiveUserId = req.effectiveUserId || userId;
      
      // Get all team members
      const teamMembers = await storage.getTeamMembers(effectiveUserId);
      const owner = await storage.getUser(effectiveUserId);
      
      const memberColors: Array<{
        userId: string;
        firstName: string;
        lastName: string;
        initials: string;
        themeColor: string;
        isOwner: boolean;
      }> = [];
      
      // Add owner
      if (owner) {
        const initials = `${owner.firstName?.charAt(0) || ''}${owner.lastName?.charAt(0) || ''}`.toUpperCase() || 'OW';
        memberColors.push({
          userId: owner.id,
          firstName: owner.firstName || 'Owner',
          lastName: owner.lastName || '',
          initials,
          themeColor: owner.themeColor || '#3B82F6',
          isOwner: true,
        });
      }
      
      // Add team members
      for (const member of teamMembers) {
        if (member.memberId && member.inviteStatus === 'accepted') {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser) {
            const initials = `${memberUser.firstName?.charAt(0) || member.firstName?.charAt(0) || ''}${memberUser.lastName?.charAt(0) || member.lastName?.charAt(0) || ''}`.toUpperCase() || 'TM';
            memberColors.push({
              userId: memberUser.id,
              firstName: memberUser.firstName || member.firstName || 'Team',
              lastName: memberUser.lastName || member.lastName || 'Member',
              initials,
              themeColor: memberUser.themeColor || '#6366F1',
              isOwner: false,
            });
          }
        }
      }
      
      res.json(memberColors);
    } catch (error) {
      console.error('Error fetching team member colors:', error);
      res.status(500).json({ error: 'Failed to fetch team member colors' });
    }
  });

  // ===== TIME TRACKING ROUTES =====
  
  // Get time entries for a user (with optional filters)
  app.get("/api/time-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, startDate, endDate } = req.query;
      
      const entries = await storage.getTimeEntries(userId, {
        jobId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      
      res.json(entries);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      res.status(500).json({ error: 'Failed to fetch time entries' });
    }
  });
  
  // Create a new time entry (start timer)
  app.post("/api/time-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const entryData = insertTimeEntrySchema.parse({ ...req.body, userId });
      
      const newEntry = await storage.createTimeEntry(entryData);
      res.json(newEntry);
    } catch (error) {
      console.error('Error creating time entry:', error);
      res.status(500).json({ error: 'Failed to create time entry' });
    }
  });
  
  // Update time entry (stop timer, edit)
  app.patch("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const entryId = req.params.id;
      
      const updated = await storage.updateTimeEntry(entryId, userId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating time entry:', error);
      res.status(500).json({ error: 'Failed to update time entry' });
    }
  });
  
  // Delete time entry
  app.delete("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const entryId = req.params.id;
      
      await storage.deleteTimeEntry(entryId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting time entry:', error);
      res.status(500).json({ error: 'Failed to delete time entry' });
    }
  });
  
  // Get active timer (running time entry without end time)
  app.get("/api/time-entries/active", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const activeEntry = await storage.getActiveTimeEntry(userId);
      res.json(activeEntry);
    } catch (error) {
      console.error('Error fetching active timer:', error);
      res.status(500).json({ error: 'Failed to fetch active timer' });
    }
  });
  
  // ===== STAFF SCHEDULING / CALENDAR ROUTES =====
  
  // Get schedules (calendar events)
  app.get("/api/schedules", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate, teamMemberId } = req.query;
      
      const schedules = await storage.getStaffSchedules(userId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        teamMemberId,
      });
      
      res.json(schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  
  // Create a schedule (assign job to team member with time)
  app.post("/api/schedules", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const scheduleData = insertStaffScheduleSchema.parse({ ...req.body, userId });
      
      const newSchedule = await storage.createStaffSchedule(scheduleData);
      res.json(newSchedule);
    } catch (error) {
      console.error('Error creating schedule:', error);
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  });
  
  // Update schedule (drag-drop reschedule)
  app.patch("/api/schedules/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const scheduleId = req.params.id;
      
      const updated = await storage.updateStaffSchedule(scheduleId, userId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating schedule:', error);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });
  
  // Delete schedule
  app.delete("/api/schedules/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const scheduleId = req.params.id;
      
      await storage.deleteStaffSchedule(scheduleId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });
  
  // ===== PHOTO ATTACHMENT ROUTES =====
  
  // Photo upload validation schema
  const photoUploadSchema = z.object({
    entityType: z.enum(['job', 'quote', 'invoice']),
    entityId: z.string().min(1),
    file: z.string().startsWith('data:image/'),
    description: z.string().optional(),
  });
  
  // Upload photo for job/quote/invoice
  app.post("/api/photos/upload", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const validatedData = photoUploadSchema.parse(req.body);
      const { entityType, entityId, file, description } = validatedData;
      
      // Extract base64 content
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to object storage
      const objectStorageService = new ObjectStorageService();
      const fileName = `${entityType}/${entityId}/${Date.now()}.jpg`;
      const photoUrl = await objectStorageService.uploadFile(fileName, buffer, 'image/jpeg');
      
      // Save photo reference to entity
      const photoData = {
        url: photoUrl,
        description,
        uploadedAt: new Date().toISOString(),
      };
      
      if (entityType === 'job') {
        const job = await storage.getJob(entityId, userId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        const photos = (job as any).photos || [];
        await storage.updateJob(entityId, userId, {
          photos: [...photos, photoData],
        } as any);
      } else if (entityType === 'quote') {
        const quote = await storage.getQuote(entityId, userId);
        if (!quote) return res.status(404).json({ error: 'Quote not found' });
        const photos = (quote as any).photos || [];
        await storage.updateQuote(entityId, userId, {
          photos: [...photos, photoData],
        } as any);
      } else if (entityType === 'invoice') {
        const invoice = await storage.getInvoice(entityId, userId);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        const photos = (invoice as any).photos || [];
        await storage.updateInvoice(entityId, userId, {
          photos: [...photos, photoData],
        } as any);
      }
      
      res.json({ url: photoUrl, success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  });
  
  // Delete photo from job/quote/invoice
  app.delete("/api/photos/:entityType/:entityId/:photoUrl", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { entityType, entityId, photoUrl } = req.params;
      
      if (entityType === 'job') {
        const job = await storage.getJob(entityId, userId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        const photos = (job as any).photos || [];
        const updatedPhotos = photos.filter((p: any) => p.url !== decodeURIComponent(photoUrl));
        await storage.updateJob(entityId, userId, { photos: updatedPhotos } as any);
      } else if (entityType === 'quote') {
        const quote = await storage.getQuote(entityId, userId);
        if (!quote) return res.status(404).json({ error: 'Quote not found' });
        const photos = (quote as any).photos || [];
        const updatedPhotos = photos.filter((p: any) => p.url !== decodeURIComponent(photoUrl));
        await storage.updateQuote(entityId, userId, { photos: updatedPhotos } as any);
      } else if (entityType === 'invoice') {
        const invoice = await storage.getInvoice(entityId, userId);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        const photos = (invoice as any).photos || [];
        const updatedPhotos = photos.filter((p: any) => p.url !== decodeURIComponent(photoUrl));
        await storage.updateInvoice(entityId, userId, { photos: updatedPhotos } as any);
      }
      
      // Try to delete from object storage
      try {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteFile(photoUrl);
      } catch (err) {
        console.warn('Failed to delete file from storage:', err);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  });
  
  // ===== STRIPE CONNECT ROUTES =====
  // Two-layer payment architecture:
  // Layer 1: Platform subscriptions (TradieTrack charges tradies $39/month)
  // Layer 2: Customer payments (clients pay tradies, with platform application_fee)
  
  // Create or get Stripe Connect Express account for tradie (owner only)
  app.post("/api/stripe-connect/create-account", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      const user = await storage.getUser(userId);
      
      if (!settings || !user) {
        return res.status(400).json({ error: 'Business settings required' });
      }
      
      // Check if already has Connect account
      if (settings.stripeConnectAccountId) {
        const account = await stripe.accounts.retrieve(settings.stripeConnectAccountId);
        return res.json({
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        });
      }
      
      // Create new Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: user.email || undefined,
        business_profile: {
          name: settings.businessName || undefined,
        },
        metadata: {
          tradietrackUserId: userId,
        },
      });
      
      // Save Connect account ID to business settings
      await storage.updateBusinessSettings(userId, {
        stripeConnectAccountId: account.id,
        connectChargesEnabled: account.charges_enabled,
        connectPayoutsEnabled: account.payouts_enabled,
      });
      
      res.json({
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      });
    } catch (error: any) {
      console.error('Error creating Connect account:', error);
      
      // Check for specific Stripe Connect not enabled error
      // Return 200 with connectNotEnabled flag to avoid triggering error overlay
      if (error.message?.includes("signed up for Connect") || error.code === 'account_invalid') {
        return res.json({ 
          success: false,
          error: 'Online payments coming soon! This feature is being set up and will be available shortly.',
          connectNotEnabled: true
        });
      }
      
      res.status(500).json({ error: error.message || 'Failed to create Connect account' });
    }
  });
  
  // Create account link for onboarding/dashboard (owner only)
  app.post("/api/stripe-connect/account-link", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { type = 'account_onboarding' } = req.body;
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Connect account not created yet' });
      }
      
      const baseUrl = getProductionBaseUrl(req);
      
      const accountLink = await stripe.accountLinks.create({
        account: settings.stripeConnectAccountId,
        refresh_url: `${baseUrl}/settings?tab=payments&refresh=true`,
        return_url: `${baseUrl}/settings?tab=payments&connect=success`,
        type: type as 'account_onboarding' | 'account_update',
      });
      
      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error('Error creating account link:', error);
      res.status(500).json({ error: error.message || 'Failed to create account link' });
    }
  });

  // Get Stripe publishable key (public endpoint for payment pages)
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      if (!publishableKey) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      res.json({ publishableKey });
    } catch (error) {
      console.error('Error getting Stripe publishable key:', error);
      res.status(500).json({ error: 'Failed to get payment configuration' });
    }
  });

  // ============ PayPal Integration Routes ============
  // PayPal SDK setup - returns client token for frontend
  app.get("/api/paypal/setup", async (req, res) => {
    try {
      const { loadPaypalDefault } = await import("./paypal");
      await loadPaypalDefault(req, res);
    } catch (error: any) {
      console.error('PayPal setup error:', error);
      res.status(500).json({ error: error.message || 'PayPal not configured' });
    }
  });

  // Create PayPal order
  app.post("/api/paypal/order", async (req, res) => {
    try {
      const { createPaypalOrder } = await import("./paypal");
      await createPaypalOrder(req, res);
    } catch (error: any) {
      console.error('PayPal order creation error:', error);
      res.status(500).json({ error: error.message || 'Failed to create PayPal order' });
    }
  });

  // Capture PayPal order after approval
  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    try {
      const { capturePaypalOrder } = await import("./paypal");
      await capturePaypalOrder(req, res);
    } catch (error: any) {
      console.error('PayPal capture error:', error);
      res.status(500).json({ error: error.message || 'Failed to capture PayPal order' });
    }
  });

  // PayPal webhook handler
  app.post("/api/paypal/webhook", async (req, res) => {
    try {
      const { handlePaypalWebhook } = await import("./paypal");
      await handlePaypalWebhook(req, res);
    } catch (error: any) {
      console.error('PayPal webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  // ============ End PayPal Routes ============
  
  // Get Connect account status
  app.get("/api/stripe-connect/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      
      if (!stripe) {
        return res.json({ 
          connected: false, 
          stripeAvailable: false,
          connectEnabled: false,
          message: 'Payment processing not configured' 
        });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        // Check if Connect is enabled on the platform account by checking capabilities
        // If we can't create accounts, Connect isn't enabled
        return res.json({ 
          connected: false, 
          stripeAvailable: true,
          connectEnabled: true, // We'll detect the real status when they try to connect
          message: 'Connect your bank account to receive online payments' 
        });
      }
      
      // Fetch latest status from Stripe
      const account = await stripe.accounts.retrieve(settings.stripeConnectAccountId);
      
      // Update local status if changed
      if (account.charges_enabled !== settings.connectChargesEnabled || 
          account.payouts_enabled !== settings.connectPayoutsEnabled) {
        await storage.updateBusinessSettings(userId, {
          connectChargesEnabled: account.charges_enabled,
          connectPayoutsEnabled: account.payouts_enabled,
        });
      }
      
      res.json({
        connected: true,
        stripeAvailable: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        message: account.charges_enabled 
          ? 'Ready to accept online payments' 
          : 'Complete your Stripe setup to receive payments',
      });
    } catch (error: any) {
      console.error('Error checking Connect status:', error);
      res.status(500).json({ error: error.message || 'Failed to check Connect status' });
    }
  });
  
  // Create dashboard link for tradie to view their Stripe dashboard
  app.get("/api/stripe-connect/dashboard-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Connect account not set up' });
      }
      
      const loginLink = await stripe.accounts.createLoginLink(settings.stripeConnectAccountId);
      res.json({ url: loginLink.url });
    } catch (error: any) {
      console.error('Error creating dashboard link:', error);
      res.status(500).json({ error: error.message || 'Failed to create dashboard link' });
    }
  });
  
  // Create payment intent for customer invoice payment (with platform fee)
  app.post("/api/stripe-connect/create-payment-intent", paymentRateLimiter, requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { invoiceId } = req.body;
      
      if (!invoiceId) {
        return res.status(400).json({ error: 'Invoice ID required' });
      }
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const invoice = await storage.getInvoiceWithLineItems(invoiceId, userId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Connect account not set up. Enable online payments in Settings.' });
      }
      
      if (!settings.connectChargesEnabled) {
        return res.status(400).json({ error: 'Complete Stripe onboarding to accept payments' });
      }
      
      const client = await storage.getClient(invoice.clientId, userId);
      const amountCents = Math.round(parseFloat(invoice.total) * 100);
      
      // Platform fee: 2.5% of invoice total (minimum $0.50)
      const platformFee = Math.max(Math.round(amountCents * 0.025), 50);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'aud',
        application_fee_amount: platformFee,
        transfer_data: {
          destination: settings.stripeConnectAccountId,
        },
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          tradieUserId: userId,
          clientId: client?.id || '',
          clientName: client?.name || '',
        },
        description: `Invoice ${invoice.number} - ${settings.businessName || 'TradieTrack'}`,
      });
      
      // Update invoice with payment intent ID
      await storage.updateInvoice(invoiceId, userId, {
        stripePaymentIntentId: paymentIntent.id,
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountCents,
        platformFee,
      });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment intent' });
    }
  });
  
  // Public endpoint: Get invoice details for payment page (no auth required)
  app.get("/api/public/invoice/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find invoice by acceptance token (used for quotes) or generate a payment token
      const invoice = await storage.getInvoiceByPaymentToken(token);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      if (invoice.status === 'paid') {
        return res.json({ 
          paid: true, 
          message: 'This invoice has already been paid',
          invoiceNumber: invoice.number,
        });
      }
      
      const client = await storage.getClientById(invoice.clientId);
      const settings = await storage.getBusinessSettingsByUserId(invoice.userId);
      
      // Don't expose sensitive data - but include bank details for payment
      res.json({
        id: invoice.id,
        number: invoice.number,
        title: invoice.title,
        total: invoice.total,
        subtotal: invoice.subtotal,
        gstAmount: invoice.gstAmount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        allowOnlinePayment: invoice.allowOnlinePayment,
        business: {
          name: settings?.businessName,
          logo: settings?.logoUrl,
          abn: settings?.abn,
          // Bank details for bank transfer payments
          bankBsb: settings?.bankBsb,
          bankAccountNumber: settings?.bankAccountNumber,
          bankAccountName: settings?.bankAccountName,
          paymentInstructions: settings?.paymentInstructions,
        },
        client: {
          name: client?.name,
        },
        lineItems: invoice.lineItems,
      });
    } catch (error: any) {
      console.error('Error fetching public invoice:', error);
      res.status(500).json({ error: 'Failed to load invoice' });
    }
  });
  
  // Public endpoint: Download invoice/receipt PDF (no auth required)
  app.get("/api/public/invoice/:token/pdf", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invoice = await storage.getInvoiceByPaymentToken(token);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      const client = await storage.getClientById(invoice.clientId);
      const settings = await storage.getBusinessSettingsByUserId(invoice.userId);
      
      // Fetch business templates for terms and warranty
      const termsTemplateResult = await db.select().from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, invoice.userId),
          eq(businessTemplates.family, 'terms_conditions'),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      const warrantyTemplateResult = await db.select().from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, invoice.userId),
          eq(businessTemplates.family, 'warranty'),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      
      const termsTemplate = termsTemplateResult[0]?.content;
      const warrantyTemplate = warrantyTemplateResult[0]?.content;
      
      // Generate PDF
      const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const businessForPdf = await resolveBusinessLogoForPdf(settings || { businessName: 'TradieTrack' });
      const pdfHtml = generateInvoicePDF({
        invoice: {
          id: invoice.id,
          number: invoice.number,
          title: invoice.title,
          status: invoice.status,
          subtotal: invoice.subtotal || '0',
          gstAmount: invoice.gstAmount || '0',
          total: invoice.total,
          dueDate: invoice.dueDate,
          createdAt: invoice.createdAt,
          notes: invoice.notes,
        },
        lineItems: invoice.lineItems || [],
        client: client || { name: 'Customer' },
        business: businessForPdf,
        termsTemplate,
        warrantyTemplate,
      } as any);
      
      const pdfBuffer = await generatePDFBuffer(pdfHtml);
      
      // Determine filename based on status (invoice vs receipt)
      const documentType = invoice.status === 'paid' ? 'Receipt' : 'Invoice';
      const filename = `${documentType}_${invoice.number || invoice.id.slice(0, 8)}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating public invoice PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Public endpoint: Get receipt PDF by view token (for SMS links)
  app.get("/api/public/receipt/:token/pdf", async (req, res) => {
    try {
      const { token } = req.params;
      
      const receipt = await storage.getReceiptByViewToken(token);
      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }
      
      const client = receipt.clientId ? await storage.getClientById(receipt.clientId) : null;
      const settings = await storage.getBusinessSettingsByUserId(receipt.userId);
      
      // Get job and invoice details if linked
      let job = null;
      let invoice = null;
      if (receipt.jobId) {
        job = await storage.getJob(receipt.jobId, receipt.userId);
      }
      if (receipt.invoiceId) {
        invoice = await storage.getInvoice(receipt.invoiceId, receipt.userId);
      }
      
      // Generate PDF
      const { generatePaymentReceiptPDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
      
      const businessForPdf = await resolveBusinessLogoForPdf(settings || { businessName: 'TradieTrack' });
      
      const pdfHtml = generatePaymentReceiptPDF({
        payment: {
          id: receipt.id,
          amount: parseFloat(receipt.amount),
          paymentMethod: receipt.paymentMethod || 'card',
          paidAt: receipt.paidAt,
          receiptNumber: receipt.receiptNumber,
          description: receipt.description,
        },
        client: client || undefined,
        business: businessForPdf,
        invoice: invoice ? {
          number: invoice.number,
          title: invoice.title,
        } : undefined,
        job: job ? {
          title: job.title,
          address: job.address,
        } : undefined,
      });
      
      const pdfBuffer = await generatePDFBuffer(pdfHtml);
      
      const filename = `Receipt_${receipt.receiptNumber || receipt.id.slice(0, 8)}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating public receipt PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });
  
  // Public endpoint: Create payment intent for client (no auth required)
  app.post("/api/public/invoice/:token/pay", async (req, res) => {
    try {
      const { token } = req.params;
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const invoice = await storage.getInvoiceByPaymentToken(token);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      if (invoice.status === 'paid') {
        return res.status(400).json({ error: 'Invoice already paid' });
      }
      
      if (!invoice.allowOnlinePayment) {
        return res.status(400).json({ error: 'Online payment not enabled for this invoice' });
      }
      
      const settings = await storage.getBusinessSettingsByUserId(invoice.userId);
      if (!settings?.stripeConnectAccountId || !settings.connectChargesEnabled) {
        return res.status(400).json({ error: 'Business not set up for online payments' });
      }
      
      const client = await storage.getClientById(invoice.clientId);
      const amountCents = Math.round(parseFloat(invoice.total) * 100);
      
      // Platform fee: 2.5% of invoice total (minimum $0.50)
      const platformFee = Math.max(Math.round(amountCents * 0.025), 50);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'aud',
        application_fee_amount: platformFee,
        transfer_data: {
          destination: settings.stripeConnectAccountId,
        },
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          tradieUserId: invoice.userId,
          clientId: client?.id || '',
          clientName: client?.name || '',
          source: 'public_payment_page',
        },
        description: `Invoice ${invoice.number} - ${settings.businessName || 'TradieTrack'}`,
      });
      
      // Update invoice with payment intent
      await storage.updateInvoiceByToken(token, {
        stripePaymentIntentId: paymentIntent.id,
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: await getStripePublishableKey(),
      });
    } catch (error: any) {
      console.error('Error creating public payment intent:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment' });
    }
  });
  
  // ===== STRIPE PAYMENT LINK ROUTES =====
  
  // Create payment link for invoice (uses internal payment page with Connect support)
  app.post("/api/invoices/:id/payment-link", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const invoiceId = req.params.id;
      
      const invoice = await storage.getInvoice(invoiceId, userId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      
      // Generate or use existing payment token (12-char alphanumeric for shorter URLs)
      let paymentToken = invoice.paymentToken;
      if (!paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = randomBytes(12);
        paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[bytes[i] % chars.length];
        }
        await storage.updateInvoice(invoiceId, userId, { 
          paymentToken,
          allowOnlinePayment: true 
        });
      }
      
      // Generate payment URL using internal payment page (supports Stripe Connect)
      const paymentUrl = `${getProductionBaseUrl(req)}/pay/${paymentToken}`;
      
      // Check if Connect is properly configured
      const connectEnabled = !!(settings?.stripeConnectAccountId && settings?.connectChargesEnabled);
      
      res.json({ 
        url: paymentUrl, 
        success: true,
        connectEnabled,
        message: connectEnabled 
          ? 'Payment link created - funds will go to your connected bank account'
          : 'Payment link created - please set up Stripe Connect to receive payments directly'
      });
    } catch (error) {
      console.error('Error creating payment link:', error);
      res.status(500).json({ error: 'Failed to create payment link' });
    }
  });

  // ===== STRIPE CONNECT EXPRESS ROUTES =====
  
  // Get Connect account status
  app.get("/api/stripe-connect/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.json({ 
          connected: false,
          onboardingStatus: 'not_started',
        });
      }
      
      const { getConnectAccountStatus } = await import('./stripeConnect');
      const status = await getConnectAccountStatus(settings.stripeConnectAccountId);
      
      res.json({
        connected: status.chargesEnabled && status.payoutsEnabled,
        onboardingStatus: status.detailsSubmitted ? 'complete' : 'pending',
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        requirementsCurrentlyDue: status.requirementsCurrentlyDue,
      });
    } catch (error: any) {
      console.error('Error getting Connect status:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create Connect account and start onboarding
  app.post("/api/stripe-connect/onboard", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      const user = await storage.getUser(userId);
      
      if (!settings || !user?.email) {
        return res.status(400).json({ error: 'Business settings or email required' });
      }
      
      const baseUrl = getProductionBaseUrl(req);
      const returnUrl = `${baseUrl}/settings?connect=success`;
      const refreshUrl = `${baseUrl}/settings?connect=refresh`;
      
      const { createConnectAccount, createConnectOnboardingLink } = await import('./stripeConnect');
      
      // If already has account, create new onboarding link
      if (settings.stripeConnectAccountId) {
        const { url, error } = await createConnectOnboardingLink(
          settings.stripeConnectAccountId,
          returnUrl,
          refreshUrl
        );
        
        if (error) {
          return res.status(500).json({ error });
        }
        
        return res.json({ onboardingUrl: url });
      }
      
      // Create new account
      const result = await createConnectAccount(
        userId,
        user.email,
        settings.businessName || 'My Business',
        returnUrl,
        refreshUrl
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      // Save account ID
      await storage.updateBusinessSettings(userId, {
        stripeConnectAccountId: result.accountId,
      });
      
      res.json({ onboardingUrl: result.onboardingUrl });
    } catch (error: any) {
      console.error('Error starting Connect onboarding:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get Connect dashboard login link (or onboarding link if not complete)
  app.get("/api/stripe-connect/dashboard", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Connect account not set up' });
      }
      
      const { getConnectAccountStatus, createConnectOnboardingLink, createLoginLink } = await import('./stripeConnect');
      
      // First check if onboarding is complete
      const status = await getConnectAccountStatus(settings.stripeConnectAccountId);
      
      if (!status.detailsSubmitted) {
        // Onboarding not complete - return onboarding link instead
        const baseUrl = getProductionBaseUrl(req);
        const returnUrl = `${baseUrl}/settings/integrations?stripe=success`;
        const refreshUrl = `${baseUrl}/settings/integrations?stripe=refresh`;
        
        const result = await createConnectOnboardingLink(
          settings.stripeConnectAccountId,
          returnUrl,
          refreshUrl
        );
        
        if (result.error) {
          return res.status(500).json({ error: result.error });
        }
        
        return res.json({ url: result.url, isOnboarding: true });
      }
      
      // Onboarding complete - return dashboard login link
      const { url, error } = await createLoginLink(settings.stripeConnectAccountId);
      
      if (error) {
        return res.status(500).json({ error });
      }
      
      res.json({ url });
    } catch (error: any) {
      console.error('Error getting dashboard link:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get Connect account balance
  app.get("/api/stripe-connect/balance", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Connect account not set up' });
      }
      
      const { getAccountBalance } = await import('./stripeConnect');
      const balance = await getAccountBalance(settings.stripeConnectAccountId);
      
      res.json(balance);
    } catch (error: any) {
      console.error('Error getting balance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Connect account payouts
  app.get("/api/stripe-connect/payouts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ 
          payouts: [],
          error: 'Connect account not set up'
        });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(400).json({ 
          payouts: [],
          error: 'Stripe not configured'
        });
      }

      const stripePayouts = await stripe.payouts.list(
        { limit: 50 },
        { stripeAccount: settings.stripeConnectAccountId }
      );
      
      const payouts = stripePayouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount / 100,
        status: payout.status,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
        created: new Date(payout.created * 1000).toISOString(),
        method: payout.method,
        destination: payout.destination ? `****${String(payout.destination).slice(-4)}` : null,
      }));
      
      res.json({ payouts });
    } catch (error: any) {
      console.error('Error getting payouts:', error);
      res.status(500).json({ payouts: [], error: error.message });
    }
  });

  // ===== STRIPE TERMINAL (TAP TO PAY) ROUTES =====

  // Create Terminal connection token for mobile Tap to Pay
  app.post("/api/stripe/terminal-connection-token", paymentRateLimiter, requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Stripe Connect account not set up' });
      }

      // Create connection token using the connected account
      const connectionToken = await stripe.terminal.connectionTokens.create(
        {},
        { stripeAccount: settings.stripeConnectAccountId }
      );
      
      res.json({ secret: connectionToken.secret });
    } catch (error: any) {
      console.error('Error creating Terminal connection token:', error);
      res.status(500).json({ error: 'Failed to create connection token' });
    }
  });

  // Get or create Terminal location for Tap to Pay
  app.get("/api/stripe/terminal-location", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Stripe Connect account not set up' });
      }

      // Try to get existing locations first
      const locations = await stripe.terminal.locations.list(
        { limit: 1 },
        { stripeAccount: settings.stripeConnectAccountId }
      );

      if (locations.data.length > 0) {
        return res.json({ locationId: locations.data[0].id });
      }

      // Create a new location if none exists
      const location = await stripe.terminal.locations.create(
        {
          display_name: settings.businessName || 'TradieTrack Business',
          address: {
            line1: settings.businessAddress || '123 Main Street',
            city: 'Sydney',
            state: 'NSW',
            postal_code: '2000',
            country: 'AU',
          },
        },
        { stripeAccount: settings.stripeConnectAccountId }
      );
      
      res.json({ locationId: location.id });
    } catch (error: any) {
      console.error('Error getting/creating Terminal location:', error);
      res.status(500).json({ error: 'Failed to get Terminal location' });
    }
  });

  // ===== TAP TO PAY TERMS & CONDITIONS (Apple Requirement 3.5, 3.8, 3.8.1) =====

  // Get T&C acceptance status
  app.get("/api/tap-to-pay/terms-status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const acceptance = await storage.getTapToPayTermsAcceptance(userId);
      
      if (!acceptance) {
        return res.json({ 
          accepted: false,
          tutorialCompleted: false,
          splashShown: false 
        });
      }
      
      res.json({
        accepted: true,
        acceptedAt: acceptance.acceptedAt,
        acceptedByName: acceptance.acceptedByName,
        tutorialCompleted: acceptance.tutorialCompleted || false,
        tutorialCompletedAt: acceptance.tutorialCompletedAt,
        splashShown: acceptance.splashShown || false,
        splashShownAt: acceptance.splashShownAt,
        termsVersion: acceptance.termsVersion,
      });
    } catch (error) {
      console.error('Error getting T&C status:', error);
      res.status(500).json({ error: 'Failed to get terms status' });
    }
  });

  // Accept Terms & Conditions (admin only)
  app.post("/api/tap-to-pay/accept-terms", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Check if user is admin/owner - only admins can accept T&C per Apple requirement
      // Check team membership to see if user is owner or has admin role
      const teamMember = await storage.getTeamMemberByUserId(userId);
      const isOwner = !teamMember; // If no team member record, user is the owner
      const isAdmin = teamMember?.role === 'admin' || teamMember?.role === 'owner';
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ 
          error: 'Only administrators can accept Tap to Pay terms',
          message: 'Contact your admin to enable Tap to Pay on iPhone'
        });
      }
      
      const ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Upsert the acceptance record
      const acceptance = await storage.createOrUpdateTapToPayTermsAcceptance({
        userId,
        acceptedByUserId: userId,
        acceptedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown',
        acceptedByEmail: user.email || undefined,
        acceptedAt: new Date(),
        termsVersion: '1.0',
        ipAddress,
        userAgent,
      });
      
      res.json({ 
        success: true, 
        acceptance: {
          accepted: true,
          acceptedAt: acceptance.acceptedAt,
          acceptedByName: acceptance.acceptedByName,
        }
      });
    } catch (error) {
      console.error('Error accepting T&C:', error);
      res.status(500).json({ error: 'Failed to accept terms' });
    }
  });

  // Mark tutorial as completed
  app.post("/api/tap-to-pay/complete-tutorial", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const acceptance = await storage.getTapToPayTermsAcceptance(userId);
      if (!acceptance) {
        return res.status(400).json({ error: 'Terms must be accepted first' });
      }
      
      const updated = await storage.updateTapToPayTermsAcceptance(userId, {
        tutorialCompleted: true,
        tutorialCompletedAt: new Date(),
      });
      
      res.json({ success: true, tutorialCompleted: true });
    } catch (error) {
      console.error('Error completing tutorial:', error);
      res.status(500).json({ error: 'Failed to complete tutorial' });
    }
  });

  // Mark splash screen as shown
  app.post("/api/tap-to-pay/mark-splash-shown", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Create record if it doesn't exist (just tracking splash shown)
      let acceptance = await storage.getTapToPayTermsAcceptance(userId);
      if (!acceptance) {
        // Just mark splash as shown without accepting terms
        await storage.markTapToPaySplashShown(userId);
      } else {
        await storage.updateTapToPayTermsAcceptance(userId, {
          splashShown: true,
          splashShownAt: new Date(),
        });
      }
      
      res.json({ success: true, splashShown: true });
    } catch (error) {
      console.error('Error marking splash shown:', error);
      res.status(500).json({ error: 'Failed to mark splash as shown' });
    }
  });

  // Create payment intent for Terminal (Tap to Pay)
  app.post("/api/stripe/create-terminal-payment-intent", paymentRateLimiter, requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: 'Payment processing not available' });
      }
      
      const { amount, description, currency = 'aud', invoiceId, jobId } = req.body;
      
      if (!amount || amount < 500) {
        return res.status(400).json({ error: 'Minimum amount is $5.00 (500 cents)' });
      }

      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Stripe Connect account not set up' });
      }

      // Calculate platform fee (2.5%)
      const platformFee = Math.round(amount * 0.025);

      // Create payment intent for Terminal with connected account
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        description: description || 'TradieTrack Tap to Pay',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          userId,
          invoiceId: invoiceId || '',
          jobId: jobId || '',
          source: 'tap_to_pay',
        },
        application_fee_amount: platformFee,
        transfer_data: {
          destination: settings.stripeConnectAccountId,
        },
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error('Error creating Terminal payment intent:', error);
      
      // Provide more helpful error messages based on Stripe error codes
      let errorMessage = 'Failed to create payment intent';
      
      if (error.type === 'StripeInvalidRequestError') {
        if (error.code === 'account_invalid') {
          errorMessage = 'Your Stripe account needs to complete onboarding. Go to Integrations to finish setup.';
        } else if (error.message?.includes('transfers')) {
          errorMessage = 'Your Stripe account needs the "transfers" capability enabled. Please complete Stripe onboarding.';
        } else if (error.message?.includes('card_present')) {
          errorMessage = 'Tap to Pay is not available for your Stripe account. Please contact Stripe support.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      } else if (error.type === 'StripePermissionError') {
        errorMessage = 'Your Stripe account is not authorized for Tap to Pay. Complete Stripe Connect onboarding first.';
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  // Send payment receipt via email or SMS (with PDF attachment)
  const sendReceiptSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    amount: z.number().min(100, 'Minimum amount is $1.00'),
    description: z.string().optional(),
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    clientName: z.string().optional(),
    clientEmail: z.string().optional(),
    clientPhone: z.string().optional(),
    jobTitle: z.string().optional(),
    paymentMethod: z.string().optional(),
    reference: z.string().optional(),
    method: z.enum(['email', 'sms']),
  });

  app.post("/api/payments/send-receipt", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Validate request body
      const parseResult = sendReceiptSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid request' });
      }
      
      const { email, phone, amount, description, invoiceId, invoiceNumber, clientName, clientEmail, clientPhone, jobTitle, paymentMethod, reference, method } = parseResult.data;
      
      const settings = await storage.getBusinessSettings(userId);
      if (!settings) {
        return res.status(400).json({ error: 'Business settings not found' });
      }
      
      const businessName = settings.businessName || 'TradieTrack Business';
      const businessEmail = settings.businessEmail || settings.email;
      const formattedAmount = `$${(amount / 100).toFixed(2)}`;
      const receiptDate = new Date().toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Generate PDF receipt
      const { generatePaymentReceiptPDF, generatePDFBuffer, PaymentReceiptData } = await import('./pdfService');
      
      const receiptData: any = {
        payment: {
          id: `RCP-${Date.now().toString(36).toUpperCase()}`,
          amount,
          paymentMethod: paymentMethod || 'card',
          reference: reference || description || 'Payment',
          paidAt: new Date(),
        },
        client: clientName ? {
          name: clientName,
          email: clientEmail || email,
          phone: clientPhone || phone,
        } : undefined,
        business: settings,
        invoice: invoiceNumber ? { number: invoiceNumber } : undefined,
        job: jobTitle ? { title: jobTitle } : undefined,
      };
      
      let pdfBuffer: Buffer | null = null;
      try {
        const receiptHtml = generatePaymentReceiptPDF(receiptData);
        pdfBuffer = await generatePDFBuffer(receiptHtml);
      } catch (pdfError) {
        console.error('PDF generation failed, sending without attachment:', pdfError);
      }

      if (method === 'email' && email) {
        // Send email receipt with PDF attachment
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 32px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; }
              .header p { margin: 8px 0 0; opacity: 0.9; }
              .content { padding: 32px; }
              .amount { font-size: 42px; font-weight: bold; color: #1f2937; text-align: center; margin: 24px 0 8px; }
              .status { text-align: center; color: #16a34a; font-weight: 600; margin-bottom: 24px; }
              .details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .detail-row:last-child { border-bottom: none; }
              .detail-label { color: #6b7280; }
              .detail-value { color: #1f2937; font-weight: 500; }
              .pdf-note { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center; }
              .pdf-note p { margin: 0; color: #166534; }
              .footer { background: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Payment Receipt</h1>
                <p>from ${businessName}</p>
              </div>
              <div class="content">
                <div class="amount">${formattedAmount}</div>
                <p class="status">Payment Received - Thank You!</p>
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${receiptDate}</span>
                  </div>
                  ${invoiceNumber ? `
                  <div class="detail-row">
                    <span class="detail-label">Invoice</span>
                    <span class="detail-value">${invoiceNumber}</span>
                  </div>
                  ` : ''}
                  ${jobTitle ? `
                  <div class="detail-row">
                    <span class="detail-label">Job</span>
                    <span class="detail-value">${jobTitle}</span>
                  </div>
                  ` : ''}
                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">${description || 'Payment'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Payment Method</span>
                    <span class="detail-value">${paymentMethod === 'card' ? 'Contactless Card (Tap to Pay)' : paymentMethod || 'Card'}</span>
                  </div>
                  ${settings.abn ? `
                  <div class="detail-row">
                    <span class="detail-label">ABN</span>
                    <span class="detail-value">${settings.abn}</span>
                  </div>
                  ` : ''}
                </div>
                ${pdfBuffer ? `
                <div class="pdf-note">
                  <p><strong>Your tax receipt is attached</strong> as a PDF for your records.</p>
                </div>
                ` : ''}
              </div>
              <div class="footer">
                <p>Thank you for your payment!</p>
                <p>${businessName}${businessEmail ? ` • ${businessEmail}` : ''}</p>
                ${settings.phone ? `<p>Phone: ${settings.phone}</p>` : ''}
              </div>
            </div>
          </body>
          </html>
        `;

        // Try SendGrid with PDF attachment
        const sgMail = require('@sendgrid/mail');
        if (process.env.SENDGRID_API_KEY) {
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          
          const emailPayload: any = {
            to: email,
            from: businessEmail || 'noreply@tradietrack.com.au',
            subject: `Payment Receipt - ${formattedAmount} from ${businessName}`,
            html: emailHtml,
          };
          
          // Attach PDF if generated successfully
          if (pdfBuffer) {
            emailPayload.attachments = [{
              content: pdfBuffer.toString('base64'),
              filename: `Receipt-${receiptData.payment.id}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment',
            }];
          }
          
          await sgMail.send(emailPayload);
        } else {
          return res.status(400).json({ error: 'Email service not configured' });
        }

        return res.json({ success: true, method: 'email', recipient: email, hasPdf: !!pdfBuffer });
      }

      if (method === 'sms' && phone) {
        // Format SMS message with receipt details
        const smsMessage = `Payment Receipt from ${businessName}: ${formattedAmount} received. ${invoiceNumber ? `Invoice: ${invoiceNumber}. ` : ''}Thank you for your payment!`;
        
        // Send via shared Twilio client (supports connector and env vars)
        const smsResult = await sendSMS({
          to: phone,
          message: smsMessage
        });
        
        if (smsResult.success) {
          return res.json({ 
            success: true, 
            method: 'sms', 
            recipient: phone,
            simulated: smsResult.simulated || false
          });
        } else if (smsResult.simulated) {
          return res.json({ 
            success: true, 
            method: 'sms', 
            recipient: phone,
            simulated: true,
            message: 'SMS simulated (Twilio not configured)'
          });
        } else {
          return res.status(400).json({ 
            error: smsResult.error || 'SMS service not configured. Please use email instead.',
            disabled: true
          });
        }
      }

      return res.status(400).json({ error: 'Invalid method or missing recipient' });
    } catch (error: any) {
      console.error('Error sending receipt:', error);
      res.status(500).json({ error: 'Failed to send receipt' });
    }
  });

  // Register push notification token
  app.post("/api/push-tokens", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { token, platform, deviceName } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({ error: 'Token and platform required' });
      }

      // Store push token (would need to add to schema in production)
      console.log(`[Push] Registered token for user ${userId}: ${token.substring(0, 20)}... (${platform})`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error registering push token:', error);
      res.status(500).json({ error: 'Failed to register push token' });
    }
  });

  // Store team member location update
  app.post("/api/team-locations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { latitude, longitude, accuracy, heading, speed, timestamp, batteryLevel, isCharging, activityType } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
      }

      const locationTime = new Date(timestamp || Date.now());

      // Insert location history record
      await storage.db.insert(locationTracking).values({
        userId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
        heading: heading?.toString(),
        speed: speed?.toString(),
        batteryLevel,
        isCharging,
        activityType: activityType || 'stationary',
        timestamp: locationTime,
        trackingType: 'automatic',
      });

      // Update or insert current status in tradieStatus
      const existingStatus = await storage.db.query.tradieStatus.findFirst({
        where: eq(tradieStatus.userId, userId),
      });

      if (existingStatus) {
        await storage.db.update(tradieStatus)
          .set({
            currentLatitude: latitude.toString(),
            currentLongitude: longitude.toString(),
            speed: speed?.toString(),
            heading: heading?.toString(),
            batteryLevel,
            isCharging,
            activityStatus: activityType === 'driving' ? 'driving' : activityType === 'working' ? 'working' : 'online',
            lastSeenAt: locationTime,
            lastLocationUpdate: locationTime,
            updatedAt: new Date(),
          })
          .where(eq(tradieStatus.userId, userId));
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  });

  // Store geofence event (job site arrival/departure) with auto clock-in/out
  app.post("/api/geofence-events", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { identifier, action, timestamp, latitude, longitude, accuracy, address } = req.body;
      
      // Parse job ID from identifier (format: job_<jobId>)
      const jobId = identifier?.startsWith('job_') ? identifier.substring(4) : null;
      
      if (!jobId) {
        return res.json({ success: true, message: 'No job ID in identifier' });
      }
      
      console.log(`[Geofence] User ${userId} ${action}ed job site ${jobId}`);
      
      // Get job details to check geofence settings
      const userContext = await getUserContext(userId);
      const effectiveUserId = userContext.effectiveUserId;
      const job = await storage.getJob(jobId, effectiveUserId);
      
      if (!job) {
        console.log(`[Geofence] Job ${jobId} not found`);
        return res.json({ success: true, message: 'Job not found' });
      }
      
      // Create geofence alert for owner/manager visibility
      const alertData = {
        userId,
        jobId,
        businessOwnerId: effectiveUserId,
        alertType: action === 'enter' ? 'arrival' : 'departure',
        latitude: latitude?.toString() || job.latitude || '0',
        longitude: longitude?.toString() || job.longitude || '0',
        address: address || job.address || '',
        distanceFromSite: accuracy?.toString() || null,
        isRead: false,
      };
      
      const alert = await storage.createGeofenceAlert(alertData);
      console.log(`[Geofence] Created alert ${alert.id} for ${action}`);
      
      let timeEntryAction = null;
      
      // Handle auto clock-in on arrival
      if (action === 'enter' && job.geofenceEnabled && job.geofenceAutoClockIn) {
        // Check if user already has an active time entry for this job
        const activeEntry = await storage.getActiveTimeEntry(userId);
        
        if (!activeEntry || activeEntry.jobId !== jobId) {
          // Stop any existing active timer first
          if (activeEntry) {
            await storage.stopTimeEntry(activeEntry.id, userId);
            console.log(`[Geofence] Stopped existing timer ${activeEntry.id}`);
          }
          
          // Start new time entry for this job
          const newEntry = await storage.createTimeEntry({
            userId,
            jobId,
            startTime: new Date(timestamp || Date.now()),
            description: 'Auto-started by geofence arrival',
            origin: 'geofence',
            geofenceEventId: alert.id,
          });
          console.log(`[Geofence] Auto clock-in: Created time entry ${newEntry.id}`);
          timeEntryAction = { type: 'clock_in', entryId: newEntry.id };
        }
      }
      
      // Handle auto clock-out on departure
      if (action === 'exit' && job.geofenceEnabled && job.geofenceAutoClockOut) {
        // Find active time entry for this job
        const activeEntry = await storage.getActiveTimeEntry(userId);
        
        if (activeEntry && activeEntry.jobId === jobId) {
          // Stop the timer
          const stoppedEntry = await storage.stopTimeEntry(activeEntry.id, userId);
          console.log(`[Geofence] Auto clock-out: Stopped time entry ${activeEntry.id}`);
          timeEntryAction = { type: 'clock_out', entryId: activeEntry.id, duration: stoppedEntry?.duration };
        }
      }
      
      res.json({ 
        success: true, 
        alertId: alert.id,
        timeEntryAction,
        geofenceSettings: {
          enabled: job.geofenceEnabled,
          autoClockIn: job.geofenceAutoClockIn,
          autoClockOut: job.geofenceAutoClockOut,
          radius: job.geofenceRadius,
        }
      });
    } catch (error: any) {
      console.error('Error handling geofence event:', error);
      res.status(500).json({ error: 'Failed to process geofence event' });
    }
  });
  
  // Get jobs with geofence settings for registering geofences on mobile
  app.get("/api/jobs/geofence-enabled", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      const allJobs = await storage.getJobs(effectiveUserId);
      
      // Filter jobs with geofence enabled and valid coordinates
      const geofenceJobs = allJobs
        .filter(job => job.geofenceEnabled && job.latitude && job.longitude)
        .map(job => ({
          id: job.id,
          title: job.title,
          address: job.address,
          latitude: parseFloat(job.latitude as string),
          longitude: parseFloat(job.longitude as string),
          radius: job.geofenceRadius || 100,
          autoClockIn: job.geofenceAutoClockIn,
          autoClockOut: job.geofenceAutoClockOut,
          identifier: `job_${job.id}`,
        }));
      
      res.json(geofenceJobs);
    } catch (error: any) {
      console.error('Error fetching geofence-enabled jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update job geofence settings
  app.patch("/api/jobs/:id/geofence", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_JOBS), async (req: any, res) => {
    try {
      const effectiveUserId = req.effectiveUserId || req.userId;
      const { id } = req.params;
      const { geofenceEnabled, geofenceRadius, geofenceAutoClockIn, geofenceAutoClockOut } = req.body;
      
      const updateData: any = {};
      if (geofenceEnabled !== undefined) updateData.geofenceEnabled = geofenceEnabled;
      if (geofenceRadius !== undefined) updateData.geofenceRadius = geofenceRadius;
      if (geofenceAutoClockIn !== undefined) updateData.geofenceAutoClockIn = geofenceAutoClockIn;
      if (geofenceAutoClockOut !== undefined) updateData.geofenceAutoClockOut = geofenceAutoClockOut;
      
      const updatedJob = await storage.updateJob(id, effectiveUserId, updateData);
      
      if (!updatedJob) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      console.log(`[Geofence] Updated settings for job ${id}:`, updateData);
      
      res.json({
        id: updatedJob.id,
        geofenceEnabled: updatedJob.geofenceEnabled,
        geofenceRadius: updatedJob.geofenceRadius,
        geofenceAutoClockIn: updatedJob.geofenceAutoClockIn,
        geofenceAutoClockOut: updatedJob.geofenceAutoClockOut,
      });
    } catch (error: any) {
      console.error('Error updating geofence settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB PHOTOS ROUTES =====
  
  // Get photos for a job (team-aware: shows all photos for the job)
  app.get("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { getJobPhotos } = await import('./photoService');
      // Use effectiveUserId to see all photos uploaded by any team member for this job
      const photos = await getJobPhotos(jobId, userContext.effectiveUserId);
      
      res.json(photos);
    } catch (error: any) {
      console.error('Error getting job photos:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload photo to a job (base64 - for small images and backwards compatibility)
  // Team-aware: photos stored under effectiveUserId so all team members can see them
  app.post("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const { fileName, fileBase64, mimeType, category, caption, takenAt } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job exists and belongs to this user/team (security check)
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!fileName || !fileBase64 || !mimeType) {
        return res.status(400).json({ error: 'fileName, fileBase64, and mimeType required' });
      }
      
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      
      const { uploadJobPhoto } = await import('./photoService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadJobPhoto(userContext.effectiveUserId, jobId, fileBuffer, {
        fileName,
        fileSize: fileBuffer.length,
        mimeType,
        category: category || 'general',
        caption,
        takenAt: takenAt ? new Date(takenAt) : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ photoId: result.photoId, success: true });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload media to a job via multipart form (for large files like videos)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for videos
  });
  
  // Team-aware: multipart uploads stored under effectiveUserId so all team members can see them
  app.post("/api/jobs/:jobId/photos/upload", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const file = req.file;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job exists and belongs to this user/team (security check)
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { category, caption, takenAt } = req.body;
      
      const { uploadJobPhoto } = await import('./photoService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadJobPhoto(userContext.effectiveUserId, jobId, file.buffer, {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        category: category || 'general',
        caption,
        takenAt: takenAt ? new Date(takenAt) : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ photoId: result.photoId, success: true });
    } catch (error: any) {
      console.error('Error uploading media via multipart:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update photo metadata (team-aware)
  app.patch("/api/jobs/:jobId/photos/:photoId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;
      const { category, caption, sortOrder } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { updatePhotoMetadata } = await import('./photoService');
      const result = await updatePhotoMetadata(photoId, userContext.effectiveUserId, { category, caption, sortOrder });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating photo:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete photo (team-aware)
  app.delete("/api/jobs/:jobId/photos/:photoId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { deleteJobPhoto } = await import('./photoService');
      const result = await deleteJobPhoto(photoId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // View/stream a photo (for when signedUrl is not available)
  app.get("/api/jobs/:jobId/photos/:photoId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get photo from database
      const photo = await storage.getJobPhoto(photoId, userContext.effectiveUserId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Get signed URL and redirect to it
      const { getSignedPhotoUrl } = await import('./photoService');
      const { url, error } = await getSignedPhotoUrl(photo.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for photo view:', error);
        return res.status(500).json({ error: 'Failed to access photo' });
      }
      
      res.redirect(url);
    } catch (error: any) {
      console.error('Error viewing photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download a photo with Content-Disposition header to force download
  app.get("/api/jobs/:jobId/photos/:photoId/download", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, photoId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get photo from database
      const photo = await storage.getJobPhoto(photoId, userContext.effectiveUserId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      // Get signed URL
      const { getSignedPhotoUrl } = await import('./photoService');
      const { url, error } = await getSignedPhotoUrl(photo.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for photo download:', error);
        return res.status(500).json({ error: 'Failed to access photo' });
      }
      
      // Fetch the media and stream it with proper headers
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch media' });
      }
      
      // Set headers for download
      const fileName = photo.fileName || `media_${photoId}.${photo.mimeType?.split('/')[1] || 'jpg'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
      
      // Stream the response
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error downloading photo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== VOICE NOTES ROUTES =====
  
  // Get voice notes for a job (team-aware: shows all voice notes for the job)
  app.get("/api/jobs/:jobId/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { getJobVoiceNotes } = await import('./voiceNoteService');
      // Use effectiveUserId to see all voice notes from any team member for this job
      const voiceNotes = await getJobVoiceNotes(jobId, userContext.effectiveUserId);
      
      res.json(voiceNotes);
    } catch (error: any) {
      console.error('Error getting voice notes:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload a voice note (team-aware: stored under effectiveUserId so all team members can see them)
  app.post("/api/jobs/:jobId/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { audioData, fileName, mimeType, duration, title } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      if (!audioData) {
        return res.status(400).json({ error: 'Audio data is required' });
      }
      
      // Remove base64 prefix if present
      // Handle MIME types with codec parameters like "audio/webm;codecs=opus"
      // The data URL format is: data:audio/webm;codecs=opus;base64,XXXXX
      const base64Data = audioData.replace(/^data:audio\/[^;]+(?:;[^;]+)*;base64,/, '');
      console.log('[VoiceNote Upload] Original length:', audioData.length, 'Base64 length:', base64Data.length);
      const fileBuffer = Buffer.from(base64Data, 'base64');
      console.log('[VoiceNote Upload] Buffer size:', fileBuffer.length);
      
      const { uploadVoiceNote } = await import('./voiceNoteService');
      // Use effectiveUserId so all team uploads are visible to everyone on the team
      const result = await uploadVoiceNote(userContext.effectiveUserId, jobId, fileBuffer, {
        fileName: fileName || `voice-note-${Date.now()}.webm`,
        fileSize: fileBuffer.length,
        mimeType: mimeType || 'audio/webm',
        duration,
        title,
      });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ 
        success: true, 
        voiceNoteId: result.voiceNoteId,
        objectStorageKey: result.objectStorageKey 
      });
    } catch (error: any) {
      console.error('Error uploading voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update voice note title (team-aware)
  app.patch("/api/jobs/:jobId/voice-notes/:voiceNoteId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      const { title } = req.body;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { updateVoiceNoteTitle } = await import('./voiceNoteService');
      const result = await updateVoiceNoteTitle(voiceNoteId, userContext.effectiveUserId, title);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Transcribe voice note (converts speech to text using Whisper)
  app.post("/api/jobs/:jobId/voice-notes/:voiceNoteId/transcribe", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { transcribeVoiceNote } = await import('./voiceNoteService');
      const result = await transcribeVoiceNote(voiceNoteId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true, transcription: result.transcription });
    } catch (error: any) {
      console.error('Error transcribing voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete voice note (team-aware)
  app.delete("/api/jobs/:jobId/voice-notes/:voiceNoteId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      const { deleteVoiceNote } = await import('./voiceNoteService');
      const result = await deleteVoiceNote(voiceNoteId, userContext.effectiveUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // View/stream a voice note (for when signedUrl is not available)
  app.get("/api/jobs/:jobId/voice-notes/:voiceNoteId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get voice note from database
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }
      
      // Get signed URL and redirect to it
      const { getSignedVoiceNoteUrl } = await import('./voiceNoteService');
      const { url, error } = await getSignedVoiceNoteUrl(voiceNote.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for voice note view:', error);
        return res.status(500).json({ error: 'Failed to access voice note' });
      }
      
      res.redirect(url);
    } catch (error: any) {
      console.error('Error viewing voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stream voice note content directly (for mobile apps that can't handle redirects)
  // Includes on-the-fly transcoding from webm to mp4 for iOS compatibility
  app.get("/api/jobs/:jobId/voice-notes/:voiceNoteId/stream", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, voiceNoteId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Get voice note from database
      const voiceNote = await storage.getVoiceNote(voiceNoteId, userContext.effectiveUserId);
      if (!voiceNote) {
        return res.status(404).json({ error: 'Voice note not found' });
      }
      
      // Get signed URL
      const { getSignedVoiceNoteUrl } = await import('./voiceNoteService');
      const { url, error } = await getSignedVoiceNoteUrl(voiceNote.objectStorageKey);
      
      if (error || !url) {
        console.error('Error getting signed URL for voice note stream:', error);
        return res.status(500).json({ error: 'Failed to access voice note' });
      }
      
      // Check if this is a webm file that needs transcoding for iOS
      const isWebm = voiceNote.mimeType?.includes('webm') || voiceNote.fileName?.endsWith('.webm');
      
      if (isWebm) {
        // Transcode webm to mp4/aac for iOS compatibility using ffmpeg
        // Buffer output first, then verify success before sending response
        console.log('[VoiceNote] Transcoding webm to mp4 for iOS compatibility');
        
        // First verify the source URL is accessible
        try {
          const checkResponse = await fetch(url, { method: 'HEAD' });
          if (!checkResponse.ok) {
            console.error('[VoiceNote] Source URL not accessible:', checkResponse.status);
            return res.status(500).json({ error: 'Voice note source not accessible' });
          }
        } catch (checkError) {
          console.error('[VoiceNote] Failed to check source URL:', checkError);
          return res.status(500).json({ error: 'Failed to verify voice note source' });
        }
        
        const { spawn } = await import('child_process');
        
        // Buffer output to verify transcoding succeeded before sending
        const outputChunks: Buffer[] = [];
        let hasError = false;
        let stderrOutput = '';
        
        // Use ffmpeg to transcode webm -> mp4 (aac audio)
        const ffmpeg = spawn('ffmpeg', [
          '-y',                // Overwrite output
          '-i', url,           // Input from signed URL
          '-c:a', 'aac',       // Convert to AAC codec
          '-b:a', '128k',      // Bitrate
          '-f', 'mp4',         // Output format
          '-movflags', 'frag_keyframe+empty_moov',  // Fragmented MP4 for streaming
          'pipe:1'             // Output to stdout
        ]);
        
        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          outputChunks.push(chunk);
        });
        
        ffmpeg.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString();
          // Check for error indicators
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('error opening') || msg.includes('Invalid')) {
            hasError = true;
          }
        });
        
        ffmpeg.on('error', (err: Error) => {
          console.error('[ffmpeg] Process error:', err);
          hasError = true;
          if (!res.headersSent) {
            res.status(500).json({ error: 'Transcoding failed' });
          }
        });
        
        ffmpeg.on('close', (code: number) => {
          const totalSize = outputChunks.reduce((acc, c) => acc + c.length, 0);
          
          if (code !== 0 || hasError || totalSize < 100) {
            console.error('[ffmpeg] Transcoding failed - code:', code, 'totalSize:', totalSize, 'hasError:', hasError);
            console.error('[ffmpeg] stderr:', stderrOutput.substring(0, 500));
            if (!res.headersSent) {
              res.status(500).json({ error: 'Transcoding failed' });
            }
          } else {
            console.log('[ffmpeg] Transcoding complete, output size:', totalSize);
            // Only now set headers and send response
            res.setHeader('Content-Type', 'audio/mp4');
            res.setHeader('Content-Length', totalSize);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            for (const chunk of outputChunks) {
              res.write(chunk);
            }
            res.end();
          }
        });
        
        // Handle client disconnect
        req.on('close', () => {
          ffmpeg.kill('SIGTERM');
        });
        
        return;
      }
      
      // Non-webm files: fetch and stream directly
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch voice note' });
      }
      
      // Determine content type
      let contentType = voiceNote.mimeType || 'audio/mpeg';
      if (voiceNote.fileName?.endsWith('.m4a')) {
        contentType = 'audio/mp4';
      }
      
      // Set proper headers for audio streaming
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the response
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Length', arrayBuffer.byteLength);
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error streaming voice note:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB DOCUMENTS ROUTES (uploaded PDFs, external quotes/invoices) =====
  
  // Get documents for a job (team-aware: shows all documents for the job)
  app.get("/api/jobs/:jobId/documents", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const documents = await storage.getJobDocuments(jobId, userContext.effectiveUserId);
      
      const objectStorage = new ObjectStorageService();
      const documentsWithUrls = await Promise.all(documents.map(async (doc) => {
        try {
          const { bucketName, objectName } = parseObjectPath(doc.objectStorageKey);
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 3600 * 1000,
          });
          return { ...doc, fileUrl: signedUrl };
        } catch (error) {
          console.error('Error getting signed URL for document:', error);
          return { ...doc, fileUrl: null };
        }
      }));
      
      res.json(documentsWithUrls);
    } catch (error: any) {
      console.error('Error getting job documents:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload document to a job (multipart form)
  app.post("/api/jobs/:jobId/documents", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const file = req.file;
      
      const userContext = await getUserContext(userId);
      
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const { title, documentType } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF and images are allowed.' });
      }
      
      const objectStorage = new ObjectStorageService();
      const privateDir = objectStorage.getPrivateObjectDir();
      const fileExtension = file.originalname.split('.').pop() || 'pdf';
      const objectKey = `${privateDir}/job-documents/${userContext.effectiveUserId}/${jobId}/${Date.now()}-${randomBytes(4).toString('hex')}.${fileExtension}`;
      
      const { bucketName, objectName } = parseObjectPath(objectKey);
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      
      await gcsFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      const document = await storage.createJobDocument({
        userId: userContext.effectiveUserId,
        jobId,
        title,
        documentType: documentType || 'other',
        fileName: file.originalname,
        objectStorageKey: objectKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
      });
      
      const [signedUrl] = await gcsFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000,
      });
      
      res.json({ ...document, fileUrl: signedUrl, success: true });
    } catch (error: any) {
      console.error('Error uploading job document:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete a document
  app.delete("/api/jobs/:jobId/documents/:docId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, docId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const document = await storage.getJobDocument(docId, userContext.effectiveUserId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      try {
        const { bucketName, objectName } = parseObjectPath(document.objectStorageKey);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        await file.delete();
      } catch (deleteError) {
        console.error('Error deleting file from object storage:', deleteError);
      }
      
      const deleted = await storage.deleteJobDocument(docId, userContext.effectiveUserId);
      
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job document:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // View/download a document
  app.get("/api/jobs/:jobId/documents/:docId/view", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { docId } = req.params;
      
      const userContext = await getUserContext(userId);
      
      const document = await storage.getJobDocument(docId, userContext.effectiveUserId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const { bucketName, objectName } = parseObjectPath(document.objectStorageKey);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000,
      });
      
      res.redirect(signedUrl);
    } catch (error: any) {
      console.error('Error viewing document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB SIGNATURE ROUTES =====
  
  // Get signatures for a job (team-aware: shows all signatures for the job)
  app.get("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, jobId));
      
      // Ensure consistent camelCase property names for mobile/web clients
      const mappedSignatures = signatures.map(sig => ({
        id: sig.id,
        jobId: sig.jobId,
        clientId: sig.clientId,
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerRole: sig.signerRole || 'client',
        signatureData: sig.signatureData,
        signedAt: sig.signedAt,
        documentType: sig.documentType,
        ipAddress: sig.ipAddress,
        userAgent: sig.userAgent,
      }));
      
      res.json(mappedSignatures);
    } catch (error: any) {
      console.error('Error getting signatures:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add signature to a job (team-aware)
  app.post("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { signerName, signerEmail, signatureData, signerRole, saveToClient } = req.body;
      
      if (!signerName || !signatureData) {
        return res.status(400).json({ error: 'Signer name and signature data are required' });
      }
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const [signature] = await db.insert(digitalSignatures).values({
        jobId,
        clientId: job.clientId,
        signerName,
        signerEmail: signerEmail || null,
        signerRole: signerRole || 'client',
        signatureData,
        signedAt: new Date(),
        documentType: 'job_completion',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).returning();
      
      // If saveToClient is true and signerRole is 'client', save signature to client profile
      if (saveToClient && (signerRole === 'client' || !signerRole)) {
        try {
          await db.update(clients)
            .set({ 
              savedSignatureData: signatureData,
              savedSignatureDate: new Date(),
              updatedAt: new Date()
            })
            .where(eq(clients.id, job.clientId));
        } catch (clientError) {
          console.log('Could not save signature to client profile:', clientError);
        }
      }
      
      // Return with explicit camelCase property names
      res.json({
        id: signature.id,
        jobId: signature.jobId,
        clientId: signature.clientId,
        signerName: signature.signerName,
        signerEmail: signature.signerEmail,
        signerRole: signature.signerRole || 'client',
        signatureData: signature.signatureData,
        signedAt: signature.signedAt,
        documentType: signature.documentType,
        ipAddress: signature.ipAddress,
        userAgent: signature.userAgent,
      });
    } catch (error: any) {
      console.error('Error saving signature:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete a signature (team-aware)
  app.delete("/api/jobs/:jobId/signatures/:signatureId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, signatureId } = req.params;
      
      // Get user context to properly scope to business for team members
      const userContext = await getUserContext(userId);
      
      // Verify job access using effectiveUserId
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await db.delete(digitalSignatures).where(eq(digitalSignatures.id, signatureId));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting signature:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB CHAT ROUTES =====
  
  // Helper function to verify user has access to a job's chat
  // Returns the job if authorized, null otherwise
  async function getJobWithChatAccess(jobId: string, userId: string) {
    // First try direct job ownership
    const directJob = await storage.getJob(jobId, userId);
    if (directJob) return directJob;
    
    // Check if user is an ACTIVE team member and can access jobs from their business owner
    const teamMembership = await storage.getTeamMembershipByMemberId(userId);
    if (teamMembership && 
        teamMembership.inviteStatus === 'accepted' && 
        teamMembership.isActive) {
      const ownerJob = await storage.getJob(jobId, teamMembership.businessOwnerId);
      // Verify the job actually belongs to the team member's business owner
      if (ownerJob && ownerJob.userId === teamMembership.businessOwnerId) {
        return ownerJob;
      }
    }
    
    return null;
  }
  
  // Get chat messages for a job
  app.get("/api/jobs/:jobId/chat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify user has access to this job (owner, team member, or assigned)
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const messages = await storage.getJobChatMessages(jobId);
      
      // Enrich messages with user info
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const user = await storage.getUser(msg.userId);
          return {
            ...msg,
            senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
            senderAvatar: user?.profileImageUrl,
          };
        })
      );
      
      // Mark messages as read for this user
      await storage.markJobChatAsRead(jobId, userId);
      
      res.json(enrichedMessages);
    } catch (error: any) {
      console.error('Error getting job chat:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send a chat message for a job
  app.post("/api/jobs/:jobId/chat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify user has access to this job
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const validatedData = insertJobChatSchema.parse({
        ...req.body,
        jobId,
        userId,
      });
      
      const message = await storage.createJobChatMessage(validatedData);
      
      // Enrich with user info
      const user = await storage.getUser(userId);
      const senderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown';
      const enrichedMessage = {
        ...message,
        senderName,
        senderAvatar: user?.profileImageUrl,
      };
      
      // Send push notifications to other job chat participants
      try {
        const messagePreview = req.body.message || '';
        
        // Notify job owner if they didn't send the message
        if (job.userId !== userId) {
          await notifyTeamMessage(job.userId, senderName, messagePreview, 'job');
          console.log(`[PushNotification] Sent job chat notification to owner ${job.userId}`);
        }
        
        // Notify assigned user if they exist and didn't send the message
        // Resolve assignedTo to proper user ID (it may be a team member record ID)
        const assigneeUserId = await resolveAssigneeUserId(job.assignedTo, job.userId);
        if (assigneeUserId && assigneeUserId !== userId && assigneeUserId !== job.userId) {
          await notifyTeamMessage(assigneeUserId, senderName, messagePreview, 'job');
          console.log(`[PushNotification] Sent job chat notification to assignee ${assigneeUserId}`);
        }
      } catch (pushError) {
        console.error('[PushNotification] Error sending job chat notification:', pushError);
      }
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error sending job chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload attachment for job chat (photos, videos, files)
  const chatUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for chat attachments
  });
  
  app.post("/api/jobs/:jobId/chat/upload", requireAuth, chatUpload.single('file'), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const file = req.file;
      const { message } = req.body;
      
      // Verify user has access to this job
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Determine message type based on mime type
      let messageType = 'file';
      if (file.mimetype.startsWith('image/')) {
        messageType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        messageType = 'video';
      }
      
      // Upload file to object storage
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `/.private/chat-attachments/${userId}/${jobId}/${timestamp}_${safeName}`;
      
      const attachmentUrl = await objectStorageService.uploadFile(fileName, file.buffer, file.mimetype);
      
      if (!attachmentUrl) {
        return res.status(500).json({ error: 'Failed to upload attachment' });
      }
      
      // Create chat message with attachment
      const validatedData = insertJobChatSchema.parse({
        jobId,
        userId,
        message: message || file.originalname,
        messageType,
        attachmentUrl,
        attachmentName: file.originalname,
      });
      
      const chatMessage = await storage.createJobChatMessage(validatedData);
      
      // Enrich with user info
      const user = await storage.getUser(userId);
      const enrichedMessage = {
        ...chatMessage,
        senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        senderAvatar: user?.profileImageUrl,
      };
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error uploading chat attachment:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get job chat participants - who can see messages in this job chat
  app.get("/api/jobs/:jobId/chat/participants", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify access
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      // Get participants list
      const participants: Array<{ id: string; name: string; role: string; avatar?: string | null }> = [];
      
      // 1. Job owner (business owner)
      const owner = await storage.getUser(job.userId);
      if (owner) {
        participants.push({
          id: owner.id,
          name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Owner',
          role: 'Owner',
          avatar: owner.profileImageUrl,
        });
      }
      
      // 2. Assigned tradie (if different from owner)
      if (job.assignedTo && job.assignedTo !== job.userId) {
        const assignedUser = await storage.getUser(job.assignedTo);
        if (assignedUser) {
          // Check their team role
          const membership = await storage.getTeamMembershipByMemberId(job.assignedTo);
          const role = membership?.role || 'Assigned';
          participants.push({
            id: assignedUser.id,
            name: `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email || 'Team Member',
            role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            avatar: assignedUser.profileImageUrl,
          });
        }
      }
      
      // 3. Team admins/supervisors (they have access to all jobs)
      const teamMembers = await storage.getTeamMembers(job.userId);
      for (const member of teamMembers) {
        if (member.inviteStatus === 'accepted' && 
            member.isActive && 
            (member.role === 'admin' || member.role === 'supervisor') &&
            !participants.some(p => p.id === member.memberId)) {
          const memberUser = await storage.getUser(member.memberId);
          if (memberUser) {
            participants.push({
              id: memberUser.id,
              name: `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim() || memberUser.email || 'Team Member',
              role: member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase(),
              avatar: memberUser.profileImageUrl,
            });
          }
        }
      }
      
      // Get client information if job has a client
      let client = null;
      if (job.clientId) {
        client = await storage.getClient(job.clientId, job.userId);
      }
      
      res.json({ 
        participants,
        jobTitle: job.title,
        participantCount: participants.length,
        client: client ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
        } : null,
      });
    } catch (error: any) {
      console.error('Error getting job chat participants:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get unread count for job chat
  app.get("/api/jobs/:jobId/chat/unread", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      // Verify access before returning count
      const job = await getJobWithChatAccess(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      const count = await storage.getUnreadJobChatCount(jobId, userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete message from job chat (own messages or any message if owner/admin/manager)
  app.delete("/api/jobs/:jobId/chat/:messageId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, messageId } = req.params;
      
      // Check user context for role-based deletion
      const userContext = await getUserContext(userId);
      const canDeleteAny = userContext.isOwner || hasPermission(userContext, PERMISSIONS.MANAGE_TEAM);
      
      // First verify the job belongs to this user's business
      const job = await storage.getJob(jobId, userContext.effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or access denied' });
      }
      
      // Verify job belongs to the correct business owner
      if (job.userId !== userContext.businessOwnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // If owner/admin/manager, can delete any message in their jobs
      if (canDeleteAny) {
        const deleted = await storage.forceDeleteJobChatMessage(messageId, jobId, job.userId);
        if (deleted) {
          return res.json({ success: true });
        }
      }
      
      // Otherwise, users can only delete their own messages
      const deleted = await storage.deleteJobChatMessage(messageId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Message not found or not authorized' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB MAP ROUTES =====

  // Get all jobs with location data for map display
  app.get("/api/jobs/map-data", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const effectiveUserId = userContext.effectiveUserId;
      
      const jobs = await storage.getJobs(effectiveUserId);
      const clients = await storage.getClients(effectiveUserId);
      
      const clientMap = new Map(clients.map(c => [c.id, c]));
      
      const mapData = jobs.map(job => {
        const client = clientMap.get(job.clientId);
        return {
          id: job.id,
          title: job.title,
          address: job.address || '',
          latitude: job.latitude ? parseFloat(job.latitude) : null,
          longitude: job.longitude ? parseFloat(job.longitude) : null,
          status: job.status,
          scheduledAt: job.scheduledAt,
          assignedTo: job.assignedTo,
          clientName: client?.name || 'Unknown Client',
          clientPhone: client?.phone || null,
        };
      });
      
      res.json(mapData);
    } catch (error: any) {
      console.error('Error fetching map data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get team member locations (for owners/managers only)
  app.get("/api/team/locations", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      
      console.log('[TeamLocations] User context:', { 
        userId: req.userId, 
        isOwner: userContext.isOwner, 
        effectiveUserId: userContext.effectiveUserId 
      });
      
      // Only owners and managers can view team locations
      if (!userContext.isOwner && !hasPermission(userContext, PERMISSIONS.VIEW_ALL)) {
        console.log('[TeamLocations] Access denied for user:', req.userId);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const effectiveUserId = userContext.effectiveUserId;
      const teamMembers = await storage.getTeamMembers(effectiveUserId);
      const activeMembers = teamMembers.filter(m => m.inviteStatus === 'accepted' && m.isActive);
      
      console.log('[TeamLocations] Found', teamMembers.length, 'total team members,', activeMembers.length, 'active');
      
      const locations = [];
      
      for (const member of activeMembers) {
        if (!member.memberId) continue;
        
        const user = await storage.getUser(member.memberId);
        if (!user) continue;
        
        // Get most recent location for this team member - check both locationTracking and tradieStatus
        const recentLocation = await storage.getLatestLocationForUser(member.memberId);
        const tradieStatusData = await storage.getTradieStatus(member.memberId);
        
        // Get current active job if any
        const activeTimeEntry = await storage.getActiveTimeEntry(member.memberId);
        let currentJob = null;
        if (activeTimeEntry?.jobId) {
          currentJob = await storage.getJob(activeTimeEntry.jobId, effectiveUserId);
        }
        
        // Use locationTracking first, fall back to tradieStatus for demo data
        // Include all Life360-style fields for mobile parity with web
        if (recentLocation) {
          const speed = recentLocation.speed ? parseFloat(recentLocation.speed) : 
                        tradieStatusData?.speed ? parseFloat(tradieStatusData.speed) : 0;
          locations.push({
            id: member.memberId,
            name: `${member.firstName || user.firstName || ''} ${member.lastName || user.lastName || ''}`.trim() || user.email,
            email: user.email,
            profileImageUrl: user.profileImageUrl || null,
            themeColor: user.themeColor || null,
            latitude: parseFloat(recentLocation.latitude),
            longitude: parseFloat(recentLocation.longitude),
            lastUpdated: recentLocation.timestamp,
            currentJobId: currentJob?.id || null,
            currentJobTitle: currentJob?.title || null,
            activityStatus: tradieStatusData?.activityStatus || 'online',
            speed: speed,
            batteryLevel: tradieStatusData?.batteryLevel || recentLocation.batteryLevel || null,
            heading: recentLocation.heading ? parseFloat(recentLocation.heading) : null,
          });
        } else if (tradieStatusData?.currentLatitude && tradieStatusData?.currentLongitude) {
          // Fallback to tradieStatus data (used by demo data)
          const speed = tradieStatusData.speed ? parseFloat(tradieStatusData.speed) : 0;
          locations.push({
            id: member.memberId,
            name: `${member.firstName || user.firstName || ''} ${member.lastName || user.lastName || ''}`.trim() || user.email,
            email: user.email,
            profileImageUrl: user.profileImageUrl || null,
            themeColor: user.themeColor || null,
            latitude: parseFloat(tradieStatusData.currentLatitude),
            longitude: parseFloat(tradieStatusData.currentLongitude),
            lastUpdated: tradieStatusData.lastLocationUpdate || tradieStatusData.lastSeenAt,
            currentJobId: currentJob?.id || null,
            currentJobTitle: currentJob?.title || null,
            activityStatus: tradieStatusData.activityStatus || 'online',
            speed: speed,
            batteryLevel: tradieStatusData.batteryLevel || null,
            heading: tradieStatusData.heading ? parseFloat(tradieStatusData.heading) : null,
          });
        }
      }
      
      console.log('[TeamLocations] Returning', locations.length, 'locations');
      res.json(locations);
    } catch (error: any) {
      console.error('Error fetching team locations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Geocode an address (uses OpenStreetMap Nominatim - free)
  app.post("/api/geocode", requireAuth, async (req: any, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }
      
      // Use OpenStreetMap Nominatim for geocoding (free, no API key needed)
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'TradieTrack/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      
      const results = await response.json();
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'Address not found' });
      }
      
      const result = results[0];
      res.json({
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
      });
    } catch (error: any) {
      console.error('Error geocoding address:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update job coordinates after geocoding
  app.patch("/api/jobs/:id/coordinates", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { latitude, longitude } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }
      
      const job = await storage.updateJob(
        req.params.id,
        userContext.effectiveUserId,
        { latitude: latitude.toString(), longitude: longitude.toString() }
      );
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error('Error updating job coordinates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== JOB MAP ROUTES =====
  
  // Helper to validate coordinates are within valid ranges
  function isValidCoordinate(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180 &&
           !(lat === 0 && lng === 0); // Exclude 0,0 which is often a default/error value
  }
  
  // Calculate distance between two coordinates in meters (Haversine formula)
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Get jobs with coordinates for map display
  app.get("/api/map/jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const jobs = await storage.getJobs(userContext.effectiveUserId);
      
      // Batch fetch all clients for efficiency
      const clients = await storage.getClients(userContext.effectiveUserId);
      const clientMap = new Map(clients.map(c => [c.id, c]));
      
      // Process jobs - geocode those with addresses but no coordinates
      const processedJobs = await Promise.all(
        jobs.map(async (job) => {
          let lat = job.latitude ? parseFloat(job.latitude) : null;
          let lng = job.longitude ? parseFloat(job.longitude) : null;
          
          // If no valid coordinates but has address, try to geocode
          if ((!lat || !lng || !isValidCoordinate(lat, lng)) && job.address) {
            try {
              const coords = await geocodeAddress(job.address);
              if (coords) {
                lat = coords.latitude;
                lng = coords.longitude;
                // Update job with coordinates for future use (fire and forget)
                storage.updateJob(job.id, userContext.effectiveUserId, {
                  latitude: lat.toString(),
                  longitude: lng.toString()
                }).catch(e => console.error(`Failed to save geocoded coords for job ${job.id}:`, e));
              }
            } catch (e) {
              // Geocoding failed, skip this job for map display
            }
          }
          
          return { ...job, lat, lng };
        })
      );
      
      // Transform jobs to map data format - only include jobs with valid coordinates
      const mapData = processedJobs
        .filter(job => job.lat && job.lng && isValidCoordinate(job.lat, job.lng))
        .map(job => {
          const client = job.clientId ? clientMap.get(job.clientId) : null;
          return {
            id: job.id,
            title: job.title,
            address: job.address || '',
            latitude: job.lat!,
            longitude: job.lng!,
            status: job.status,
            scheduledAt: job.scheduledAt,
            assignedTo: job.assignedToId,
            clientName: client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.businessName || client.email || 'Unknown Client' : 'No Client',
            clientPhone: client?.phone || '',
          };
        });
      
      res.json(mapData);
    } catch (error: any) {
      console.error('Error fetching map jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get team member locations (Life360-style enhanced data)
  app.get("/api/map/team-locations", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      
      // Get enhanced status and location for each team member
      const locations = await Promise.all(
        teamMembers.map(async (member) => {
          if (!member.memberId) return null;
          
          // Try to get tradie status first (enhanced Life360-style data)
          const status = await storage.getTradieStatus(member.memberId);
          
          // Fall back to location tracking if no tradie status
          const location = await storage.getLatestLocationForUser(member.memberId);
          
          // Get user info for profile picture
          const user = await storage.getUser(member.memberId);
          
          // Use tradie status if available, otherwise use location tracking
          const lat = status?.currentLatitude ? parseFloat(status.currentLatitude) : 
                      location?.latitude ? parseFloat(location.latitude) : null;
          const lng = status?.currentLongitude ? parseFloat(status.currentLongitude) :
                      location?.longitude ? parseFloat(location.longitude) : null;
          
          if (!lat || !lng) return null;
          
          // Validate coordinates
          if (!isValidCoordinate(lat, lng)) return null;
          
          // Get current job title if assigned
          let currentJobTitle = undefined;
          const currentJobId = status?.currentJobId || location?.jobId;
          if (currentJobId) {
            const job = await storage.getJob(currentJobId);
            currentJobTitle = job?.title || 'On Job';
          }
          
          // Calculate if tradie is "active" (online in last 15 minutes)
          const lastActivity = status?.lastSeenAt || location?.timestamp;
          const isActive = lastActivity ? 
            (Date.now() - new Date(lastActivity).getTime()) < 15 * 60 * 1000 : false;
          
          // Determine activity indicator
          const activityStatus = status?.activityStatus || 'offline';
          const speed = status?.speed ? parseFloat(status.speed) : 
                        location?.speed ? parseFloat(location.speed) : 0;
          const isDriving = speed > 5; // Over 5 km/h = driving
          
          return {
            id: member.memberId,
            name: `${member.firstName || user?.firstName || ''} ${member.lastName || user?.lastName || ''}`.trim() || member.email,
            email: member.email,
            profileImageUrl: user?.profileImageUrl || null,
            themeColor: user?.themeColor || null,
            latitude: lat,
            longitude: lng,
            // Life360-style enhancements
            lastSeenAt: status?.lastSeenAt || location?.timestamp,
            activityStatus: activityStatus,
            isActive: isActive,
            isDriving: isDriving,
            speed: speed,
            heading: status?.heading ? parseFloat(status.heading) : 
                     location?.heading ? parseFloat(location.heading) : null,
            batteryLevel: status?.batteryLevel || location?.batteryLevel || null,
            isCharging: status?.isCharging || location?.isCharging || false,
            currentJobId: currentJobId,
            currentJobTitle: currentJobTitle,
            currentAddress: status?.currentAddress || location?.address || null,
          };
        })
      );
      
      // Filter out null entries (members without valid locations)
      res.json(locations.filter(Boolean));
    } catch (error: any) {
      console.error('Error fetching team locations:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update tradie's own location and status (called from tradie's device)
  app.post("/api/map/update-location", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const userContext = await getUserContext(userId);
      const { 
        latitude, 
        longitude, 
        accuracy,
        address,
        speed, 
        heading, 
        altitude,
        batteryLevel, 
        isCharging, 
        activityType,
        currentJobId 
      } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }
      
      // Save location to tracking history
      await storage.createLocationEntry({
        userId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
        address,
        speed: speed?.toString(),
        heading: heading?.toString(),
        altitude: altitude?.toString(),
        batteryLevel: batteryLevel || null,
        isCharging: isCharging || false,
        activityType: activityType || 'stationary',
        jobId: currentJobId || null,
        timestamp: new Date(),
        trackingType: 'automatic',
      });
      
      // Update tradie status (Life360-style current status)
      if (userContext.effectiveUserId !== userId) {
        // User is a team member - update their tradie status
        await storage.upsertTradieStatus({
          userId,
          businessOwnerId: userContext.effectiveUserId,
          currentLatitude: latitude.toString(),
          currentLongitude: longitude.toString(),
          currentAddress: address || null,
          activityStatus: speed > 5 ? 'driving' : activityType === 'working' ? 'working' : 'online',
          currentJobId: currentJobId || null,
          batteryLevel: batteryLevel || null,
          isCharging: isCharging || false,
          speed: speed?.toString() || null,
          heading: heading?.toString() || null,
          lastSeenAt: new Date(),
          lastLocationUpdate: new Date(),
        });
        
        // Check for geofence alerts (arrival/departure from job sites)
        if (currentJobId) {
          const job = await storage.getJob(currentJobId);
          if (job?.latitude && job?.longitude) {
            const jobLat = parseFloat(job.latitude);
            const jobLng = parseFloat(job.longitude);
            const distance = calculateDistance(latitude, longitude, jobLat, jobLng);
            
            // Within 100 meters of job site = arrival
            if (distance <= 100) {
              // Check if we already have a recent arrival alert
              const recentAlerts = await storage.getGeofenceAlertsForBusiness(userContext.effectiveUserId, 10);
              const hasRecentArrival = recentAlerts.some(a => 
                a.userId === userId && 
                a.jobId === currentJobId && 
                a.alertType === 'arrival' &&
                (Date.now() - new Date(a.createdAt!).getTime()) < 30 * 60 * 1000 // 30 minutes
              );
              
              if (!hasRecentArrival) {
                await storage.createGeofenceAlert({
                  userId,
                  jobId: currentJobId,
                  businessOwnerId: userContext.effectiveUserId,
                  alertType: 'arrival',
                  latitude: latitude.toString(),
                  longitude: longitude.toString(),
                  address: address || job.address || null,
                  distanceFromSite: distance.toString(),
                });
              }
            }
          }
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get geofence alerts for the business
  app.get("/api/map/geofence-alerts", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const alerts = await storage.getGeofenceAlertsForBusiness(userContext.effectiveUserId);
      
      // Enrich with user and job info
      const enrichedAlerts = await Promise.all(alerts.map(async (alert) => {
        const user = await storage.getUser(alert.userId);
        const job = await storage.getJob(alert.jobId);
        return {
          ...alert,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          userAvatar: user?.profileImageUrl,
          jobTitle: job?.title || 'Unknown Job',
        };
      }));
      
      res.json(enrichedAlerts);
    } catch (error: any) {
      console.error('Error fetching geofence alerts:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Mark geofence alert as read
  app.post("/api/map/geofence-alerts/:alertId/read", requireAuth, async (req: any, res) => {
    try {
      const { alertId } = req.params;
      await storage.markGeofenceAlertAsRead(alertId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking alert as read:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SAVED ROUTES API =====
  
  // Get all saved routes for the user
  app.get("/api/saved-routes", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const userRoutes = await storage.getRoutes(userContext.effectiveUserId);
      res.json(userRoutes);
    } catch (error: any) {
      console.error('Error fetching saved routes:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get a specific saved route
  app.get("/api/saved-routes/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userContext = await getUserContext(req.userId);
      const route = await storage.getRoute(id, userContext.effectiveUserId);
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }
      res.json(route);
    } catch (error: any) {
      console.error('Error fetching route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create a new saved route
  app.post("/api/saved-routes", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { name, jobIds, startAddress, endAddress, waypoints, distance, estimatedDuration, routeDate, status } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Route name is required' });
      }
      
      const newRoute = await storage.createRoute({
        userId: userContext.effectiveUserId,
        name: name.trim(),
        jobIds: jobIds || [],
        startAddress,
        endAddress,
        waypoints: waypoints || [],
        distance,
        estimatedDuration,
        routeDate: routeDate ? new Date(routeDate) : null,
        status: status || 'saved',
      });
      
      res.json(newRoute);
    } catch (error: any) {
      console.error('Error creating route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update a saved route
  app.patch("/api/saved-routes/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userContext = await getUserContext(req.userId);
      const updates = req.body;
      
      const updatedRoute = await storage.updateRoute(id, userContext.effectiveUserId, updates);
      if (!updatedRoute) {
        return res.status(404).json({ error: 'Route not found' });
      }
      
      res.json(updatedRoute);
    } catch (error: any) {
      console.error('Error updating route:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete a saved route
  app.delete("/api/saved-routes/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userContext = await getUserContext(req.userId);
      const deleted = await storage.deleteRoute(id, userContext.effectiveUserId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Route not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting route:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== DIRECT MESSAGING ROUTES =====
  
  // Get direct message conversations for current user
  app.get("/api/direct-messages/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const conversations = await storage.getDirectMessageConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      console.error('Error fetching DM conversations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages in a direct conversation
  app.get("/api/direct-messages/:recipientId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { recipientId } = req.params;
      
      const messages = await storage.getDirectMessages(userId, recipientId);
      
      // Mark messages as read
      await storage.markDirectMessagesAsRead(userId, recipientId);
      
      res.json(messages);
    } catch (error: any) {
      console.error('Error fetching direct messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send a direct message
  app.post("/api/direct-messages/:recipientId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { recipientId } = req.params;
      const { content, attachmentUrl, attachmentType } = req.body;
      
      if (!content?.trim() && !attachmentUrl) {
        return res.status(400).json({ error: 'Message content or attachment is required' });
      }
      
      // Verify both users exist and can message each other
      const sender = await storage.getUser(userId);
      const recipient = await storage.getUser(recipientId);
      
      if (!sender || !recipient) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const message = await storage.createDirectMessage({
        senderId: userId,
        recipientId,
        content: content?.trim() || '',
        attachmentUrl,
        attachmentType,
      });
      
      // Enrich with sender info
      const enrichedMessage = {
        ...message,
        senderName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email,
        senderAvatar: sender.profileImageUrl,
      };
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error sending direct message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get unread DM count
  app.get("/api/direct-messages/unread/count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const count = await storage.getUnreadDirectMessageCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error getting unread DM count:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== TEAM CHAT ROUTES =====
  
  // Helper function to get business context for team chat
  // Returns { businessOwnerId, isOwner, hasAccess } - businessOwnerId is the actual owner's ID
  // Only grants access to ACTIVE team members with accepted invites
  async function getTeamChatContext(userId: string) {
    const teamMembership = await storage.getTeamMembershipByMemberId(userId);
    if (teamMembership && 
        teamMembership.inviteStatus === 'accepted' && 
        teamMembership.isActive) {
      // User is an active team member with accepted invite, they can access their business owner's team chat
      return { 
        businessOwnerId: teamMembership.businessOwnerId, 
        isOwner: false,
        hasAccess: true
      };
    }
    // User is a business owner, they can access their own team chat
    // Verify they actually have a business (have settings or are an active user)
    const user = await storage.getUser(userId);
    if (user && user.isActive) {
      return { 
        businessOwnerId: userId, 
        isOwner: true,
        hasAccess: true
      };
    }
    return { businessOwnerId: null, isOwner: false, hasAccess: false };
  }
  
  // Get team chat messages
  app.get("/api/team-chat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const context = await getTeamChatContext(userId);
      if (!context.hasAccess || !context.businessOwnerId) {
        return res.status(403).json({ error: 'No team chat access' });
      }
      
      const messages = await storage.getTeamChatMessages(context.businessOwnerId);
      
      // Enrich messages with user info
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const user = await storage.getUser(msg.senderId);
          return {
            ...msg,
            senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
            senderAvatar: user?.profileImageUrl,
          };
        })
      );
      
      // Mark messages as read for this user
      await storage.markTeamChatAsRead(context.businessOwnerId, userId);
      
      res.json(enrichedMessages);
    } catch (error: any) {
      console.error('Error getting team chat:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send a team chat message
  app.post("/api/team-chat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const context = await getTeamChatContext(userId);
      if (!context.hasAccess || !context.businessOwnerId) {
        return res.status(403).json({ error: 'No team chat access' });
      }
      
      const validatedData = insertTeamChatSchema.parse({
        ...req.body,
        businessOwnerId: context.businessOwnerId,
        senderId: userId,
      });
      
      const message = await storage.createTeamChatMessage(validatedData);
      
      // Enrich with user info
      const user = await storage.getUser(userId);
      const senderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown';
      const enrichedMessage = {
        ...message,
        senderName,
        senderAvatar: user?.profileImageUrl,
      };
      
      // Send push notifications to all team members except sender
      try {
        const messagePreview = req.body.message || '';
        const teamMembers = await storage.getTeamMembers(context.businessOwnerId);
        
        // Notify business owner if they didn't send the message
        if (context.businessOwnerId !== userId) {
          await notifyTeamMessage(context.businessOwnerId, senderName, messagePreview, 'team');
          console.log(`[PushNotification] Sent team chat notification to owner ${context.businessOwnerId}`);
        }
        
        // Notify active team members except sender
        for (const member of teamMembers) {
          if (member.memberId !== userId && member.inviteStatus === 'accepted' && member.isActive) {
            await notifyTeamMessage(member.memberId, senderName, messagePreview, 'team');
            console.log(`[PushNotification] Sent team chat notification to member ${member.memberId}`);
          }
        }
      } catch (pushError) {
        console.error('[PushNotification] Error sending team chat notification:', pushError);
      }
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error sending team chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get unread count for team chat
  app.get("/api/team-chat/unread", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const context = await getTeamChatContext(userId);
      if (!context.hasAccess || !context.businessOwnerId) {
        return res.json({ count: 0 });
      }
      
      const count = await storage.getUnreadTeamChatCount(context.businessOwnerId, userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get aggregated unread counts for all chat types (for badge in navigation)
  app.get("/api/chat/unread-counts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const context = await getTeamChatContext(userId);
      let teamChatUnread = 0;
      let smsUnread = 0;
      
      if (context.hasAccess && context.businessOwnerId) {
        teamChatUnread = await storage.getUnreadTeamChatCount(context.businessOwnerId, userId);
        
        // Get SMS unread counts - sum all unread from SMS conversations for this business
        const smsConversations = await storage.getSmsConversationsByBusiness(context.businessOwnerId);
        smsUnread = smsConversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
      }
      
      // Return all chat type unread counts
      res.json({ 
        teamChat: teamChatUnread,
        directMessages: 0,
        jobChats: 0,
        sms: smsUnread,
        total: teamChatUnread + smsUnread
      });
    } catch (error: any) {
      console.error('Error getting unread counts:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Pin/unpin team chat message (owner only)
  app.patch("/api/team-chat/:messageId/pin", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;
      const { pinned } = req.body;
      
      const context = await getTeamChatContext(userId);
      if (!context.hasAccess || !context.businessOwnerId) {
        return res.status(403).json({ error: 'No team chat access' });
      }
      
      // Only business owner can pin messages
      if (!context.isOwner) {
        return res.status(403).json({ error: 'Only the business owner can pin messages' });
      }
      
      const message = await storage.pinTeamChatMessage(messageId, context.businessOwnerId, pinned);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      res.json(message);
    } catch (error: any) {
      console.error('Error pinning message:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete message from team chat (own messages or any message if owner/admin/manager)
  app.delete("/api/team-chat/:messageId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;
      
      // Check user context for role-based deletion
      const userContext = await getUserContext(userId);
      const canDeleteAny = userContext.isOwner || hasPermission(userContext, PERMISSIONS.MANAGE_TEAM);
      
      // If owner/admin/manager, can delete any message
      if (canDeleteAny && userContext.businessOwnerId) {
        const deleted = await storage.forceDeleteTeamChatMessage(messageId, userContext.businessOwnerId);
        if (deleted) {
          return res.json({ success: true });
        }
      }
      
      // Otherwise, users can only delete their own messages
      const deleted = await storage.deleteTeamChatMessage(messageId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Message not found or not authorized' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting team chat message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SMS CONVERSATIONS ROUTES =====
  
  // Get Twilio status
  app.get("/api/sms/status", requireAuth, async (req: any, res) => {
    try {
      const { getTwilioStatus } = await import('./services/smsService');
      const status = getTwilioStatus();
      res.json(status);
    } catch (error: any) {
      console.error('Error getting Twilio status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SMS TEMPLATES ROUTES =====
  
  // Get available merge fields
  app.get("/api/sms/templates/merge-fields", requireAuth, async (req: any, res) => {
    try {
      const { AVAILABLE_MERGE_FIELDS } = await import('./services/smsService');
      res.json(AVAILABLE_MERGE_FIELDS);
    } catch (error: any) {
      console.error('Error getting merge fields:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // List user's SMS templates
  app.get("/api/sms/templates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const templates = await storage.getSmsTemplates(userId);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching SMS templates:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get a specific SMS template
  app.get("/api/sms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const template = await storage.getSmsTemplate(id, userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching SMS template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create a new SMS template
  app.post("/api/sms/templates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const validatedData = insertSmsTemplateSchema.parse({
        ...req.body,
        userId,
      });
      const template = await storage.createSmsTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating SMS template:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Update an SMS template
  app.put("/api/sms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Check template exists and belongs to user
      const existing = await storage.getSmsTemplate(id, userId);
      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const { name, category, body, isDefault } = req.body;
      const template = await storage.updateSmsTemplate(id, userId, { 
        name, 
        category, 
        body, 
        isDefault 
      });
      res.json(template);
    } catch (error: any) {
      console.error('Error updating SMS template:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Delete an SMS template
  app.delete("/api/sms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteSmsTemplate(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting SMS template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Apply template with merge fields
  app.post("/api/sms/templates/:id/apply", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { clientId, jobId, quoteId, invoiceId } = req.body;
      
      // Get the template
      const template = await storage.getSmsTemplate(id, userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Gather context for merge fields
      const businessSettings = await storage.getBusinessSettings(userId);
      const client = clientId ? await storage.getClient(clientId, userId) : null;
      const job = jobId ? await storage.getJob(jobId, userId) : null;
      const quote = quoteId ? await storage.getQuote(quoteId, userId) : null;
      const invoice = invoiceId ? await storage.getInvoice(invoiceId, userId) : null;
      
      // Build merge context
      const { parseSmsTemplate } = await import('./services/smsService');
      const context = {
        business_name: businessSettings?.businessName || '',
        client_name: client?.name || '',
        client_first_name: client?.name?.split(' ')[0] || '',
        job_title: job?.title || '',
        job_address: job?.address || '',
        scheduled_date: job?.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '',
        scheduled_time: job?.scheduledTime || (job?.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''),
        quote_amount: quote?.total ? `$${parseFloat(quote.total).toFixed(2)}` : '',
        invoice_amount: invoice?.total ? `$${parseFloat(invoice.total).toFixed(2)}` : '',
        invoice_due_date: invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '',
        booking_link: '', // Could be generated if booking links feature is implemented
        tracking_link: '', // Could be generated if tracking links feature is implemented
      };
      
      // Parse the template
      const parsedMessage = parseSmsTemplate(template.body, context);
      
      // Increment usage count
      await storage.incrementSmsTemplateUsage(id);
      
      res.json({ 
        template,
        parsedMessage,
        context
      });
    } catch (error: any) {
      console.error('Error applying SMS template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Seed default templates for current user
  app.post("/api/sms/templates/seed-defaults", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Check if user already has templates
      const existingTemplates = await storage.getSmsTemplates(userId);
      if (existingTemplates.length > 0) {
        return res.status(400).json({ error: 'User already has SMS templates' });
      }
      
      const { seedDefaultSmsTemplates } = await import('./services/smsService');
      await seedDefaultSmsTemplates(userId);
      
      const templates = await storage.getSmsTemplates(userId);
      res.status(201).json(templates);
    } catch (error: any) {
      console.error('Error seeding SMS templates:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get SMS conversations for current user
  app.get("/api/sms/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Determine business owner and role
      let businessOwnerId = userId;
      let userRole = 'owner';
      
      const membership = await storage.getTeamMembershipByMemberId(userId);
      if (membership) {
        businessOwnerId = membership.businessOwnerId;
        const role = await storage.getUserRole(membership.roleId);
        userRole = role?.name || 'staff';
      }
      
      const { getSmsConversationsForUser } = await import('./services/smsService');
      const conversations = await getSmsConversationsForUser(userId, businessOwnerId, userRole);
      
      res.json(conversations);
    } catch (error: any) {
      console.error('Error fetching SMS conversations:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get messages for a specific conversation
  app.get("/api/sms/conversations/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getSmsMessages(id);
      res.json(messages);
    } catch (error: any) {
      console.error('Error fetching SMS messages:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get client insights for a conversation (for ServiceM8-style sidebar)
  app.get("/api/sms/conversations/:id/client-insights", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userContext = await getUserContext(req.userId);
      
      // Get the conversation to find clientId
      const conversation = await storage.getSmsConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Verify the conversation belongs to the user's business
      if (conversation.businessOwnerId !== userContext.effectiveUserId) {
        return res.status(403).json({ error: 'Not authorized to access this conversation' });
      }
      
      // If no linked client, return null client with empty arrays
      if (!conversation.clientId) {
        return res.json({
          client: null,
          outstandingInvoices: [],
          recentJobs: [],
          totalOutstanding: 0
        });
      }
      
      // Get client details
      const client = await storage.getClient(conversation.clientId, userContext.effectiveUserId);
      if (!client) {
        return res.json({
          client: null,
          outstandingInvoices: [],
          recentJobs: [],
          totalOutstanding: 0
        });
      }
      
      // Get outstanding invoices (pending, sent, overdue status)
      const allInvoices = await storage.getInvoices(userContext.effectiveUserId);
      const outstandingInvoices = allInvoices
        .filter(inv => 
          inv.clientId === client.id && 
          ['pending', 'sent', 'overdue'].includes(inv.status || '')
        )
        .slice(0, 5)
        .map(inv => ({
          id: inv.id,
          number: inv.number,
          total: inv.total,
          status: inv.status,
          dueDate: inv.dueDate
        }));
      
      // Calculate total outstanding
      const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
        return sum + parseFloat(String(inv.total) || '0');
      }, 0);
      
      // Get recent jobs (last 5)
      const clientJobs = await storage.getJobsForClient(client.id, userContext.effectiveUserId);
      const recentJobs = clientJobs
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5)
        .map(job => ({
          id: job.id,
          title: job.title,
          status: job.status,
          scheduledAt: job.scheduledAt,
          createdAt: job.createdAt
        }));
      
      res.json({
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address
        },
        outstandingInvoices,
        recentJobs,
        totalOutstanding
      });
    } catch (error: any) {
      console.error('Error fetching client insights:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send SMS/MMS to a client
  app.post("/api/sms/send", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { clientId, clientPhone, clientName, jobId, message, mediaUrls } = req.body;
      
      if (!clientPhone || !message) {
        return res.status(400).json({ error: 'Client phone and message are required' });
      }
      
      // Validate mediaUrls if provided
      let validatedMediaUrls: string[] = [];
      if (mediaUrls && Array.isArray(mediaUrls)) {
        // Limit to max 10 media URLs per Twilio MMS
        validatedMediaUrls = mediaUrls.slice(0, 10).filter((url: any) => {
          if (typeof url !== 'string') return false;
          try {
            const urlObj = new URL(url);
            // Allow object storage URLs and common image/file hosting
            const allowedHosts = [
              'storage.googleapis.com',
              'storage.cloud.google.com',
              'replit.dev',
              'repl.co',
              'cdn.replit.com',
              'api.twilio.com', // For media from Twilio
            ];
            const isAllowed = allowedHosts.some(host => urlObj.hostname.includes(host)) || 
                             urlObj.hostname.endsWith('.replit.dev') ||
                             urlObj.hostname.endsWith('.repl.co');
            if (!isAllowed) {
              console.log(`[MMS] Rejected media URL from disallowed host: ${urlObj.hostname}`);
            }
            return isAllowed;
          } catch {
            return false;
          }
        });
      }
      
      // Determine business owner
      let businessOwnerId = userId;
      const membership = await storage.getTeamMembershipByMemberId(userId);
      if (membership) {
        businessOwnerId = membership.businessOwnerId;
      }
      
      const { sendSmsToClient } = await import('./services/smsService');
      const smsMessage = await sendSmsToClient({
        businessOwnerId,
        clientId,
        clientPhone,
        clientName,
        jobId,
        message,
        senderUserId: userId,
        mediaUrls: validatedMediaUrls.length > 0 ? validatedMediaUrls : undefined,
      });
      
      res.json(smsMessage);
    } catch (error: any) {
      console.error('Error sending SMS/MMS:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send quick action SMS
  app.post("/api/sms/quick-action", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { conversationId, actionType, jobTitle, estimatedTime } = req.body;
      
      if (!conversationId || !actionType) {
        return res.status(400).json({ error: 'Conversation ID and action type are required' });
      }
      
      // Get business name for the message
      const user = await storage.getUser(userId);
      const businessSettings = await storage.getBusinessSettings(userId);
      const businessName = businessSettings?.businessName || user?.firstName || 'Your tradie';
      
      const { sendQuickAction } = await import('./services/smsService');
      const smsMessage = await sendQuickAction({
        conversationId,
        senderUserId: userId,
        actionType,
        jobTitle,
        businessName,
        estimatedTime,
      });
      
      res.json(smsMessage);
    } catch (error: any) {
      console.error('Error sending quick action SMS:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Mark conversation as read
  app.post("/api/sms/conversations/:id/read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const { markConversationAsRead } = await import('./services/smsService');
      await markConversationAsRead(id, userId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking conversation as read:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Soft delete conversation
  app.delete("/api/sms/conversations/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const { deleteConversation } = await import('./services/smsService');
      await deleteConversation(id);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting SMS conversation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update SMS conversation (link client)
  app.patch("/api/sms/conversations/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const businessOwnerId = req.businessOwnerId || userId;
      const { id } = req.params;
      const { clientId, clientName } = req.body;
      
      // Verify ownership - conversation must belong to this business
      const conversation = await storage.getSmsConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (conversation.businessOwnerId !== businessOwnerId) {
        return res.status(403).json({ error: 'Unauthorized access to this conversation' });
      }
      
      const updates: { clientId?: string; clientName?: string } = {};
      if (clientId !== undefined) updates.clientId = clientId;
      if (clientName !== undefined) updates.clientName = clientName;
      
      const updated = await storage.updateSmsConversation(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating SMS conversation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create job from SMS message with AI pre-fill and MMS photos
  app.post("/api/sms/messages/:messageId/create-job", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const businessOwnerId = req.businessOwnerId || userId;
      const { messageId } = req.params;
      
      // Get the SMS message
      const message = await storage.getSmsMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Get the conversation for client info
      const conversation = await storage.getSmsConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Get or create client from conversation
      let client = null;
      if (conversation.clientId) {
        client = await storage.getClient(conversation.clientId, businessOwnerId);
      }
      
      if (!client && conversation.clientPhone) {
        // Try to find client by phone number
        const clients = await storage.getClients(businessOwnerId);
        client = clients.find(c => 
          c.phone?.replace(/\s+/g, '').replace(/^0/, '+61') === conversation.clientPhone
        );
        
        // Create client if not found
        if (!client) {
          client = await storage.createClient({
            userId: businessOwnerId,
            name: conversation.clientName || 'New Client from SMS',
            phone: conversation.clientPhone,
            email: null,
            address: null,
            notes: `Created from SMS conversation on ${new Date().toLocaleDateString('en-AU')}`,
          });
          
          // Link client to conversation
          await storage.updateSmsConversation(conversation.id, {
            clientId: client.id,
          });
        }
      }
      
      if (!client) {
        return res.status(400).json({ error: 'Could not find or create client for this conversation' });
      }
      
      // Use AI-suggested title and description from message, or fallback
      const jobTitle = message.suggestedJobTitle || 'New Job from SMS';
      const jobDescription = message.suggestedDescription || message.body;
      
      // Create the job with AI pre-fill
      const job = await storage.createJob({
        userId: businessOwnerId,
        clientId: client.id,
        title: jobTitle,
        description: jobDescription,
        status: 'pending',
        priority: message.intentType === 'quote_request' || message.intentConfidence === 'high' ? 'high' : 'normal',
        notes: `[Created from SMS] Original message from ${conversation.clientName || 'client'}:\n"${message.body}"`,
        isRecurring: false,
        recurringFrequency: null,
        nextRecurringDate: null,
      });
      
      // If message has MMS photos, attach them to the job as photos
      const mediaUrls = message.mediaUrls as string[] || [];
      if (mediaUrls.length > 0) {
        for (const mediaUrl of mediaUrls) {
          try {
            await storage.createJobPhoto({
              jobId: job.id,
              url: mediaUrl,
              caption: 'Photo from client SMS',
              stage: 'before',
              uploadedBy: null, // Client uploaded
            });
          } catch (photoError) {
            console.error('[SMS] Error attaching photo to job:', photoError);
          }
        }
        
        // Update job notes to mention photos
        await storage.updateJob(job.id, businessOwnerId, {
          notes: `[Created from SMS with ${mediaUrls.length} photo(s)] Original message from ${conversation.clientName || 'client'}:\n"${message.body}"`,
        });
      }
      
      // Link conversation to this job
      await storage.updateSmsConversation(conversation.id, {
        jobId: job.id,
      });
      
      // Mark the message as having created a job
      await storage.updateSmsMessage(messageId, {
        jobCreatedFromSms: job.id,
      });
      
      res.status(201).json({
        success: true,
        job,
        client,
        photosAttached: mediaUrls.length,
        message: `Job "${jobTitle}" created successfully from SMS`,
      });
    } catch (error: any) {
      console.error('Error creating job from SMS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get SMS messages that are job requests (for notifications)
  app.get("/api/sms/job-requests", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const businessOwnerId = req.businessOwnerId || userId;
      
      // Get all SMS messages that are job requests and haven't been converted to jobs yet
      const messages = await storage.getSmsJobRequests(businessOwnerId);
      
      res.json(messages);
    } catch (error: any) {
      console.error('Error getting SMS job requests:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Twilio webhook for incoming SMS/MMS
  app.post("/api/sms/webhook/incoming", async (req, res) => {
    try {
      const { From, To, Body, MessageSid, NumMedia } = req.body;
      
      if (!From) {
        return res.status(400).send('Bad request');
      }
      
      // Extract MMS media URLs from Twilio webhook
      // Twilio sends MediaUrl0, MediaUrl1, ..., MediaUrlN for each attachment
      const mediaUrls: string[] = [];
      const numMedia = parseInt(NumMedia || '0', 10);
      
      for (let i = 0; i < numMedia && i < 10; i++) {
        const mediaUrl = req.body[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }
      
      const isMMS = mediaUrls.length > 0;
      if (isMMS) {
        console.log(`[MMS Webhook] Received MMS with ${mediaUrls.length} media attachment(s) from ${From}`);
      }
      
      const { handleIncomingSms } = await import('./services/smsService');
      await handleIncomingSms(From, To, Body || '', MessageSid, mediaUrls.length > 0 ? mediaUrls : undefined);
      
      // Return TwiML response
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error: any) {
      console.error('Error handling incoming SMS/MMS:', error);
      res.status(500).send('Internal error');
    }
  });

  // ===== SMS AUTOMATION ROUTES =====
  
  // Get all automation rules for user
  app.get("/api/sms/automations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const rules = await storage.getSmsAutomationRules(userId);
      res.json(rules);
    } catch (error: any) {
      console.error('Error getting SMS automation rules:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create new automation rule
  app.post("/api/sms/automations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { name, triggerType, delayMinutes, templateId, customMessage, conditions, isActive } = req.body;
      
      if (!name || !triggerType) {
        return res.status(400).json({ error: 'Name and trigger type are required' });
      }
      
      const rule = await storage.createSmsAutomationRule({
        userId,
        name,
        triggerType,
        delayMinutes: delayMinutes || 0,
        templateId: templateId || null,
        customMessage: customMessage || null,
        conditions: conditions || {},
        isActive: isActive !== false,
      });
      
      res.status(201).json(rule);
    } catch (error: any) {
      console.error('Error creating SMS automation rule:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update automation rule
  app.put("/api/sms/automations/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { name, triggerType, delayMinutes, templateId, customMessage, conditions, isActive } = req.body;
      
      const existing = await storage.getSmsAutomationRule(id, userId);
      if (!existing) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }
      
      const rule = await storage.updateSmsAutomationRule(id, userId, {
        name,
        triggerType,
        delayMinutes,
        templateId,
        customMessage,
        conditions,
        isActive,
      });
      
      res.json(rule);
    } catch (error: any) {
      console.error('Error updating SMS automation rule:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete automation rule
  app.delete("/api/sms/automations/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteSmsAutomationRule(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting SMS automation rule:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Toggle automation rule active status
  app.post("/api/sms/automations/:id/toggle", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const existing = await storage.getSmsAutomationRule(id, userId);
      if (!existing) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }
      
      const rule = await storage.updateSmsAutomationRule(id, userId, {
        isActive: !existing.isActive,
      });
      
      res.json(rule);
    } catch (error: any) {
      console.error('Error toggling SMS automation rule:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== SMS BOOKING LINKS ROUTES =====
  
  // Generate booking link for a job
  app.post("/api/jobs/:id/booking-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      const { sendSms, templateId } = req.body;
      
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
      
      const bookingLink = await storage.createSmsBookingLink({
        jobId,
        businessOwnerId: userId,
        token,
        expiresAt,
        clientResponse: null,
        clientNotes: null,
      });
      
      const baseUrl = process.env.REPLIT_DOMAIN 
        ? `https://${process.env.REPLIT_DOMAIN}`
        : process.env.BASE_URL || 'http://localhost:5000';
      
      const bookingUrl = `${baseUrl}/booking/${token}`;
      
      // Send SMS with booking link if requested
      let smsResult = null;
      if (sendSms && job.clientId) {
        const client = await storage.getClient(job.clientId, userId);
        if (client?.phone) {
          const businessSettings = await storage.getBusinessSettings(userId);
          const { sendSmsToClient, parseSmsTemplate } = await import('./services/smsService');
          
          // Get template or use default
          let templateBody = 'Hi {client_name}, your booking with {business_name} is confirmed for {scheduled_date} at {scheduled_time}. Confirm here: {booking_link}';
          if (templateId) {
            const template = await storage.getSmsTemplate(templateId, userId);
            if (template) {
              templateBody = template.body;
            }
          }
          
          // Format scheduled date/time
          const scheduledDate = job.scheduledAt 
            ? new Date(job.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
            : job.scheduledDate || '';
          const scheduledTime = job.scheduledAt
            ? new Date(job.scheduledAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
            : job.scheduledTime || '';
          
          // Parse template with merge fields
          const parsedMessage = parseSmsTemplate(templateBody, {
            client_name: client.name || '',
            client_first_name: client.name?.split(' ')[0] || '',
            job_title: job.title || '',
            job_address: job.address || '',
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            business_name: businessSettings?.businessName || 'Your Tradesperson',
            booking_link: bookingUrl,
          });
          
          try {
            smsResult = await sendSmsToClient({
              businessOwnerId: userId,
              clientId: job.clientId,
              clientPhone: client.phone,
              clientName: client.name || undefined,
              jobId,
              message: parsedMessage,
              senderUserId: userId,
            });
          } catch (smsError: any) {
            console.error('Error sending booking SMS:', smsError);
            smsResult = { error: smsError.message };
          }
        }
      }
      
      res.status(201).json({
        ...bookingLink,
        url: bookingUrl,
        smsResult,
      });
    } catch (error: any) {
      console.error('Error creating booking link:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Rate limiting store for public endpoints (in-memory, simple implementation)
  const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
  const RATE_LIMIT_MAX = 10;
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  
  function checkRateLimit(token: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const key = `token:${token}`;
    const entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    
    if (entry.count >= RATE_LIMIT_MAX) {
      return { allowed: false, remaining: 0 };
    }
    
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
  }
  
  // Public: View booking link page data
  app.get("/api/booking/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Rate limiting check
      const rateLimit = checkRateLimit(token);
      if (!rateLimit.allowed) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
      
      const bookingLink = await storage.getSmsBookingLinkByToken(token);
      if (!bookingLink) {
        return res.status(404).json({ error: 'Booking link not found' });
      }
      
      // Check expiry BEFORE returning any data
      if (new Date() > new Date(bookingLink.expiresAt)) {
        return res.status(410).json({ error: 'Booking link has expired' });
      }
      
      if (bookingLink.status !== 'pending') {
        return res.status(400).json({ 
          error: 'This booking has already been responded to',
          status: bookingLink.status,
        });
      }
      
      const job = await storage.getJobPublic(bookingLink.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const businessSettings = await storage.getBusinessSettings(bookingLink.businessOwnerId);
      
      // Return ONLY what's needed for the booking page - NO PII
      res.json({
        bookingLink: {
          id: bookingLink.id,
          status: bookingLink.status,
          expiresAt: bookingLink.expiresAt,
        },
        job: {
          title: job.title,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          estimatedDuration: job.estimatedDuration,
        },
        business: {
          name: businessSettings?.businessName || 'Your Tradesperson',
        },
      });
    } catch (error: any) {
      console.error('Error viewing booking link:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Public: Client responds to booking
  app.post("/api/booking/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { response, notes } = req.body;
      
      if (!response || !['confirmed', 'reschedule_requested', 'cancelled'].includes(response)) {
        return res.status(400).json({ error: 'Valid response required (confirmed, reschedule_requested, cancelled)' });
      }
      
      const bookingLink = await storage.getSmsBookingLinkByToken(token);
      if (!bookingLink) {
        return res.status(404).json({ error: 'Booking link not found' });
      }
      
      if (new Date() > new Date(bookingLink.expiresAt)) {
        return res.status(410).json({ error: 'Booking link has expired' });
      }
      
      if (bookingLink.status !== 'pending') {
        return res.status(400).json({ error: 'This booking has already been responded to' });
      }
      
      const statusMap: Record<string, string> = {
        'confirmed': 'confirmed',
        'reschedule_requested': 'rescheduled',
        'cancelled': 'cancelled',
      };
      
      const updatedLink = await storage.updateSmsBookingLink(bookingLink.id, {
        status: statusMap[response],
        clientResponse: response,
        clientNotes: notes || null,
        respondedAt: new Date(),
      });
      
      if (response === 'confirmed') {
        const job = await storage.getJobPublic(bookingLink.jobId);
        if (job) {
          await storage.updateJob(job.id, bookingLink.businessOwnerId, { 
            status: 'confirmed' 
          });
        }
      }
      
      res.json({
        success: true,
        message: response === 'confirmed' 
          ? 'Booking confirmed successfully!' 
          : response === 'reschedule_requested' 
            ? 'Reschedule request submitted. We will contact you shortly.'
            : 'Booking cancelled.',
      });
    } catch (error: any) {
      console.error('Error responding to booking:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SMS TRACKING LINKS ROUTES (Live Arrival Tracking) =====
  
  // Generate tracking link for a job (authenticated)
  app.post("/api/jobs/:id/tracking-link", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: jobId } = req.params;
      
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Check if there's already an active tracking link for this job
      const existingLink = await storage.getSmsTrackingLinkByJobId(jobId);
      if (existingLink && existingLink.isActive && new Date(existingLink.expiresAt) > new Date()) {
        const baseUrl = process.env.REPLIT_DOMAIN 
          ? `https://${process.env.REPLIT_DOMAIN}`
          : process.env.BASE_URL || 'http://localhost:5000';
        return res.json({
          ...existingLink,
          url: `${baseUrl}/track/${existingLink.token}`,
        });
      }
      
      // Deactivate any existing links
      if (existingLink) {
        await storage.deactivateSmsTrackingLink(existingLink.id);
      }
      
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
      
      // Get business owner ID (for team scenarios)
      const userContext = await getUserContext(userId);
      
      const trackingLink = await storage.createSmsTrackingLink({
        jobId,
        teamMemberId: userId,
        businessOwnerId: userContext.effectiveUserId,
        token,
        expiresAt,
        estimatedArrival: null,
      });
      
      const baseUrl = process.env.REPLIT_DOMAIN 
        ? `https://${process.env.REPLIT_DOMAIN}`
        : process.env.BASE_URL || 'http://localhost:5000';
      
      res.status(201).json({
        ...trackingLink,
        url: `${baseUrl}/track/${token}`,
      });
    } catch (error: any) {
      console.error('Error creating tracking link:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Public: View tracking page data (no auth required)
  app.get("/api/track/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Rate limiting check
      const rateLimit = checkRateLimit(token);
      if (!rateLimit.allowed) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
      
      const trackingLink = await storage.getSmsTrackingLinkByToken(token);
      if (!trackingLink) {
        return res.status(404).json({ error: 'Tracking link not found' });
      }
      
      // Check expiry BEFORE returning any data
      if (new Date() > new Date(trackingLink.expiresAt)) {
        return res.status(410).json({ error: 'Tracking link has expired' });
      }
      
      if (!trackingLink.isActive) {
        return res.status(410).json({ error: 'Tracking link is no longer active' });
      }
      
      // Increment view count
      await storage.incrementTrackingLinkViews(trackingLink.id);
      
      const job = await storage.getJobPublic(trackingLink.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const businessSettings = await storage.getBusinessSettings(trackingLink.businessOwnerId);
      
      // Get worker FIRST NAME ONLY - no full name for privacy
      let workerFirstName = businessSettings?.businessName || 'Your Tradesperson';
      if (trackingLink.teamMemberId) {
        const worker = await storage.getUser(trackingLink.teamMemberId);
        if (worker?.firstName) {
          workerFirstName = worker.firstName;
        }
      }
      
      // Return ONLY what's needed for tracking - NO full address, NO client data
      res.json({
        id: trackingLink.id,
        isActive: trackingLink.isActive,
        expiresAt: trackingLink.expiresAt,
        lastLocation: trackingLink.lastLocationLat && trackingLink.lastLocationLng 
          ? {
              lat: parseFloat(String(trackingLink.lastLocationLat)),
              lng: parseFloat(String(trackingLink.lastLocationLng)),
              updatedAt: trackingLink.lastLocationAt,
            }
          : null,
        estimatedArrival: trackingLink.estimatedArrival,
        job: {
          title: job.title,
          scheduledTime: job.scheduledTime,
          status: job.status,
        },
        business: {
          name: businessSettings?.businessName || 'Your Tradesperson',
          logoUrl: businessSettings?.logoUrl || null,
        },
        worker: {
          firstName: workerFirstName,
        },
      });
    } catch (error: any) {
      console.error('Error viewing tracking link:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Worker updates their location (authenticated)
  app.post("/api/track/:token/location", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { token } = req.params;
      const { lat, lng, estimatedArrival } = req.body;
      
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({ error: 'lat and lng are required as numbers' });
      }
      
      const trackingLink = await storage.getSmsTrackingLinkByToken(token);
      if (!trackingLink) {
        return res.status(404).json({ error: 'Tracking link not found' });
      }
      
      // Only the assigned worker or business owner can update location
      if (trackingLink.teamMemberId !== userId && trackingLink.businessOwnerId !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this tracking link' });
      }
      
      if (!trackingLink.isActive) {
        return res.status(410).json({ error: 'Tracking link is no longer active' });
      }
      
      if (new Date() > new Date(trackingLink.expiresAt)) {
        return res.status(410).json({ error: 'Tracking link has expired' });
      }
      
      const updatedLink = await storage.updateSmsTrackingLink(trackingLink.id, {
        lastLocationLat: String(lat),
        lastLocationLng: String(lng),
        lastLocationAt: new Date(),
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : trackingLink.estimatedArrival,
      });
      
      res.json({
        success: true,
        lastLocation: {
          lat,
          lng,
          updatedAt: updatedLink.lastLocationAt,
        },
        estimatedArrival: updatedLink.estimatedArrival,
      });
    } catch (error: any) {
      console.error('Error updating tracking location:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Deactivate tracking link (when job is completed)
  app.post("/api/track/:token/deactivate", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { token } = req.params;
      
      const trackingLink = await storage.getSmsTrackingLinkByToken(token);
      if (!trackingLink) {
        return res.status(404).json({ error: 'Tracking link not found' });
      }
      
      // Only the assigned worker or business owner can deactivate
      if (trackingLink.teamMemberId !== userId && trackingLink.businessOwnerId !== userId) {
        return res.status(403).json({ error: 'Not authorized to deactivate this tracking link' });
      }
      
      await storage.deactivateSmsTrackingLink(trackingLink.id);
      
      res.json({ success: true, message: 'Tracking link deactivated' });
    } catch (error: any) {
      console.error('Error deactivating tracking link:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== INVOICE REMINDERS ROUTES =====
  
  // Get reminder logs for invoice
  app.get("/api/invoices/:id/reminders", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const invoiceId = req.params.id;
      
      const logs = await storage.getInvoiceReminderLogs(invoiceId, userId);
      res.json(logs);
    } catch (error: any) {
      console.error('Error getting reminder logs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Send manual reminder for invoice
  app.post("/api/invoices/:id/reminder", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const invoiceId = req.params.id;
      const { tone } = req.body;
      
      const { sendManualReminder } = await import('./reminderService');
      const result = await sendManualReminder(invoiceId, userId, tone || 'friendly');
      
      res.json(result);
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== RECURRING JOBS/INVOICES ROUTES =====
  
  // Process recurring jobs and invoices for current user only
  app.post("/api/recurring/process", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { processRecurringForUser } = await import('./recurringService');
      const results = await processRecurringForUser(userId);
      res.json(results);
    } catch (error: any) {
      console.error('Error processing recurring:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get recurring jobs for user
  app.get("/api/recurring/jobs", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobs = await storage.getJobs(userId);
      const recurringJobs = jobs.filter(j => j.isRecurring);
      res.json(recurringJobs);
    } catch (error: any) {
      console.error('Error getting recurring jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get recurring invoices for user
  app.get("/api/recurring/invoices", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const invoices = await storage.getInvoices(userId);
      const recurringInvoices = invoices.filter(i => i.isRecurring);
      res.json(recurringInvoices);
    } catch (error: any) {
      console.error('Error getting recurring invoices:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create recurring job
  app.post("/api/recurring/jobs", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { createRecurringJob } = await import('./recurringService');
      const job = await createRecurringJob({
        ...req.body,
        userId,
      });
      res.status(201).json(job);
    } catch (error: any) {
      console.error('Error creating recurring job:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create recurring invoice
  app.post("/api/recurring/invoices", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { createRecurringInvoice } = await import('./recurringService');
      const invoice = await createRecurringInvoice({
        ...req.body,
        userId,
      });
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Error creating recurring invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Stop recurring job
  app.post("/api/recurring/jobs/:id/stop", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.id;
      const { stopRecurring } = await import('./recurringService');
      const success = await stopRecurring('job', jobId, userId);
      res.json({ success });
    } catch (error: any) {
      console.error('Error stopping recurring job:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Stop recurring invoice
  app.post("/api/recurring/invoices/:id/stop", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const invoiceId = req.params.id;
      const { stopRecurring } = await import('./recurringService');
      const success = await stopRecurring('invoice', invoiceId, userId);
      res.json({ success });
    } catch (error: any) {
      console.error('Error stopping recurring invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== SUBSCRIPTION & USAGE ROUTES =====
  
  // Get current user's subscription and usage status
  app.get("/api/subscription/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { getUserUsageStatus } = await import('./subscriptionService');
      const status = await getUserUsageStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Start free trial
  app.post("/api/subscription/trial", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { tier } = req.body || {};
      const { startTrial } = await import('./subscriptionService');
      // Pass tier if provided (pro or team), otherwise startTrial uses intendedTier
      const result = await startTrial(userId, tier);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, trialEndsAt: result.endsAt, tier: result.tier });
    } catch (error: any) {
      console.error('Error starting trial:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get tier limits for display
  app.get("/api/subscription/limits", async (_req, res) => {
    const { TIER_LIMITS } = await import('@shared/schema');
    res.json(TIER_LIMITS);
  });

  // ===== BILLING ROUTES (Stripe Subscription Management) =====
  
  // Get billing status for authenticated user
  app.get("/api/billing/status", requireAuth, async (req: any, res) => {
    try {
      const { getSubscriptionStatus } = await import('./billingService');
      const status = await getSubscriptionStatus(req.userId!);
      res.json(status);
    } catch (error: any) {
      console.error('Error getting billing status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe checkout session for subscription
  app.post("/api/billing/checkout", requireAuth, async (req: any, res) => {
    try {
      const { createSubscriptionCheckout, getPublishableKey } = await import('./billingService');
      const user = await storage.getUser(req.userId!);
      
      // Get base URL for success/cancel redirects
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      
      const result = await createSubscriptionCheckout(
        req.userId!,
        user?.email || '',
        `${baseUrl}/settings?tab=billing&success=true`,
        `${baseUrl}/settings?tab=billing&canceled=true`
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const publishableKey = await getPublishableKey();
      res.json({ 
        sessionId: result.sessionId, 
        url: result.sessionUrl,
        publishableKey 
      });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Team subscription checkout (with seats)
  app.post("/api/billing/checkout/team", requireAuth, async (req: any, res) => {
    try {
      const { createTeamSubscriptionCheckout, getPublishableKey } = await import('./billingService');
      const user = await storage.getUser(req.userId!);
      const { seatCount = 0 } = req.body;
      
      // Validate seat count
      const seats = Math.max(0, Math.min(50, parseInt(seatCount) || 0));
      
      // Get base URL for success/cancel redirects
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      
      const result = await createTeamSubscriptionCheckout(
        req.userId!,
        user?.email || '',
        `${baseUrl}/settings?tab=billing&success=true`,
        `${baseUrl}/settings?tab=billing&canceled=true`,
        seats
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      const publishableKey = await getPublishableKey();
      res.json({ 
        sessionId: result.sessionId, 
        url: result.sessionUrl,
        publishableKey 
      });
    } catch (error: any) {
      console.error('Error creating team checkout session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/billing/cancel", requireAuth, async (req: any, res) => {
    try {
      const { cancelSubscription } = await import('./billingService');
      const result = await cancelSubscription(req.userId!);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resume canceled subscription
  app.post("/api/billing/resume", requireAuth, async (req: any, res) => {
    try {
      const { resumeSubscription } = await import('./billingService');
      const result = await resumeSubscription(req.userId!);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create customer portal session for self-service billing management
  app.post("/api/billing/portal", requireAuth, async (req: any, res) => {
    try {
      const { createBillingPortalSession } = await import('./billingService');
      
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const returnUrl = `${protocol}://${host}/settings?tab=billing`;
      
      const result = await createBillingPortalSession(req.userId!, returnUrl);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ url: result.url });
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Stripe publishable key for frontend
  app.get("/api/billing/config", async (_req, res) => {
    try {
      const { getPublishableKey } = await import('./billingService');
      const publishableKey = await getPublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error('Error getting billing config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== REPORTING ROUTES =====
  
  // Get business performance summary
  app.get("/api/reports/summary", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const [jobs, invoices, quotes] = await Promise.all([
        storage.getJobs(userId),
        storage.getInvoices(userId),
        storage.getQuotes(userId),
      ]);
      
      // Filter by date range
      const filteredJobs = jobs.filter(j => {
        const date = j.createdAt ? new Date(j.createdAt) : null;
        return date && date >= start && date <= end;
      });
      
      const filteredInvoices = invoices.filter(i => {
        const date = i.createdAt ? new Date(i.createdAt) : null;
        return date && date >= start && date <= end;
      });
      
      const filteredQuotes = quotes.filter(q => {
        const date = q.createdAt ? new Date(q.createdAt) : null;
        return date && date >= start && date <= end;
      });
      
      // Calculate metrics
      const totalRevenue = filteredInvoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.total || 0), 0);
      
      const pendingRevenue = filteredInvoices
        .filter(i => i.status === 'unpaid' || i.status === 'sent')
        .reduce((sum, i) => sum + Number(i.total || 0), 0);
      
      const overdueRevenue = filteredInvoices
        .filter(i => {
          if (i.status === 'paid') return false;
          return i.dueDate && new Date(i.dueDate) < new Date();
        })
        .reduce((sum, i) => sum + Number(i.total || 0), 0);
      
      const quoteConversionRate = filteredQuotes.length > 0
        ? (filteredQuotes.filter(q => q.status === 'accepted').length / filteredQuotes.length) * 100
        : 0;
      
      const jobsCompleted = filteredJobs.filter(j => j.status === 'done').length;
      const jobsInProgress = filteredJobs.filter(j => j.status === 'in_progress').length;
      
      // GST calculations
      const gstCollected = totalRevenue / 11; // GST is 1/11 of total for 10% GST
      
      res.json({
        period: { start, end },
        revenue: {
          total: totalRevenue,
          pending: pendingRevenue,
          overdue: overdueRevenue,
          gstCollected,
        },
        jobs: {
          total: filteredJobs.length,
          completed: jobsCompleted,
          inProgress: jobsInProgress,
        },
        quotes: {
          total: filteredQuotes.length,
          accepted: filteredQuotes.filter(q => q.status === 'accepted').length,
          pending: filteredQuotes.filter(q => q.status === 'pending').length,
          conversionRate: quoteConversionRate,
        },
        invoices: {
          total: filteredInvoices.length,
          paid: filteredInvoices.filter(i => i.status === 'paid').length,
          unpaid: filteredInvoices.filter(i => i.status === 'unpaid').length,
          overdue: filteredInvoices.filter(i => {
            if (i.status === 'paid') return false;
            return i.dueDate && new Date(i.dueDate) < new Date();
          }).length,
        },
      });
    } catch (error: any) {
      console.error('Error getting report summary:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get monthly revenue breakdown
  app.get("/api/reports/revenue", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { year } = req.query;
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      const invoices = await storage.getInvoices(userId);
      
      // Group by month
      const monthlyRevenue: { [month: number]: { total: number; gst: number; paid: number } } = {};
      
      for (let m = 0; m < 12; m++) {
        monthlyRevenue[m] = { total: 0, gst: 0, paid: 0 };
      }
      
      invoices.forEach(invoice => {
        if (invoice.status !== 'paid') return;
        
        // Use paidAt if available, otherwise fall back to createdAt (consistent with summary)
        const paymentDate = invoice.paidAt ? new Date(invoice.paidAt) : 
                           invoice.createdAt ? new Date(invoice.createdAt) : null;
        
        if (paymentDate && paymentDate.getFullYear() === targetYear) {
          const month = paymentDate.getMonth();
          const amount = Number(invoice.total || 0);
          monthlyRevenue[month].total += amount;
          monthlyRevenue[month].gst += amount / 11;
          monthlyRevenue[month].paid++;
        }
      });
      
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      
      res.json({
        year: targetYear,
        months: months.map((name, index) => ({
          month: name,
          revenue: monthlyRevenue[index].total,
          gst: monthlyRevenue[index].gst,
          invoicesPaid: monthlyRevenue[index].paid,
        })),
        yearTotal: Object.values(monthlyRevenue).reduce((sum, m) => sum + m.total, 0),
        yearGst: Object.values(monthlyRevenue).reduce((sum, m) => sum + m.gst, 0),
      });
    } catch (error: any) {
      console.error('Error getting revenue report:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get top clients report
  app.get("/api/reports/clients", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { limit } = req.query;
      
      const [clients, invoices, jobs] = await Promise.all([
        storage.getClients(userId),
        storage.getInvoices(userId),
        storage.getJobs(userId),
      ]);
      
      const clientMetrics = clients.map(client => {
        const clientInvoices = invoices.filter(i => i.clientId === client.id);
        const clientJobs = jobs.filter(j => j.clientId === client.id);
        
        const totalRevenue = clientInvoices
          .filter(i => i.status === 'paid')
          .reduce((sum, i) => sum + Number(i.total || 0), 0);
        
        const outstandingBalance = clientInvoices
          .filter(i => i.status !== 'paid')
          .reduce((sum, i) => sum + Number(i.total || 0), 0);
        
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          totalRevenue,
          outstandingBalance,
          jobsCompleted: clientJobs.filter(j => j.status === 'done').length,
          invoicesPaid: clientInvoices.filter(i => i.status === 'paid').length,
          invoicesOutstanding: clientInvoices.filter(i => i.status !== 'paid').length,
        };
      });
      
      // Sort by revenue
      clientMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      const topClients = limit ? clientMetrics.slice(0, parseInt(limit as string)) : clientMetrics;
      
      res.json({
        clients: topClients,
        totals: {
          totalRevenue: clientMetrics.reduce((sum, c) => sum + c.totalRevenue, 0),
          totalOutstanding: clientMetrics.reduce((sum, c) => sum + c.outstandingBalance, 0),
        },
      });
    } catch (error: any) {
      console.error('Error getting client report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get team performance report (Owner/Admin only)
  app.get("/api/reports/team", requireAuth, createPermissionMiddleware(PERMISSIONS.VIEW_TEAM), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Get team members and their activity
      const [teamMembers, allJobs, timeEntries] = await Promise.all([
        storage.getTeamMembers(userId),
        storage.getJobs(userId),
        storage.getTimeEntries(userId),
      ]);
      
      // Filter by date range
      const filteredJobs = allJobs.filter(j => {
        const date = j.createdAt ? new Date(j.createdAt) : null;
        return date && date >= start && date <= end;
      });
      
      const filteredTimeEntries = timeEntries.filter(t => {
        const date = t.startTime ? new Date(t.startTime) : null;
        return date && date >= start && date <= end;
      });
      
      // Calculate per-member performance
      const memberPerformance = await Promise.all(teamMembers.map(async member => {
        const memberJobs = filteredJobs.filter(j => j.assignedTo === member.userId);
        const memberTimeEntries = filteredTimeEntries.filter(t => t.userId === member.userId);
        
        // Calculate total hours worked
        const totalMinutes = memberTimeEntries.reduce((sum, entry) => {
          if (!entry.startTime) return sum;
          const start = new Date(entry.startTime);
          const end = entry.endTime ? new Date(entry.endTime) : new Date();
          return sum + (end.getTime() - start.getTime()) / 60000;
        }, 0);
        
        const hoursWorked = Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal
        
        return {
          id: member.userId,
          name: member.name || member.email,
          email: member.email,
          role: member.role,
          jobsAssigned: memberJobs.length,
          jobsCompleted: memberJobs.filter(j => j.status === 'done' || j.status === 'invoiced').length,
          jobsInProgress: memberJobs.filter(j => j.status === 'in_progress').length,
          hoursWorked,
          timeEntryCount: memberTimeEntries.length,
          avgHoursPerJob: memberJobs.length > 0 ? Math.round(hoursWorked / memberJobs.length * 10) / 10 : 0,
        };
      }));
      
      // Sort by jobs completed
      memberPerformance.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
      
      // Calculate totals
      const totals = {
        totalMembers: memberPerformance.length,
        totalJobsAssigned: memberPerformance.reduce((sum, m) => sum + m.jobsAssigned, 0),
        totalJobsCompleted: memberPerformance.reduce((sum, m) => sum + m.jobsCompleted, 0),
        totalHoursWorked: Math.round(memberPerformance.reduce((sum, m) => sum + m.hoursWorked, 0) * 10) / 10,
        avgJobsPerMember: memberPerformance.length > 0 
          ? Math.round(memberPerformance.reduce((sum, m) => sum + m.jobsAssigned, 0) / memberPerformance.length * 10) / 10 
          : 0,
      };
      
      res.json({
        period: { start, end },
        members: memberPerformance,
        totals,
      });
    } catch (error: any) {
      console.error('Error getting team report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Stripe payment history - actual payments processed through Stripe Connect
  app.get("/api/reports/stripe-payments", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { startDate, endDate } = req.query;
      const stripe = await getUncachableStripeClient();
      
      if (!stripe) {
        return res.json({ 
          available: false, 
          message: 'Stripe not configured',
          payments: [],
          balance: null,
          payouts: []
        });
      }
      
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.json({ 
          available: false, 
          message: 'Stripe Connect not set up',
          payments: [],
          balance: null,
          payouts: []
        });
      }
      
      const accountId = settings.stripeConnectAccountId;
      
      // Fetch balance for the Connect account
      let balance = null;
      try {
        const stripeBalance = await stripe.balance.retrieve({
          stripeAccount: accountId,
        });
        balance = {
          available: stripeBalance.available.reduce((sum, b) => sum + b.amount, 0) / 100,
          pending: stripeBalance.pending.reduce((sum, b) => sum + b.amount, 0) / 100,
          currency: 'AUD',
        };
      } catch (balanceError) {
        console.error('Error fetching balance:', balanceError);
      }
      
      // Fetch charges for the Connect account
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      let payments: any[] = [];
      try {
        const charges = await stripe.charges.list({
          created: {
            gte: Math.floor(start.getTime() / 1000),
            lte: Math.floor(end.getTime() / 1000),
          },
          limit: 100,
        }, {
          stripeAccount: accountId,
        });
        
        payments = charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount / 100,
          fee: (charge.application_fee_amount || 0) / 100,
          net: (charge.amount - (charge.application_fee_amount || 0)) / 100,
          status: charge.status,
          paid: charge.paid,
          refunded: charge.refunded,
          description: charge.description || 'Payment',
          customer: charge.billing_details?.name || charge.billing_details?.email || null,
          paymentMethod: charge.payment_method_details?.type || 'card',
          created: new Date(charge.created * 1000).toISOString(),
          receiptUrl: charge.receipt_url,
        }));
      } catch (chargesError) {
        console.error('Error fetching charges:', chargesError);
      }
      
      // Fetch recent payouts
      let payouts: any[] = [];
      try {
        const stripePayouts = await stripe.payouts.list({
          limit: 10,
        }, {
          stripeAccount: accountId,
        });
        
        payouts = stripePayouts.data.map(payout => ({
          id: payout.id,
          amount: payout.amount / 100,
          status: payout.status,
          arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
          created: new Date(payout.created * 1000).toISOString(),
          method: payout.method,
          destination: payout.destination ? `****${String(payout.destination).slice(-4)}` : null,
        }));
      } catch (payoutsError) {
        console.error('Error fetching payouts:', payoutsError);
      }
      
      // Calculate totals
      const successfulPayments = payments.filter(p => p.paid && !p.refunded);
      const totals = {
        totalRevenue: successfulPayments.reduce((sum, p) => sum + p.amount, 0),
        totalFees: successfulPayments.reduce((sum, p) => sum + p.fee, 0),
        totalNet: successfulPayments.reduce((sum, p) => sum + p.net, 0),
        paymentCount: successfulPayments.length,
        refundedAmount: payments.filter(p => p.refunded).reduce((sum, p) => sum + p.amount, 0),
      };
      
      res.json({
        available: true,
        accountId,
        balance,
        payments,
        payouts,
        totals,
        period: { start: start.toISOString(), end: end.toISOString() },
      });
    } catch (error: any) {
      console.error('Error getting Stripe payments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // AUTOMATIONS
  // ============================================

  // Get all automations
  app.get("/api/automations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const automations = await storage.getAutomations(userId);
      res.json(automations);
    } catch (error: any) {
      console.error('Error fetching automations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create automation
  app.post("/api/automations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { name, description, isActive, trigger, actions } = req.body;
      
      // Basic validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!trigger || typeof trigger !== 'object') {
        return res.status(400).json({ error: 'Trigger configuration is required' });
      }
      if (!trigger.type || !trigger.entityType) {
        return res.status(400).json({ error: 'Trigger type and entityType are required' });
      }
      
      const automation = await storage.createAutomation({
        userId,
        name,
        description: description || null,
        isActive: isActive ?? true,
        trigger,
        actions: Array.isArray(actions) ? actions : [],
      });
      
      res.json(automation);
    } catch (error: any) {
      console.error('Error creating automation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update automation
  app.patch("/api/automations/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const automation = await storage.updateAutomation(id, userId, req.body);
      
      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }
      
      res.json(automation);
    } catch (error: any) {
      console.error('Error updating automation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete automation
  app.delete("/api/automations/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteAutomation(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Automation not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting automation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get automation execution history/logs
  app.get("/api/automations/history", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const logs = await storage.getAutomationLogs(userId, limit);
      
      // Enrich logs with automation names
      const automations = await storage.getAutomations(userId);
      const automationMap = new Map(automations.map(a => [a.id, a]));
      
      const enrichedLogs = logs.map(log => ({
        ...log,
        automationName: automationMap.get(log.automationId)?.name || 'Unknown Automation',
      }));
      
      res.json(enrichedLogs);
    } catch (error: any) {
      console.error('Error fetching automation history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manually trigger time-based automation processing (for testing)
  app.post("/api/automations/process-time-based", requireAuth, async (req: any, res) => {
    try {
      const result = await processTimeBasedAutomations();
      res.json({
        message: 'Time-based automations processed',
        processed: result.processed,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('Error processing time-based automations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // AUTOMATION TEMPLATES (Pre-built workflows)
  // ============================================

  // Get all automation templates
  app.get("/api/automation-templates", requireAuth, async (req: any, res) => {
    try {
      const { getAllTemplates, getPopularTemplates, getTemplatesByCategory } = await import('./automationTemplates');
      
      const category = req.query.category as string | undefined;
      const popularOnly = req.query.popular === 'true';
      
      let templates;
      if (popularOnly) {
        templates = getPopularTemplates();
      } else if (category) {
        templates = getTemplatesByCategory(category);
      } else {
        templates = getAllTemplates();
      }
      
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching automation templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific template by ID
  app.get("/api/automation-templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { getTemplateById } = await import('./automationTemplates');
      const { id } = req.params;
      
      const template = getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching automation template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Enable a template (create automation from template)
  app.post("/api/automation-templates/:id/enable", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const { getTemplateById, templateToAutomation } = await import('./automationTemplates');
      const template = getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Check if user already has this automation
      const existingAutomations = await storage.getAutomations(userId);
      const alreadyExists = existingAutomations.some((a: any) => a.name === template.name);
      
      if (alreadyExists) {
        return res.status(400).json({ error: 'You already have this automation enabled' });
      }
      
      // Create automation from template
      const automationData = templateToAutomation(template, userId);
      const automation = await storage.createAutomation(automationData);
      
      res.json({
        success: true,
        message: `Automation "${template.name}" enabled successfully`,
        automation,
      });
    } catch (error: any) {
      console.error('Error enabling automation template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // CUSTOM FORMS
  // ============================================

  // Get all pre-built safety form templates (SWMS, JSA, etc.)
  app.get("/api/safety-form-templates", requireAuth, async (req: any, res) => {
    try {
      const templates = getSafetyFormTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching safety form templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific safety form template
  app.get("/api/safety-form-templates/:key", requireAuth, async (req: any, res) => {
    try {
      const { key } = req.params;
      const template = getSafetyFormTemplate(key as any);
      
      if (!template) {
        return res.status(404).json({ error: 'Safety form template not found' });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching safety form template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create custom form from safety template
  app.post("/api/safety-form-templates/:key/create", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { key } = req.params;
      const template = getSafetyFormTemplate(key as any);
      
      if (!template) {
        return res.status(404).json({ error: 'Safety form template not found' });
      }
      
      // Create a custom form based on the template
      const form = await storage.createCustomForm({
        userId,
        name: template.name,
        description: template.description,
        formType: template.formType,
        fields: template.fields,
        settings: template.settings,
        requiresSignature: template.requiresSignature,
        isActive: true,
      });
      
      res.status(201).json(form);
    } catch (error: any) {
      console.error('Error creating form from template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all custom forms for user
  app.get("/api/custom-forms", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const forms = await storage.getCustomForms(userId);
      res.json(forms);
    } catch (error: any) {
      console.error('Error fetching custom forms:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single custom form
  app.get("/api/custom-forms/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const form = await storage.getCustomForm(id, userId);
      
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      res.json(form);
    } catch (error: any) {
      console.error('Error fetching custom form:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create custom form
  app.post("/api/custom-forms", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const form = await storage.createCustomForm({
        ...req.body,
        userId,
      });
      
      res.status(201).json(form);
    } catch (error: any) {
      console.error('Error creating custom form:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update custom form
  app.patch("/api/custom-forms/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const form = await storage.updateCustomForm(id, userId, req.body);
      
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      res.json(form);
    } catch (error: any) {
      console.error('Error updating custom form:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete custom form
  app.delete("/api/custom-forms/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteCustomForm(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting custom form:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // FORM SUBMISSIONS
  // ============================================

  // Get all submissions for a form
  app.get("/api/custom-forms/:formId/submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { formId } = req.params;
      
      const submissions = await storage.getFormSubmissions(formId, userId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching form submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get submissions for a job
  app.get("/api/jobs/:jobId/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const submissions = await storage.getFormSubmissionsByJob(jobId, userId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching job form submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create form submission for a specific job (checklist)
  app.post("/api/jobs/:jobId/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      const submission = await storage.createFormSubmission({
        ...req.body,
        jobId,
        submittedBy: userId,
        submittedAt: new Date(),
      });
      
      res.status(201).json(submission);
    } catch (error: any) {
      console.error('Error creating job form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single form submission
  app.get("/api/form-submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const submission = await storage.getFormSubmission(id, userId);
      
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error('Error fetching form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create form submission
  app.post("/api/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const submission = await storage.createFormSubmission({
        ...req.body,
        submittedBy: userId,
        submittedAt: new Date(),
      });
      
      res.status(201).json(submission);
    } catch (error: any) {
      console.error('Error creating form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update form submission (for review status)
  app.patch("/api/form-submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const updates: any = { ...req.body };
      
      if (updates.reviewStatus === 'approved' || updates.reviewStatus === 'rejected') {
        updates.reviewedBy = userId;
        updates.reviewedAt = new Date();
      }
      
      const submission = await storage.updateFormSubmission(id, userId, updates);
      
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error('Error updating form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete form submission
  app.delete("/api/form-submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteFormSubmission(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting form submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // ADMIN DASHBOARD ROUTES (Super Admin Only)
  // ============================================
  
  // Admin middleware - requires isPlatformAdmin flag to be true
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const user = await storage.getUser(userId);
      // Only isPlatformAdmin flag grants admin access - no email fallbacks
      const isAdmin = user?.isPlatformAdmin === true || (user as any)?.is_platform_admin === true;
      if (!user || !isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }
      
      next();
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
  
  // Get admin stats - KPIs, user growth, feature usage
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // Get all users
      const allUsers = await db.select().from(users);
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Total users
      const totalUsers = allUsers.length;
      
      // Active users (updated in last 7 days)
      const activeUsers = allUsers.filter(u => {
        const updatedAt = u.updatedAt ? new Date(u.updatedAt) : null;
        return updatedAt && updatedAt >= sevenDaysAgo;
      }).length;
      
      // Onboarding completion rate (users with business settings)
      const allBusinessSettings = await db.select().from(businessSettings);
      const usersWithOnboarding = allBusinessSettings.length;
      const onboardingCompletionRate = totalUsers > 0 
        ? Math.round((usersWithOnboarding / totalUsers) * 100) 
        : 0;
      
      // User growth data - signups per month for last 12 months
      const growthData: { month: string; signups: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthLabel = monthStart.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
        
        const signups = allUsers.filter(u => {
          const createdAt = u.createdAt ? new Date(u.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).length;
        
        growthData.push({ month: monthLabel, signups });
      }
      
      // Feature usage stats across all users
      const allJobs = await db.select().from(jobs);
      const allInvoices = await db.select().from(invoices);
      const allQuotes = await db.select().from(quotes);
      const allClients = await db.select().from(clients);
      
      const featureUsage = {
        totalJobs: allJobs.length,
        totalInvoices: allInvoices.length,
        totalQuotes: allQuotes.length,
        totalClients: allClients.length,
        completedJobs: allJobs.filter(j => j.status === 'done').length,
        paidInvoices: allInvoices.filter(i => i.status === 'paid').length,
        acceptedQuotes: allQuotes.filter(q => q.status === 'accepted').length,
      };
      
      // Subscription tier breakdown
      const tierBreakdown = {
        free: allUsers.filter(u => u.subscriptionTier === 'free' || !u.subscriptionTier).length,
        pro: allUsers.filter(u => u.subscriptionTier === 'pro').length,
        trial: allUsers.filter(u => u.subscriptionTier === 'trial').length,
      };
      
      res.json({
        kpis: {
          totalUsers,
          activeUsers,
          onboardingCompletionRate,
        },
        growthData,
        featureUsage,
        tierBreakdown,
      });
    } catch (error: any) {
      console.error('Error getting admin stats:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all users for admin
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // Get all users with basic info (exclude sensitive fields)
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
        tradeType: users.tradeType,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
      }).from(users).orderBy(desc(users.createdAt));
      
      // Get business settings to check onboarding completion
      const allBusinessSettings = await db.select({
        userId: businessSettings.userId,
        businessName: businessSettings.businessName,
      }).from(businessSettings);
      
      const businessSettingsMap = new Map(allBusinessSettings.map(bs => [bs.userId, bs]));
      
      // Enrich user data
      const enrichedUsers = allUsers.map(user => ({
        ...user,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown',
        hasCompletedOnboarding: businessSettingsMap.has(user.id),
        businessName: businessSettingsMap.get(user.id)?.businessName || null,
      }));
      
      res.json({ users: enrichedUsers });
    } catch (error: any) {
      console.error('Error getting admin users:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get system health status for admin
  app.get("/api/admin/health", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const startTime = Date.now();
      
      // Check database connectivity and latency
      let dbStatus = 'healthy';
      let dbLatency = 0;
      try {
        const dbStart = Date.now();
        await db.select().from(users).limit(1);
        dbLatency = Date.now() - dbStart;
        if (dbLatency > 1000) dbStatus = 'degraded';
      } catch (error) {
        dbStatus = 'down';
        dbLatency = -1;
      }
      
      // API latency is just this request's processing time
      const apiLatency = Date.now() - startTime;
      
      // Get some basic stats
      const totalUsers = await db.select().from(users).then(r => r.length);
      const totalJobs = await db.select().from(jobs).then(r => r.length);
      
      res.json({
        api: { 
          status: 'healthy', 
          latency: apiLatency,
          avgResponseTime: apiLatency, 
        },
        database: { 
          status: dbStatus, 
          latency: dbLatency,
          connections: 1, // Neon serverless uses connection pooling
        },
        backgroundJobs: { 
          status: 'healthy', 
          pending: 0,
        },
        storage: { 
          status: 'healthy', 
          used: 'N/A',
        },
        metrics: {
          totalUsers,
          totalJobs,
          errorRate: 0,
          activeSessions: 1,
        }
      });
    } catch (error: any) {
      console.error('Error getting admin health:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin delete user - for testing purposes
  app.delete("/api/admin/users/:userId", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userIdToDelete = req.params.userId;
      const adminUserId = req.userId;
      
      // Prevent admin from deleting themselves
      if (userIdToDelete === adminUserId) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
      }
      
      // Check if user exists
      const userToDelete = await storage.getUser(userIdToDelete);
      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Prevent deleting other platform admins
      if (userToDelete.isPlatformAdmin) {
        return res.status(403).json({ error: 'Cannot delete platform admin accounts' });
      }
      
      // Prevent deleting the demo user
      if (userToDelete.email === 'demo@tradietrack.com.au') {
        return res.status(403).json({ error: 'Cannot delete the demo account' });
      }
      
      // Delete team memberships first (these reference userId)
      await db.delete(teamMembers).where(eq(teamMembers.userId, userIdToDelete)).catch(() => {});
      
      // Delete the user - PostgreSQL CASCADE will handle related data automatically
      // All foreign keys in the schema use onDelete: 'cascade'
      await db.delete(users).where(eq(users.id, userIdToDelete));
      
      console.log(`Admin ${adminUserId} deleted user ${userIdToDelete} (${userToDelete.email})`);
      
      res.json({ success: true, message: `User ${userToDelete.email} deleted successfully` });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // ============================================
  // ACCOUNT DELETION (Apple App Store Compliance)
  // ============================================
  
  // Delete user account - Apple requires this to be accessible within 2 taps
  app.delete("/api/account", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Prevent demo account deletion
      if (user.email === 'demo@tradietrack.com.au') {
        return res.status(403).json({ 
          error: 'Demo account cannot be deleted. Create your own account to test this feature.' 
        });
      }
      
      console.log(`[Account Deletion] Starting deletion for user ${userId} (${user.email})`);
      
      // Delete all user data and soft-delete the account
      const result = await storage.deleteUserAccount(userId);
      
      if (!result.success) {
        console.error(`[Account Deletion] Failed for user ${userId}`);
        return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
      }
      
      console.log(`[Account Deletion] Successfully deleted user ${userId}. Counts:`, result.deletedCounts);
      
      // Destroy the session
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) console.error('Error destroying session:', err);
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Your account and all associated data have been permanently deleted.',
        deletedCounts: result.deletedCounts
      });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
  });

  // ============================================
  // TEAM PRESENCE ROUTES
  // ============================================

  // Get all team member presence for current user's business
  app.get("/api/team/presence", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Get team membership to find business owner
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      // Get all team members for this business
      const teamMembers = await storage.getTeamMembers(businessOwnerId);
      
      // Always include the business owner, plus all team members (deduplicated)
      const memberIds = new Set<string>([businessOwnerId]);
      teamMembers.forEach(m => {
        if (m.memberId) memberIds.add(m.memberId);
      });
      const allMemberIds = Array.from(memberIds);
      
      // Build presence data from tradieStatus (same source as map) and locationTracking
      const presenceWithUserInfo = await Promise.all(
        allMemberIds.map(async (memberId) => {
          const user = await storage.getUser(memberId);
          if (!user) return null;
          
          // Get tradie status (this is what the map uses)
          const tradieStatus = await storage.getTradieStatus(memberId);
          // Get latest location as fallback
          const latestLocation = await storage.getLatestLocationForUser(memberId);
          // Get traditional presence record
          const presence = await storage.getPresenceByUserId(memberId);
          
          // Derive activity status from tradieStatus (matches map logic)
          let activityStatus = 'offline';
          const lastActivity = tradieStatus?.lastSeenAt || latestLocation?.timestamp;
          if (lastActivity) {
            const minutesSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60);
            if (minutesSinceActivity < 15) {
              activityStatus = tradieStatus?.activityStatus || 'online';
            } else if (minutesSinceActivity < 60) {
              activityStatus = 'idle';
            }
          }
          
          return {
            id: presence?.id || memberId,
            userId: memberId,
            businessOwnerId,
            status: activityStatus,
            statusMessage: tradieStatus?.statusMessage || presence?.statusMessage || null,
            currentJobId: tradieStatus?.currentJobId || presence?.currentJobId || null,
            lastLocationLat: tradieStatus?.currentLatitude || (latestLocation?.latitude ? parseFloat(latestLocation.latitude) : null),
            lastLocationLng: tradieStatus?.currentLongitude || (latestLocation?.longitude ? parseFloat(latestLocation.longitude) : null),
            lastLocationUpdatedAt: tradieStatus?.lastSeenAt || latestLocation?.timestamp || null,
            lastSeenAt: tradieStatus?.lastSeenAt || presence?.lastSeenAt || null,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              profileImageUrl: user.profileImageUrl,
              themeColor: user.themeColor,
            },
          };
        })
      );
      
      res.json(presenceWithUserInfo.filter(Boolean));
    } catch (error: any) {
      console.error('Error getting team presence:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update current user's presence status
  app.patch("/api/team/presence", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { status, statusMessage, currentJobId, lat, lng } = req.body;
      
      // Validate status
      const validStatuses = ['online', 'offline', 'busy', 'on_job', 'break'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
      }
      
      // Get team membership to find business owner
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (statusMessage !== undefined) updateData.statusMessage = statusMessage;
      if (currentJobId !== undefined) updateData.currentJobId = currentJobId;
      if (lat !== undefined) updateData.lastLocationLat = lat;
      if (lng !== undefined) updateData.lastLocationLng = lng;
      if (lat !== undefined || lng !== undefined) {
        updateData.lastLocationUpdatedAt = new Date();
      }
      
      const presence = await storage.updatePresence(userId, businessOwnerId, updateData);
      res.json(presence);
    } catch (error: any) {
      console.error('Error updating presence:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Heartbeat to keep user online
  app.post("/api/team/presence/heartbeat", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { lat, lng } = req.body;
      
      // Get team membership to find business owner
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const updateData: any = {
        status: 'online',
      };
      
      if (lat !== undefined) updateData.lastLocationLat = lat;
      if (lng !== undefined) updateData.lastLocationLng = lng;
      if (lat !== undefined || lng !== undefined) {
        updateData.lastLocationUpdatedAt = new Date();
      }
      
      const presence = await storage.updatePresence(userId, businessOwnerId, updateData);
      res.json({ success: true, lastSeenAt: presence.lastSeenAt });
    } catch (error: any) {
      console.error('Error updating heartbeat:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TEAM MEMBER SKILLS ROUTES
  // ============================================

  // Helper to verify team member belongs to current user's business
  async function verifyTeamMemberOwnership(userId: string, teamMemberId: string): Promise<boolean> {
    const teamMembership = await storage.getTeamMembershipByMemberId(userId);
    const businessOwnerId = teamMembership?.ownerId || userId;
    
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.id, teamMemberId),
        eq(teamMembers.businessOwnerId, businessOwnerId)
      ));
    
    return !!member;
  }

  // Get all skills for the team
  app.get("/api/team/skills", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const skills = await db.select().from(teamMemberSkills)
        .innerJoin(teamMembers, eq(teamMemberSkills.teamMemberId, teamMembers.id))
        .where(eq(teamMembers.businessOwnerId, businessOwnerId));
      
      res.json(skills.map(s => s.team_member_skills));
    } catch (error: any) {
      console.error('Error getting team skills:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add a skill for a team member (owner/manager only)
  app.post("/api/team/skills", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { teamMemberId, skillName, skillType, licenseNumber, issueDate, expiryDate, notes } = req.body;
      
      if (!teamMemberId || !skillName) {
        return res.status(400).json({ error: 'teamMemberId and skillName are required' });
      }
      
      // Verify team member belongs to this business
      const isOwned = await verifyTeamMemberOwnership(userId, teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Team member does not belong to your business' });
      }
      
      const [skill] = await db.insert(teamMemberSkills).values({
        teamMemberId,
        skillName,
        skillType: skillType || 'certification',
        licenseNumber: licenseNumber || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        isVerified: false,
      }).returning();
      
      res.status(201).json(skill);
    } catch (error: any) {
      console.error('Error adding team skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a skill (owner/manager only)
  app.patch("/api/team/skills/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { isVerified, skillName, licenseNumber, issueDate, expiryDate, notes } = req.body;
      
      // Verify the skill belongs to a team member in this business
      const [existingSkill] = await db.select().from(teamMemberSkills)
        .where(eq(teamMemberSkills.id, id));
      
      if (!existingSkill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      
      const isOwned = await verifyTeamMemberOwnership(userId, existingSkill.teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Skill does not belong to your business' });
      }
      
      const updateData: any = { updatedAt: new Date() };
      if (isVerified !== undefined) updateData.isVerified = isVerified;
      if (skillName !== undefined) updateData.skillName = skillName;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (issueDate !== undefined) updateData.issueDate = issueDate ? new Date(issueDate) : null;
      if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
      if (notes !== undefined) updateData.notes = notes;
      
      const [skill] = await db.update(teamMemberSkills)
        .set(updateData)
        .where(eq(teamMemberSkills.id, id))
        .returning();
      
      res.json(skill);
    } catch (error: any) {
      console.error('Error updating team skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a skill (owner/manager only)
  app.delete("/api/team/skills/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Verify the skill belongs to a team member in this business
      const [existingSkill] = await db.select().from(teamMemberSkills)
        .where(eq(teamMemberSkills.id, id));
      
      if (!existingSkill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      
      const isOwned = await verifyTeamMemberOwnership(userId, existingSkill.teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Skill does not belong to your business' });
      }
      
      await db.delete(teamMemberSkills).where(eq(teamMemberSkills.id, id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting team skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TEAM MEMBER AVAILABILITY ROUTES
  // ============================================

  // Get availability for a team member
  app.get("/api/team/availability", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const teamMemberId = req.query.teamMemberId as string;
      
      if (!teamMemberId) {
        return res.json([]);
      }
      
      // Verify team member belongs to this business
      const isOwned = await verifyTeamMemberOwnership(userId, teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Team member does not belong to your business' });
      }
      
      const availability = await db.select().from(teamMemberAvailability)
        .where(eq(teamMemberAvailability.teamMemberId, teamMemberId));
      
      res.json(availability);
    } catch (error: any) {
      console.error('Error getting availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set or update availability for a day (owner/manager only)
  app.post("/api/team/availability", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { teamMemberId, dayOfWeek, isAvailable, startTime, endTime, notes } = req.body;
      
      if (!teamMemberId || dayOfWeek === undefined) {
        return res.status(400).json({ error: 'teamMemberId and dayOfWeek are required' });
      }
      
      // Verify team member belongs to this business
      const isOwned = await verifyTeamMemberOwnership(userId, teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Team member does not belong to your business' });
      }
      
      // Check if record exists
      const existing = await db.select().from(teamMemberAvailability)
        .where(and(
          eq(teamMemberAvailability.teamMemberId, teamMemberId),
          eq(teamMemberAvailability.dayOfWeek, dayOfWeek)
        ));
      
      let result;
      if (existing.length > 0) {
        [result] = await db.update(teamMemberAvailability)
          .set({
            isAvailable: isAvailable !== undefined ? isAvailable : existing[0].isAvailable,
            startTime: startTime || existing[0].startTime,
            endTime: endTime || existing[0].endTime,
            notes: notes !== undefined ? notes : existing[0].notes,
            updatedAt: new Date(),
          })
          .where(eq(teamMemberAvailability.id, existing[0].id))
          .returning();
      } else {
        [result] = await db.insert(teamMemberAvailability).values({
          teamMemberId,
          dayOfWeek,
          isAvailable: isAvailable !== undefined ? isAvailable : true,
          startTime: startTime || '08:00',
          endTime: endTime || '17:00',
          notes: notes || null,
        }).returning();
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error setting availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TEAM MEMBER TIME OFF ROUTES
  // ============================================

  // Get all time off requests
  app.get("/api/team/time-off", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const timeOff = await db.select().from(teamMemberTimeOff)
        .innerJoin(teamMembers, eq(teamMemberTimeOff.teamMemberId, teamMembers.id))
        .where(eq(teamMembers.businessOwnerId, businessOwnerId))
        .orderBy(desc(teamMemberTimeOff.startDate));
      
      res.json(timeOff.map(t => t.team_member_time_off));
    } catch (error: any) {
      console.error('Error getting time off:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Request time off (owner/manager only for now - staff could self-request in future)
  app.post("/api/team/time-off", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { teamMemberId, startDate, endDate, reason, notes } = req.body;
      
      if (!teamMemberId || !startDate || !endDate || !reason) {
        return res.status(400).json({ error: 'teamMemberId, startDate, endDate, and reason are required' });
      }
      
      // Verify team member belongs to this business
      const isOwned = await verifyTeamMemberOwnership(userId, teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Team member does not belong to your business' });
      }
      
      const [timeOff] = await db.insert(teamMemberTimeOff).values({
        teamMemberId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        notes: notes || null,
        status: 'pending',
      }).returning();
      
      res.status(201).json(timeOff);
    } catch (error: any) {
      console.error('Error requesting time off:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve or reject time off (owner/manager only)
  app.patch("/api/team/time-off/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or rejected' });
      }
      
      // Verify the time off request belongs to this business
      const [existingTimeOff] = await db.select().from(teamMemberTimeOff)
        .where(eq(teamMemberTimeOff.id, id));
      
      if (!existingTimeOff) {
        return res.status(404).json({ error: 'Time off request not found' });
      }
      
      const isOwned = await verifyTeamMemberOwnership(userId, existingTimeOff.teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Time off request does not belong to your business' });
      }
      
      const [timeOff] = await db.update(teamMemberTimeOff)
        .set({
          status,
          approvedBy: userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(teamMemberTimeOff.id, id))
        .returning();
      
      res.json(timeOff);
    } catch (error: any) {
      console.error('Error updating time off:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete time off request (owner/manager only)
  app.delete("/api/team/time-off/:id", requireAuth, ownerOrManagerOnly(), async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Verify the time off request belongs to this business
      const [existingTimeOff] = await db.select().from(teamMemberTimeOff)
        .where(eq(teamMemberTimeOff.id, id));
      
      if (!existingTimeOff) {
        return res.status(404).json({ error: 'Time off request not found' });
      }
      
      const isOwned = await verifyTeamMemberOwnership(userId, existingTimeOff.teamMemberId);
      if (!isOwned) {
        return res.status(403).json({ error: 'Time off request does not belong to your business' });
      }
      
      await db.delete(teamMemberTimeOff).where(eq(teamMemberTimeOff.id, id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting time off:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // ACTIVITY FEED ROUTES
  // ============================================

  // Get recent activity for the business
  app.get("/api/activity-feed", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const beforeStr = req.query.before as string;
      const before = beforeStr ? new Date(beforeStr) : undefined;
      
      // Get team membership to find business owner
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const activities = await storage.getActivityFeed(businessOwnerId, limit, before);
      res.json(activities);
    } catch (error: any) {
      console.error('Error getting activity feed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new activity item (internal use)
  app.post("/api/activity-feed", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { activityType, entityType, entityId, entityTitle, description, metadata, isImportant } = req.body;
      
      if (!activityType) {
        return res.status(400).json({ error: 'activityType is required' });
      }
      
      // Get user info for actor name
      const user = await storage.getUser(userId);
      const actorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown User';
      
      // Get team membership to find business owner
      const teamMembership = await storage.getTeamMembershipByMemberId(userId);
      const businessOwnerId = teamMembership?.businessOwnerId || userId;
      
      const activity = await storage.createActivity({
        businessOwnerId,
        actorUserId: userId,
        actorName,
        activityType,
        entityType: entityType || null,
        entityId: entityId || null,
        entityTitle: entityTitle || null,
        description: description || null,
        metadata: metadata || null,
        isImportant: isImportant || false,
      });
      
      res.status(201).json(activity);
    } catch (error: any) {
      console.error('Error creating activity:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MOCK DATA SEEDING (Development/Testing)
  // ============================================
  
  // Seed mock data for testing
  app.post("/api/dev/seed-mock-data", requireAuth, requireDevelopment, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      const tradeType = user?.tradeType || 'plumbing';
      
      const { seedMockData } = await import('./mockData');
      const result = await seedMockData(userId, tradeType);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error seeding mock data:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Clear all user data (for testing)
  app.post("/api/dev/clear-data", requireAuth, requireDevelopment, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      const { clearMockData } = await import('./mockData');
      const result = await clearMockData(userId);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error clearing data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Email template preview (development only)
  app.get("/api/dev/email-preview/:type", requireDevelopment, async (req, res) => {
    const { type } = req.params;
    // Use the request's host to construct the correct URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost:5000';
    const baseUrl = `${protocol}://${host}`;
    const logoUrl = `${baseUrl}/tradietrack-logo.png`;
    
    const sampleUser = { firstName: 'Mike', email: 'mike@example.com' };
    
    let html = '';
    
    if (type === 'welcome') {
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to TradieTrack</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <img src="${logoUrl}" alt="TradieTrack" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to TradieTrack!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your business management platform</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">G'day ${sampleUser.firstName}!</h2>
            <p>Thanks for signing up for TradieTrack! We're stoked to have you on board.</p>
            <p>TradieTrack helps you manage your trade business with ease - from quotes and invoices to scheduling and client management.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Get Started</a>
            </div>
          </div>
          
          <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; color: #666; font-size: 14px; text-align: center;">
            <p><strong>TradieTrack</strong> | Streamline your trade business</p>
          </div>
        </body>
        </html>
      `;
    } else if (type === 'reset') {
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - TradieTrack</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <img src="${logoUrl}" alt="TradieTrack" style="max-width: 160px; height: auto; margin-bottom: 15px;" />
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${sampleUser.firstName},</h2>
            <p>We received a request to reset the password for your TradieTrack account.</p>
            <p>Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
          </div>
          
          <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; color: #666; font-size: 14px;">
            <p><strong>Important:</strong> This link will expire in 1 hour.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      return res.status(400).send('Unknown email type. Use: welcome, reset');
    }
    
    res.send(html);
  });

  // ============================================
  // AUTOMATION SETTINGS & FIELD OPERATIONS
  // ============================================

  // Get automation settings
  app.get("/api/automation-settings", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      let settings = await storage.getAutomationSettings(userId);
      
      if (!settings) {
        settings = await storage.createAutomationSettings({
          userId,
          jobReminderEnabled: true,
          jobReminderHoursBefore: 24,
          jobReminderType: 'sms',
          quoteFollowUpEnabled: true,
          quoteFollowUpDays: 3,
          invoiceReminderEnabled: true,
          invoiceReminderDaysBeforeDue: 3,
          invoiceOverdueReminderDays: 7,
          requirePhotoBeforeStart: false,
          requirePhotoAfterComplete: false,
          autoCheckInOnArrival: false,
          autoCheckOutOnDeparture: false,
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error('Error getting automation settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update automation settings
  app.put("/api/automation-settings", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const updates = req.body;
      
      const settings = await storage.upsertAutomationSettings(userId, updates);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating automation settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get job reminders for a job
  app.get("/api/jobs/:jobId/reminders", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const reminders = await storage.getJobReminders(jobId);
      res.json(reminders);
    } catch (error: any) {
      console.error('Error getting job reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a job reminder
  app.post("/api/jobs/:jobId/reminders", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { type, sendAt, hoursBeforeJob } = req.body;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (!sendAt) {
        return res.status(400).json({ error: 'sendAt is required' });
      }
      
      const reminder = await storage.createJobReminder({
        jobId,
        userId,
        type: type || 'sms',
        sendAt: new Date(sendAt),
        hoursBeforeJob: hoursBeforeJob || 24,
        status: 'pending',
      });
      
      res.json(reminder);
    } catch (error: any) {
      console.error('Error creating job reminder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel job reminders
  app.post("/api/jobs/:jobId/reminders/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await storage.cancelJobReminders(jobId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error cancelling job reminders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get job photo requirements
  app.get("/api/jobs/:jobId/photo-requirements", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const requirements = await storage.getJobPhotoRequirements(jobId);
      res.json(requirements);
    } catch (error: any) {
      console.error('Error getting photo requirements:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create photo requirement
  app.post("/api/jobs/:jobId/photo-requirements", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.params;
      const { stage, description, isRequired } = req.body;
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (!stage || !description) {
        return res.status(400).json({ error: 'stage and description are required' });
      }
      
      const requirement = await storage.createJobPhotoRequirement({
        jobId,
        stage,
        description,
        isRequired: isRequired !== false,
      });
      
      res.json(requirement);
    } catch (error: any) {
      console.error('Error creating photo requirement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fulfill photo requirement
  app.post("/api/photo-requirements/:id/fulfill", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { photoUrl } = req.body;
      
      const requirement = await storage.fulfillPhotoRequirement(id, photoUrl);
      if (!requirement) {
        return res.status(404).json({ error: 'Requirement not found' });
      }
      
      res.json(requirement);
    } catch (error: any) {
      console.error('Error fulfilling photo requirement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // DEFECT TRACKING
  // ============================================

  // Get all defects
  app.get("/api/defects", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, status, severity } = req.query;
      
      const defects = await storage.getDefects(userId, {
        jobId: jobId as string,
        status: status as string,
        severity: severity as string,
      });
      
      res.json(defects);
    } catch (error: any) {
      console.error('Error getting defects:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single defect
  app.get("/api/defects/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const defect = await storage.getDefect(id, userId);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error getting defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create defect
  app.post("/api/defects", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId, clientId, title, description, severity, reportedBy, photos } = req.body;
      
      if (!jobId || !title) {
        return res.status(400).json({ error: 'Job ID and title are required' });
      }
      
      // Verify job ownership
      const job = await storage.getJob(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const defect = await storage.createDefect({
        jobId,
        userId,
        clientId: clientId || job.clientId,
        title,
        description,
        severity: severity || 'medium',
        reportedBy,
        photos: photos || [],
      });
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error creating defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update defect
  app.put("/api/defects/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const defect = await storage.updateDefect(id, userId, req.body);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error updating defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Acknowledge defect
  app.post("/api/defects/:id/acknowledge", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const defect = await storage.acknowledgeDefect(id, userId);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error acknowledging defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resolve defect
  app.post("/api/defects/:id/resolve", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      
      const defect = await storage.resolveDefect(id, userId, resolutionNotes);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error resolving defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Close defect
  app.post("/api/defects/:id/close", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const defect = await storage.closeDefect(id, userId);
      if (!defect) {
        return res.status(404).json({ error: 'Defect not found' });
      }
      
      res.json(defect);
    } catch (error: any) {
      console.error('Error closing defect:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TIMESHEET APPROVALS
  // ============================================

  // Get pending timesheet approvals
  app.get("/api/timesheet-approvals", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const approvals = await storage.getPendingTimesheetApprovals(userId);
      res.json(approvals);
    } catch (error: any) {
      console.error('Error getting timesheet approvals:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Submit timesheet for approval
  app.post("/api/time-entries/:id/submit", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id: timeEntryId } = req.params;
      
      const approval = await storage.createTimesheetApproval({
        timeEntryId,
        submittedBy: userId,
        status: 'pending',
      });
      
      res.json(approval);
    } catch (error: any) {
      console.error('Error submitting timesheet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve timesheet
  app.post("/api/timesheet-approvals/:id/approve", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { notes } = req.body;
      
      const approval = await storage.approveTimesheet(id, userId, notes);
      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      
      res.json(approval);
    } catch (error: any) {
      console.error('Error approving timesheet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reject timesheet
  app.post("/api/timesheet-approvals/:id/reject", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { notes } = req.body;
      
      if (!notes) {
        return res.status(400).json({ error: 'Notes are required when rejecting a timesheet' });
      }
      
      const approval = await storage.rejectTimesheet(id, userId, notes);
      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      
      res.json(approval);
    } catch (error: any) {
      console.error('Error rejecting timesheet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Request timesheet revision
  app.post("/api/timesheet-approvals/:id/revision", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { notes } = req.body;
      
      if (!notes) {
        return res.status(400).json({ error: 'Notes are required when requesting a revision' });
      }
      
      const approval = await storage.requestTimesheetRevision(id, userId, notes);
      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      
      res.json(approval);
    } catch (error: any) {
      console.error('Error requesting revision:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // RECURRING CONTRACTS (Job Templates)
  // ============================================

  // Get all recurring contracts for user
  app.get("/api/recurring-contracts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const contracts = await storage.getRecurringContracts(userId);
      res.json(contracts);
    } catch (error: any) {
      console.error('Error getting recurring contracts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new recurring contract
  app.post("/api/recurring-contracts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const validated = insertRecurringContractSchema.parse(req.body);
      
      const contract = await storage.createRecurringContract({
        ...validated,
        userId,
      });
      
      res.json(contract);
    } catch (error: any) {
      console.error('Error creating recurring contract:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single recurring contract
  app.get("/api/recurring-contracts/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const contract = await storage.getRecurringContract(id, userId);
      if (!contract) {
        return res.status(404).json({ error: 'Recurring contract not found' });
      }
      
      res.json(contract);
    } catch (error: any) {
      console.error('Error getting recurring contract:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a recurring contract
  app.put("/api/recurring-contracts/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const contract = await storage.updateRecurringContract(id, userId, req.body);
      if (!contract) {
        return res.status(404).json({ error: 'Recurring contract not found' });
      }
      
      res.json(contract);
    } catch (error: any) {
      console.error('Error updating recurring contract:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a recurring contract
  app.delete("/api/recurring-contracts/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      await storage.deleteRecurringContract(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting recurring contract:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get schedules for a recurring contract
  app.get("/api/recurring-contracts/:id/schedules", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Verify contract ownership
      const contract = await storage.getRecurringContract(id, userId);
      if (!contract) {
        return res.status(404).json({ error: 'Recurring contract not found' });
      }
      
      const schedules = await storage.getRecurringSchedules(id);
      res.json(schedules);
    } catch (error: any) {
      console.error('Error getting recurring schedules:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate a job from recurring contract template
  app.post("/api/recurring-contracts/:id/generate-job", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      // Get the recurring contract
      const contract = await storage.getRecurringContract(id, userId);
      if (!contract) {
        return res.status(404).json({ error: 'Recurring contract not found' });
      }
      
      // Get the client for the job
      const client = await storage.getClient(contract.clientId, userId);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Create a job from the template
      const jobTemplate = contract.jobTemplate as Record<string, any> || {};
      const job = await storage.createJob({
        userId,
        clientId: contract.clientId,
        title: contract.title,
        description: contract.description || jobTemplate.description || '',
        status: 'pending',
        priority: jobTemplate.priority || 'medium',
        scheduledDate: contract.nextJobDate,
        address: client.address,
        city: client.city,
        state: client.state,
        postcode: client.postcode,
        country: client.country,
      });
      
      // Create a schedule entry linking the job to the contract
      await storage.createRecurringSchedule({
        contractId: contract.id,
        jobId: job.id,
        scheduledDate: contract.nextJobDate,
        status: 'scheduled',
      });
      
      // Calculate and update the next job date based on frequency
      const nextDate = new Date(contract.nextJobDate);
      switch (contract.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'fortnightly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
      
      // Check if the contract has an end date and if we've passed it
      let newStatus = contract.status;
      if (contract.endDate && nextDate > new Date(contract.endDate)) {
        newStatus = 'completed';
      }
      
      await storage.updateRecurringContract(id, userId, {
        nextJobDate: nextDate,
        status: newStatus,
      });
      
      res.json({ job, message: 'Job generated successfully' });
    } catch (error: any) {
      console.error('Error generating job from recurring contract:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================
  // Leads / CRM Pipeline
  // ========================

  // Get all leads for user
  app.get("/api/leads", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const leads = await storage.getLeads(userId);
      res.json(leads);
    } catch (error: any) {
      console.error('Error getting leads:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new lead
  app.post("/api/leads", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const validated = insertLeadSchema.parse(req.body);
      
      const lead = await storage.createLead({
        ...validated,
        userId,
      });
      
      res.json(lead);
    } catch (error: any) {
      console.error('Error creating lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single lead
  app.get("/api/leads/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const lead = await storage.getLead(id, userId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      res.json(lead);
    } catch (error: any) {
      console.error('Error getting lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a lead
  app.put("/api/leads/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const lead = await storage.updateLead(id, userId, req.body);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      res.json(lead);
    } catch (error: any) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a lead
  app.delete("/api/leads/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      await storage.deleteLead(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Convert lead to client (and optionally create job/quote)
  app.post("/api/leads/:id/convert", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { createJob, createQuote } = req.body;
      
      // Get the lead
      const lead = await storage.getLead(id, userId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Create a client from the lead
      const client = await storage.createClient({
        userId,
        name: lead.name,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        notes: lead.notes || undefined,
      });
      
      // Update the lead with the new client ID and mark as won
      await storage.updateLead(id, userId, {
        clientId: client.id,
        status: 'won',
        wonLostReason: 'Converted to client',
      });
      
      let job = null;
      let quote = null;
      
      // Optionally create a job
      if (createJob) {
        job = await storage.createJob({
          userId,
          clientId: client.id,
          title: lead.description || `Job for ${lead.name}`,
          description: lead.notes || '',
          status: 'pending',
        });
      }
      
      // Optionally create a quote
      if (createQuote) {
        const quoteNumber = await storage.generateQuoteNumber(userId);
        quote = await storage.createQuote({
          userId,
          clientId: client.id,
          quoteNumber,
          status: 'draft',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
      
      res.json({
        success: true,
        client,
        job,
        quote,
        message: 'Lead converted successfully',
      });
    } catch (error: any) {
      console.error('Error converting lead:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}