import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { AuthService } from "./auth";
import { setupGoogleAuth } from "./googleAuth";
import { loginSchema, insertUserSchema, type SafeUser, requestLoginCodeSchema, verifyLoginCodeSchema } from "@shared/schema";
import { sendEmailVerificationEmail, sendLoginCodeEmail, sendJobConfirmationEmail, sendPasswordResetEmail } from "./emailService";
import { FreemiumService } from "./freemiumService";
import { DEMO_USER } from "./demoData";
import { ownerOnly, createPermissionMiddleware, PERMISSIONS, getUserContext, hasPermission } from "./permissions";
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
  // Types
  type InsertTimeEntry,
  // Location tracking tables
  locationTracking,
  tradieStatus,
  // ServiceM8 parity feature schemas
  insertJobSignatureSchema,
  insertQuoteRevisionSchema,
  insertAssetSchema,
  insertJobAssetSchema,
  insertStaffAvailabilitySchema,
  insertStaffTimeOffSchema,
  insertJobFormTemplateSchema,
  insertJobFormResponseSchema,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { 
  ObjectStorageService, 
  ObjectNotFoundError 
} from "./objectStorage";
import { 
  tradieQuoteTemplates, 
  tradieLineItems, 
  tradieRateCards 
} from "./tradieTemplates";
import { generateAISuggestions, chatWithAI, type BusinessContext } from "./ai";
import { notifyQuoteSent, notifyInvoiceSent, notifyInvoicePaid, notifyJobScheduled, notifyJobStarted, notifyJobCompleted } from "./notifications";
import { getEmailIntegration, getGmailConnectionStatus } from "./emailIntegrationService";
import { getUncachableStripeClient, getStripePublishableKey, isStripeInitialized } from "./stripeClient";
import { geocodeAddress } from "./geocoding";

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

  // Check if SMS is set up (Twilio environment variables)
  const hasSmsSetup = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

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

  // Short URL redirect for quotes: /q/:token -> /public/quote/:token
  app.get("/q/:token", (req: any, res) => {
    res.redirect(301, `/public/quote/${req.params.token}`);
  });

  // Public quote acceptance page - client views and accepts/declines quote
  app.get("/public/quote/:token", async (req: any, res) => {
    try {
      const { generateQuoteAcceptancePage } = await import('./pdfService');
      
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
      const business = await storage.getBusinessSettings(quoteWithItems.userId);
      
      if (!client || !business) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Error</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 60px;">
            <h1>Error Loading Quote</h1>
            <p>Could not load quote details. Please contact the business.</p>
          </body></html>
        `);
      }
      
      // Fetch signature if quote is accepted
      let signature = null;
      if (quoteWithItems.status === 'accepted') {
        signature = await storage.getDigitalSignatureByQuoteId(quoteWithItems.id);
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
        token: req.params.token,
        canAcceptPayments
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
          // Save the digital signature
          try {
            await storage.createDigitalSignature({
              quoteId: quote.id,
              signerName: accepted_by.trim(),
              signatureData: signature_data,
              signedAt: new Date(),
              ipAddress: clientIp,
              userAgent: userAgent,
              documentType: 'quote',
              isValid: true,
            });
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
          } catch (e) {
            console.error('Failed to create notification:', e);
          }
        }
      } else if (action === 'decline') {
        const updatedQuote = await storage.declineQuoteByToken(token, decline_reason || undefined);
        
        if (updatedQuote) {
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
          } catch (e) {
            console.error('Failed to create notification:', e);
          }
        }
      }
      
      // Redirect back to view the updated quote
      res.redirect(`/public/quote/${token}`);
    } catch (error) {
      console.error("Error processing quote action:", error);
      res.status(500).send('Failed to process your request. Please try again.');
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
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json({ 
        token,
        acceptanceUrl: `${baseUrl}/q/${token}`
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
  app.post("/api/auth/register", async (req: any, res) => {
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
      };
      const result = await AuthService.register(cleanUserData);
      
      if (result.success) {
        // Generate and send email verification token
        try {
          const verificationToken = await AuthService.createEmailVerificationToken(result.user.id);
          await sendEmailVerificationEmail(result.user, verificationToken);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't fail registration if email fails - user can resend later
        }

        // Don't create session until email is verified
        res.json({ 
          success: true, 
          user: result.user,
          message: 'Registration successful! Please check your email to verify your account before logging in.'
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: any, res) => {
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
  app.post("/api/auth/request-code", async (req: any, res) => {
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

  app.post("/api/auth/verify-code", async (req: any, res) => {
    try {
      const { email, code } = verifyLoginCodeSchema.parse(req.body);
      
      // Verify code and create/find user
      const user = await storage.verifyLoginCodeAndCreateUser(email, code);
      
      if (!user) {
        return res.status(401).json({ 
          error: "Invalid or expired code. Please request a new code." 
        });
      }
      
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
          const result = await storage.db.execute(
            `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
            [sessionToken]
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
      };
      
      res.json(safeUser);
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
        // Set session after successful verification and explicitly save
        req.session.userId = result.user.id;
        req.session.user = result.user;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Failed to create session" });
          }
          // Return session token for iOS/Safari fallback where cookies may not work
          res.json({ success: true, user: result.user, message: 'Email verified successfully!', sessionToken: req.sessionID });
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Email verification failed" });
    }
  });

  app.post("/api/auth/resend-verification", async (req: any, res) => {
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
  app.post("/api/auth/forgot-password", async (req: any, res) => {
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
          const result = await storage.db.execute(
            `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
            [sessionToken]
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

  // Freemium usage tracking endpoint
  app.get("/api/subscription/usage", requireAuth, async (req: any, res) => {
    try {
      const usageInfo = await FreemiumService.getFullUsageInfo(req.userId);
      res.json(usageInfo);
    } catch (error) {
      console.error("Error fetching usage info:", error);
      res.status(500).json({ error: "Failed to fetch usage information" });
    }
  });

  // Global Search Endpoint
  app.get("/api/search", requireAuth, async (req: any, res) => {
    try {
      const query = (req.query.q || '').toString().toLowerCase();
      
      if (query.length < 2) {
        return res.json([]);
      }

      const results: any[] = [];

      // Batch fetch all data once for efficiency
      const allClients = await storage.getClients(req.userId);
      const allJobs = await storage.getJobs(req.userId);
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
      const quotes = await storage.getQuotes(req.userId);
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
      const invoices = await storage.getInvoices(req.userId);
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

  app.post("/api/ai/chat", requireAuth, async (req: any, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const context = await gatherAIContext(req.userId, storage);
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
      
      // SMS disabled for beta
      const sendSMS = async (options: { to: string; message: string }) => {
        console.log('[BETA] SMS disabled - would send to:', options.to);
        return { success: true, simulated: true };
      };

      // Helper to find client by name
      const findClient = async (clientName: string) => {
        const clients = await storage.getClients(req.userId);
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

        const result = await sendEmailViaIntegration({
          to: recipientEmail,
          subject: action.data.subject || 'Message from your tradie',
          html: (action.data.body || '').replace(/\n/g, '<br>'),
          text: action.data.body || '',
          userId: req.userId,
          type: action.data.emailType === 'invoice' ? 'invoice' : 
                action.data.emailType === 'quote' ? 'quote' : 'reminder'
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

      // ========== SEND EXISTING INVOICE ==========
      if (action.type === 'send_invoice' && action.data) {
        const invoice = await storage.getInvoiceWithLineItems(action.data.invoiceId, req.userId);
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

        const business = await storage.getBusinessSettings(req.userId);
        const { generateInvoicePDF } = await import('./pdfService');
        const pdfBuffer = await generateInvoicePDF(invoice, invoice.lineItems || [], client, business);

        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: `Invoice ${invoice.number || ''} from ${business?.businessName || 'Your Tradie'}`,
          html: `<p>Hi ${client.name?.split(' ')[0]},</p>
                 <p>Please find attached invoice ${invoice.number || ''} for $${parseFloat(invoice.total || '0').toFixed(2)}.</p>
                 ${action.data.message ? `<p>${action.data.message}</p>` : ''}
                 <p>Thanks for your business!</p>
                 <p>${business?.businessName || ''}</p>`,
          text: `Invoice ${invoice.number || ''} attached`,
          userId: req.userId,
          type: 'invoice',
          relatedId: invoice.id.toString(),
          attachments: [{ filename: `Invoice-${invoice.number || invoice.id}.pdf`, content: pdfBuffer }]
        });

        if (result.success) {
          await storage.updateInvoice(invoice.id, req.userId, { status: 'sent' });
        }

        return res.json({ 
          success: result.success, 
          message: result.success 
            ? `Invoice sent to ${client.name}!` 
            : (result.error || "Failed to send invoice")
        });
      }

      // ========== SEND EXISTING QUOTE ==========
      if (action.type === 'send_quote' && action.data) {
        const quote = await storage.getQuoteWithLineItems(action.data.quoteId, req.userId);
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

        const business = await storage.getBusinessSettings(req.userId);
        const { generateQuotePDF } = await import('./pdfService');
        const pdfBuffer = await generateQuotePDF(quote, quote.lineItems || [], client, business);

        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: `Quote ${quote.number || ''} from ${business?.businessName || 'Your Tradie'}`,
          html: `<p>Hi ${client.name?.split(' ')[0]},</p>
                 <p>Please find attached your quote for $${parseFloat(quote.total || '0').toFixed(2)}.</p>
                 ${action.data.message ? `<p>${action.data.message}</p>` : ''}
                 <p>Let me know if you have any questions!</p>
                 <p>${business?.businessName || ''}</p>`,
          text: `Quote ${quote.number || ''} attached`,
          userId: req.userId,
          type: 'quote',
          relatedId: quote.id.toString(),
          attachments: [{ filename: `Quote-${quote.number || quote.id}.pdf`, content: pdfBuffer }]
        });

        if (result.success) {
          await storage.updateQuote(quote.id, req.userId, { status: 'sent' });
        }

        return res.json({ 
          success: result.success, 
          message: result.success 
            ? `Quote sent to ${client.name}!` 
            : (result.error || "Failed to send quote")
        });
      }

      // ========== CREATE INVOICE ==========
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
          userId: req.userId,
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

      // ========== CREATE QUOTE ==========
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
          userId: req.userId,
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

      // ========== CREATE JOB ==========
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
          userId: req.userId,
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

      // ========== MARK JOB COMPLETE ==========
      if (action.type === 'mark_job_complete' && action.data) {
        const job = await storage.getJob(action.data.jobId, req.userId);
        if (!job) {
          return res.json({ success: false, message: "Job not found" });
        }

        await storage.updateJob(action.data.jobId, req.userId, { 
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

      // ========== PAYMENT REMINDER ==========
      if (action.type === 'payment_reminder' && action.data) {
        const invoice = await storage.getInvoiceWithLineItems(action.data.invoiceId, req.userId);
        if (!invoice) {
          return res.json({ success: false, message: "Invoice not found" });
        }

        const client = await storage.getClientById(invoice.clientId);
        const business = await storage.getBusinessSettings(req.userId);
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
            userId: req.userId,
            type: 'reminder',
            relatedId: invoice.id.toString()
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

  // Business Settings Routes
  app.get("/api/business-settings", requireAuth, async (req: any, res) => {
    try {
      // Use effectiveUserId for staff members to get their business owner's settings
      const userContext = await getUserContext(req.userId);
      const settings = await storage.getBusinessSettings(userContext.effectiveUserId);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching business settings:", error);
      res.status(500).json({ error: "Failed to fetch business settings" });
    }
  });

  app.post("/api/business-settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const data = insertBusinessSettingsSchema.parse(req.body);
      const settings = await storage.createBusinessSettings({ ...data, userId: req.userId });
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating business settings:", error);
      res.status(500).json({ error: "Failed to create business settings" });
    }
  });

  app.patch("/api/business-settings", requireAuth, ownerOnly(), async (req: any, res) => {
    try {
      const data = insertBusinessSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateBusinessSettings(req.userId, data);
      if (!settings) {
        return res.status(404).json({ error: "Business settings not found" });
      }
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating business settings:", error);
      res.status(500).json({ error: "Failed to update business settings" });
    }
  });

  // Integration Status (platform-level - what integrations are configured)
  app.get("/api/integrations/status", requireAuth, async (req: any, res) => {
    try {
      // Check platform integration status
      const stripe = await getUncachableStripeClient();
      const stripeConfigured = !!stripe;
      
      // SendGrid is always configured via platform
      const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
      
      res.json({
        stripe: stripeConfigured,
        sendgrid: sendgridConfigured,
        googleAuth: false, // Coming soon
      });
    } catch (error) {
      console.error("Error fetching integration status:", error);
      res.json({ stripe: false, sendgrid: false, googleAuth: false });
    }
  });
  
  // Integration Settings Routes
  app.get("/api/integrations/settings", requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getIntegrationSettings(req.userId);
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          stripeEnabled: false,
          emailEnabled: false,
          autoSendInvoices: false,
          autoGeneratePaymentLinks: false,
          emailTemplate: '',
          paymentTerms: 'Net 30'
        });
      }
      res.json(settings);
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
  
  // Test SMS Route - Disabled for beta
  app.post("/api/integrations/test-sms", requireAuth, async (req: any, res) => {
    res.status(501).json({ 
      error: "SMS notifications are disabled in beta. This feature is coming soon!"
    });
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
        // SMS/Twilio disabled for beta
        twilioSecretsAvailable: false,
        twilioManaged: false,
        twilioSource: 'disabled',
        twilioStatus: 'disabled',
        twilioMessage: 'SMS notifications disabled for beta',
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

  // Platform stats endpoint - returns beta status
  app.get("/api/platform/stats", async (req, res) => {
    res.json({
      isBeta: true,
      isFree: true,
      message: "Free during beta",
    });
  });

  // Recent activity endpoint - shows user's recent system activity
  app.get("/api/activity/recent/:limit?", requireAuth, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.params.limit) || 10, 50);
      
      // Get recent notifications as activity indicators
      const notifications = await storage.getNotifications(req.userId);
      
      // Map notifications to activity items (limit the results)
      const activities = notifications.slice(0, limit).map((n: any) => {
        let type = 'email_sent';
        if (n.type === 'payment') type = 'payment_received';
        else if (n.type === 'quote') type = n.title?.includes('accepted') ? 'quote_accepted' : 'quote_sent';
        else if (n.type === 'invoice') type = 'invoice_sent';
        else if (n.type === 'reminder') type = 'reminder_sent';
        
        return {
          id: n.id,
          type,
          title: n.title || 'Activity',
          description: n.message || '',
          timestamp: n.createdAt,
          status: 'success' as const,
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
      
      res.json({
        hasIntegration: !!activeIntegration,
        integration: activeIntegration ? {
          id: activeIntegration.id,
          provider: activeIntegration.provider,
          emailAddress: activeIntegration.emailAddress,
          displayName: activeIntegration.displayName,
          status: activeIntegration.status,
          lastUsedAt: activeIntegration.lastUsedAt,
          lastError: activeIntegration.lastError,
        } : null,
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

  app.get("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.id, req.userId);
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

  app.delete("/api/clients/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_CLIENTS), async (req: any, res) => {
    try {
      const success = await storage.deleteClient(req.params.id, req.userId);
      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Jobs Routes
  app.get("/api/jobs", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      let jobs = await storage.getJobs(userContext.effectiveUserId);
      
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

  // Today's jobs endpoint - Must come BEFORE the :id route
  app.get("/api/jobs/today", requireAuth, async (req: any, res) => {
    try {
      const jobs = await storage.getJobs(req.userId);
      const clients = await storage.getClients(req.userId);
      
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
                lineItems: linkedQuote.lineItems,
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
        if (job.assignedTo !== req.userId) {
          return res.status(403).json({ error: "You can only view your assigned jobs" });
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
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

      const data = insertJobSchema.parse(req.body);
      
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
      
      const data = insertJobSchema.partial().parse(req.body);
      const existingJob = await storage.getJob(req.params.id, effectiveUserId);
      
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
      
      const job = await storage.updateJob(req.params.id, effectiveUserId, updateData);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Create notifications for status changes
      if (data.status && existingJob && data.status !== existingJob.status) {
        const client = job.clientId ? await storage.getClient(job.clientId, effectiveUserId) : null;
        const clientName = client?.name || 'Unknown client';

        if (data.status === 'scheduled') {
          await notifyJobScheduled(storage, effectiveUserId, job, clientName);
        } else if (data.status === 'in_progress') {
          await notifyJobStarted(storage, effectiveUserId, job, clientName);
        } else if (data.status === 'done') {
          await notifyJobCompleted(storage, effectiveUserId, job, { firstName: 'You', username: 'You' });
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
      
      // Update job status
      const job = await storage.updateJob(req.params.id, effectiveUserId, { status });
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
        }
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  // Assign job to team member (for team owners/managers)
  app.post("/api/jobs/:id/assign", requireAuth, async (req: any, res) => {
    try {
      const userContext = await getUserContext(req.userId);
      const { assignedTo } = req.body;
      
      if (!assignedTo) {
        return res.status(400).json({ error: "assignedTo is required" });
      }
      
      // Verify the user is owner/manager (can assign jobs)
      const businessSettings = await storage.getBusinessSettings(userContext.effectiveUserId);
      const isOwner = businessSettings && businessSettings.userId === req.userId;
      
      // Check if user is a manager via team member role
      let isManager = false;
      if (!isOwner) {
        const teamMemberInfo = await storage.getTeamMemberByUserIdAndBusiness(req.userId, userContext.effectiveUserId);
        if (teamMemberInfo && teamMemberInfo.roleId) {
          // Get the role name from the role ID
          const role = await storage.getUserRole(teamMemberInfo.roleId);
          isManager = role?.name?.toLowerCase().includes('manager') || 
                      role?.name?.toLowerCase().includes('admin') || false;
        }
      }
      
      if (!isOwner && !isManager) {
        return res.status(403).json({ error: "Only owners and managers can assign jobs" });
      }
      
      // Verify the assignee is a valid team member
      const teamMembers = await storage.getTeamMembers(userContext.effectiveUserId);
      const validAssignee = teamMembers.find(m => m.userId === assignedTo && m.inviteStatus === 'accepted');
      
      if (!validAssignee) {
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
      
      // Create notification for the assigned team member
      await storage.createNotification({
        userId: assignedTo,
        type: 'job_assigned',
        title: 'New Job Assigned',
        message: `You have been assigned to: ${job.title}`,
        relatedId: job.id,
        relatedType: 'job',
      });
      
      res.json(job);
    } catch (error: any) {
      console.error("Error assigning job:", error);
      res.status(500).json({ error: error.message || "Failed to assign job" });
    }
  });

  // Send job confirmation email
  app.post("/api/jobs/:id/send-confirmation", requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJob(req.params.id, req.userId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!job.clientId) {
        return res.status(400).json({ error: "Job has no associated client" });
      }

      const client = await storage.getClient(job.clientId, req.userId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ error: "Client has no email address" });
      }

      const business = await storage.getBusinessSettings(req.userId) || {
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

  // Checklist Items
  app.get("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const items = await storage.getChecklistItems(req.params.jobId, req.userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching checklist items:", error);
      res.status(500).json({ error: "Failed to fetch checklist items" });
    }
  });

  app.post("/api/jobs/:jobId/checklist", requireAuth, async (req: any, res) => {
    try {
      const data = insertChecklistItemSchema.parse({
        ...req.body,
        jobId: req.params.jobId
      });
      const item = await storage.createChecklistItem(data, req.userId);
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
      const updates = updateChecklistItemSchema.partial().parse(req.body);
      const item = await storage.updateChecklistItem(req.params.id, req.userId, updates);
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
      const success = await storage.deleteChecklistItem(req.params.id, req.userId);
      if (!success) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting checklist item:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  app.get("/api/clients/:clientId/jobs", requireAuth, async (req: any, res) => {
    try {
      const jobs = await storage.getJobsForClient(req.params.clientId, req.userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs for client:", error);
      res.status(500).json({ error: "Failed to fetch jobs for client" });
    }
  });

  // Quotes Routes
  app.get("/api/quotes", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const [quotes, clients] = await Promise.all([
        storage.getQuotes(req.userId),
        storage.getClients(req.userId),
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

  // Accepted quotes endpoint for invoice creation workflow
  // Returns accepted quotes with full data (client, job, line items) for creating invoices
  app.get("/api/quotes/accepted", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const userId = req.userId;
      
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

  app.get("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const quote = await storage.getQuoteWithLineItems(req.params.id, req.userId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const { lineItems, ...quoteData } = req.body;
      const data = insertQuoteSchema.parse(quoteData);
      
      // Generate quote number if not provided
      if (!data.number) {
        data.number = await storage.generateQuoteNumber(req.userId);
      }
      
      const quote = await storage.createQuote({ ...data, userId: req.userId });
      
      // Add line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          const lineItemData = insertQuoteLineItemSchema.parse({ ...item, quoteId: quote.id });
          await storage.createQuoteLineItem(lineItemData, req.userId);
        }
      }
      
      const quoteWithItems = await storage.getQuoteWithLineItems(quote.id, req.userId);
      res.status(201).json(quoteWithItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  app.patch("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const data = updateQuoteSchema.parse(req.body);
      const quote = await storage.updateQuote(req.params.id, req.userId, data);
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

  app.delete("/api/quotes/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const success = await storage.deleteQuote(req.params.id, req.userId);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Generate quote from job
  app.post("/api/jobs/:id/generate-quote", requireAuth, async (req: any, res) => {
    try {
      const job = await storage.getJob(req.params.id, req.userId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate quote number
      const quoteNumber = await storage.generateQuoteNumber(req.userId);
      
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

      const quote = await storage.createQuote({ ...quoteData, userId: req.userId });
      const quoteWithItems = await storage.getQuoteWithLineItems(quote.id, req.userId);
      
      res.status(201).json(quoteWithItems);
    } catch (error) {
      console.error("Error generating quote from job:", error);
      res.status(500).json({ error: "Failed to generate quote from job" });
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

  app.post("/api/quotes/:id/accept", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, req.userId, {
        status: 'accepted',
        acceptedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error accepting quote:", error);
      res.status(500).json({ error: "Failed to accept quote" });
    }
  });

  app.post("/api/quotes/:id/reject", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_QUOTES), async (req: any, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, req.userId, {
        status: 'declined',
        rejectedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error rejecting quote:", error);
      res.status(500).json({ error: "Failed to reject quote" });
    }
  });

  // PDF Download - Quote
  app.get("/api/quotes/:id/pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const { generateQuotePDF, generatePDFBuffer } = await import('./pdfService');
      
      const quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, req.userId);
      if (!quoteWithItems) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const client = await storage.getClient(quoteWithItems.clientId, req.userId);
      const business = await storage.getBusinessSettings(req.userId);
      
      if (!client || !business) {
        return res.status(404).json({ error: "Client or business settings not found" });
      }
      
      // Get linked job for site address if available
      const job = quoteWithItems.jobId ? await storage.getJob(quoteWithItems.jobId, req.userId) : undefined;
      
      const html = generateQuotePDF({
        quote: quoteWithItems,
        lineItems: quoteWithItems.lineItems || [],
        client,
        business,
        job
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

  // Preview PDF - Generate PDF from draft quote data (before saving)
  app.post("/api/quotes/preview-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_QUOTES), async (req: any, res) => {
    try {
      const { generateQuotePDF, generatePDFBuffer } = await import('./pdfService');
      
      const { clientId, title, description, validUntil, subtotal, gstAmount, total, lineItems, notes } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      const client = await storage.getClient(clientId, req.userId);
      const business = await storage.getBusinessSettings(req.userId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Create a mock quote object for PDF generation
      const mockQuote = {
        id: 'preview',
        userId: req.userId,
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
      
      const html = generateQuotePDF({
        quote: mockQuote,
        lineItems: formattedLineItems,
        client,
        business: business || {
          id: 'default',
          userId: req.userId,
          businessName: 'Your Business',
          abn: '',
          address: '',
          phone: '',
          email: '',
          brandColor: '#2563eb',
          gstEnabled: true,
        }
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

  // Invoices Routes
  app.get("/api/invoices", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const [invoices, clients] = await Promise.all([
        storage.getInvoices(req.userId),
        storage.getClients(req.userId),
      ]);
      
      // Create client lookup map
      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      
      // Enrich invoices with client data
      const enrichedInvoices = invoices.map((invoice: any) => {
        const client = clientsMap.get(invoice.clientId);
        return {
          ...invoice,
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

  app.get("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const { lineItems, ...invoiceData } = req.body;
      const data = insertInvoiceSchema.parse(invoiceData);
      
      // Generate invoice number if not provided
      if (!data.number) {
        data.number = await storage.generateInvoiceNumber(req.userId);
      }
      
      const invoice = await storage.createInvoice({ ...data, userId: req.userId });
      
      // Add line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          const lineItemData = insertInvoiceLineItemSchema.parse({ ...item, invoiceId: invoice.id });
          await storage.createInvoiceLineItem(lineItemData, req.userId);
        }
      }
      
      const invoiceWithItems = await storage.getInvoiceWithLineItems(invoice.id, req.userId);
      res.status(201).json(invoiceWithItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const data = updateInvoiceSchema.parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, req.userId, data);
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

  app.delete("/api/invoices/:id", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id, req.userId);
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

  // Create Gmail draft with invoice PDF automatically attached
  app.post("/api/invoices/:id/email-with-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleInvoiceEmailWithPDF } = await import('./emailRoutes');
    return handleInvoiceEmailWithPDF(req, res, storage);
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    const { handleInvoiceMarkPaid } = await import('./emailRoutes');
    return handleInvoiceMarkPaid(req, res, storage);
  });

  // Record manual payment with details (cash, bank transfer, etc.)
  app.post("/api/invoices/:id/record-payment", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      const { amount, paymentMethod, reference, notes } = req.body;
      
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
      const invoice = await storage.getInvoice(req.params.id, req.userId);
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
      const updatedInvoice = await storage.updateInvoice(req.params.id, req.userId, {
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
          const job = await storage.getJob(invoice.jobId, req.userId);
          if (job && job.status !== 'invoiced') {
            await storage.updateJob(invoice.jobId, req.userId, { status: 'invoiced' });
          }
        } catch (jobError) {
          console.log("Job status update skipped:", jobError);
        }
      }
      
      res.json({
        ...updatedInvoice,
        message: `Payment of $${parsedAmount.toFixed(2)} recorded via ${paymentMethod}`
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

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
        const bytes = crypto.randomBytes(12);
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

  // PDF Download - Invoice
  app.get("/api/invoices/:id/pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const { generateInvoicePDF, generatePDFBuffer } = await import('./pdfService');
      
      const invoiceWithItems = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
      if (!invoiceWithItems) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const client = await storage.getClient(invoiceWithItems.clientId, req.userId);
      const business = await storage.getBusinessSettings(req.userId);
      
      if (!client || !business) {
        return res.status(404).json({ error: "Client or business settings not found" });
      }
      
      // Get linked job and time entries for site address and time tracking
      const job = invoiceWithItems.jobId ? await storage.getJob(invoiceWithItems.jobId, req.userId) : undefined;
      const timeEntries = invoiceWithItems.jobId ? await storage.getTimeEntries(req.userId, invoiceWithItems.jobId) : [];
      
      const html = generateInvoicePDF({
        invoice: invoiceWithItems,
        lineItems: invoiceWithItems.lineItems || [],
        client,
        business,
        job,
        timeEntries
      });
      
      const pdfBuffer = await generatePDFBuffer(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceWithItems.number}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      res.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });

  // Preview PDF - Generate PDF from draft invoice data (before saving)
  app.post("/api/invoices/preview-pdf", requireAuth, createPermissionMiddleware(PERMISSIONS.READ_INVOICES), async (req: any, res) => {
    try {
      const { generateInvoicePDF, generatePDFBuffer } = await import('./pdfService');
      
      const { clientId, title, description, dueDate, subtotal, gstAmount, total, lineItems, notes } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "Client ID is required" });
      }
      
      const client = await storage.getClient(clientId, req.userId);
      const business = await storage.getBusinessSettings(req.userId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Create a mock invoice object for PDF generation
      const mockInvoice = {
        id: 'preview',
        userId: req.userId,
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
      
      const html = generateInvoicePDF({
        invoice: mockInvoice,
        lineItems: formattedLineItems,
        client,
        business: business || {
          id: 'default',
          userId: req.userId,
          businessName: 'Your Business',
          abn: '',
          address: '',
          phone: '',
          email: '',
          brandColor: '#dc2626',
          gstEnabled: true,
        }
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

  // Create Stripe checkout session for invoice payment (with Connect destination charges)
  app.post("/api/invoices/:id/create-checkout-session", requireAuth, createPermissionMiddleware(PERMISSIONS.WRITE_INVOICES), async (req: any, res) => {
    try {
      // Get invoice with line items
      const invoice = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
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

      const totalAmountCents = Math.round(parseFloat(invoice.total) * 100);
      const stripe = await getUncachableStripeClient();

      if (stripe) {
        // Build checkout session config
        const sessionConfig: any = {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'aud',
                product_data: {
                  name: `Invoice #${invoice.number || invoice.id.substring(0, 8).toUpperCase()}`,
                  description: invoice.title || 'Invoice payment',
                },
                unit_amount: totalAmountCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${req.headers.origin}/invoices/${invoice.id}?payment=success`,
          cancel_url: `${req.headers.origin}/invoices/${invoice.id}?payment=cancelled`,
          client_reference_id: invoice.id,
          customer_email: client.email || undefined,
          metadata: {
            invoiceId: invoice.id,
            userId: req.userId,
            businessName: business.businessName || '',
          },
        };

        // Add Stripe Connect destination charges if tradie has Connect account
        if (business.stripeConnectAccountId && business.connectChargesEnabled) {
          // Platform fee: 2.5% (minimum $0.50)
          const platformFee = Math.max(Math.round(totalAmountCents * 0.025), 50);
          sessionConfig.payment_intent_data = {
            application_fee_amount: platformFee,
            transfer_data: {
              destination: business.stripeConnectAccountId,
            },
            metadata: {
              invoiceId: invoice.id,
              tradieUserId: req.userId,
              clientId: client.id || '',
              clientName: client.name || '',
            },
          };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ 
          paymentUrl: session.url,
          sessionId: session.id,
          mode: 'stripe',
          connectEnabled: !!(business.stripeConnectAccountId && business.connectChargesEnabled)
        });
      } else {
        // Mock payment for testing
        const mockPaymentUrl = `https://checkout.stripe.com/mock/${invoice.id}?total=${invoice.total}&currency=AUD&business=${encodeURIComponent(business.businessName || '')}&client=${encodeURIComponent(client.name)}`;
        
        res.json({ 
          paymentUrl: mockPaymentUrl,
          sessionId: `mock_session_${invoice.id}`,
          mode: 'mock',
          message: 'Mock payment link created for testing'
        });
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create payment link" });
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
      const [jobs, quotes, invoices] = await Promise.all([
        storage.getJobs(req.userId),
        storage.getQuotes(req.userId),
        storage.getInvoices(req.userId)
      ]);

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
        monthlyEarnings
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
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
  app.post("/api/test-data", requireAuth, async (req: any, res) => {
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
      
      // Generate the payment URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const paymentUrl = `${baseUrl}/pay/${token}`;
      
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
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const paymentUrl = `${baseUrl}/pay/${request.token}`;
      
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
      const { getStripeInstance } = await import('./stripeClient');
      const stripe = getStripeInstance();
      
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
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
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

  // Get active timer - MUST be defined BEFORE /:id route to avoid matching "active" as an ID
  app.get("/api/time-entries/active", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const activeEntry = await storage.getActiveTimeEntry(userId);
      // Return null explicitly when no active entry exists (not 404 or undefined)
      res.json(activeEntry || null);
    } catch (error) {
      console.error('Error fetching active timer:', error);
      res.status(500).json({ error: 'Failed to fetch active timer' });
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

  // Trip Tracking Routes - ServiceM8-style travel time tracking
  app.get("/api/trips", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { jobId } = req.query;
      const trips = await storage.getTrips(userId, jobId as string);
      res.json(trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  app.get("/api/trips/active", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const activeTrip = await storage.getActiveTrip(userId);
      res.json(activeTrip || null);
    } catch (error) {
      console.error('Error fetching active trip:', error);
      res.status(500).json({ error: 'Failed to fetch active trip' });
    }
  });

  app.get("/api/trips/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const trip = await storage.getTrip(id, userId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      res.json(trip);
    } catch (error) {
      console.error('Error fetching trip:', error);
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  });

  app.post("/api/trips", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const tripData = req.body;
      
      // Check if there's already an active trip
      const activeTrip = await storage.getActiveTrip(userId);
      if (activeTrip) {
        return res.status(400).json({ 
          error: 'You already have an active trip. Stop it before starting a new one.',
          activeTrip
        });
      }
      
      const trip = await storage.createTrip({
        ...tripData,
        userId,
        startTime: new Date(),
        status: 'in_progress',
      });
      res.status(201).json(trip);
    } catch (error) {
      console.error('Error creating trip:', error);
      res.status(500).json({ error: 'Failed to create trip' });
    }
  });

  app.put("/api/trips/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const tripData = req.body;
      
      const trip = await storage.updateTrip(id, userId, tripData);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      res.json(trip);
    } catch (error) {
      console.error('Error updating trip:', error);
      res.status(500).json({ error: 'Failed to update trip' });
    }
  });

  app.post("/api/trips/:id/stop", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { endLatitude, endLongitude, endAddress, distanceKm, notes } = req.body;
      
      // First update with location data if provided
      if (endLatitude || endLongitude || endAddress || distanceKm) {
        await storage.updateTrip(id, userId, {
          endLatitude,
          endLongitude,
          endAddress,
          distanceKm,
          notes,
        });
      }
      
      const stoppedTrip = await storage.stopTrip(id, userId);
      if (!stoppedTrip) {
        return res.status(404).json({ error: 'Trip not found or already stopped' });
      }
      res.json(stoppedTrip);
    } catch (error) {
      console.error('Error stopping trip:', error);
      res.status(500).json({ error: 'Failed to stop trip' });
    }
  });

  app.delete("/api/trips/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const deleted = await storage.deleteTrip(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting trip:', error);
      res.status(500).json({ error: 'Failed to delete trip' });
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
      const categories = await storage.getExpenseCategories(userId);
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
  
  // Get all team members for the current user (business owner)
  app.get("/api/team/members", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const teamMembers = await storage.getTeamMembers(userId);
      res.json(teamMembers);
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({ error: 'Failed to fetch team members' });
    }
  });

  // Invite a new team member
  app.post("/api/team/members/invite", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Validate request data
      let inviteData;
      try {
        inviteData = insertTeamMemberSchema.parse(req.body);
      } catch (validationError: any) {
        return res.status(400).json({ 
          error: 'Invalid invite data',
          details: validationError.errors || validationError.message 
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
      
      // TODO: Send invitation email
      
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
      
      // TODO: Send invitation email
      
      res.json(updated);
    } catch (error) {
      console.error('Error resending invite:', error);
      res.status(500).json({ error: 'Failed to resend invitation' });
    }
  });

  // Remove a team member
  app.delete("/api/team/members/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const memberId = req.params.id;
      
      const member = await storage.getTeamMember(memberId, userId);
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      await storage.deleteTeamMember(memberId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing team member:', error);
      res.status(500).json({ error: 'Failed to remove team member' });
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

  // Get current user's role (if they're a team member)
  app.get("/api/team/my-role", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      
      // Check if this user is a team member (not business owner)
      const allMembers = await storage.getTeamMembers(userId);
      const myMembership = allMembers.find(m => m.memberId === userId);
      
      if (!myMembership) {
        // User is not a team member, return null
        return res.json(null);
      }
      
      // Get role details
      const roles = await storage.getUserRoles();
      const role = roles.find(r => r.id === myMembership.roleId);
      
      if (!role) {
        return res.json(null);
      }
      
      res.json({
        roleId: role.id,
        roleName: role.name,
        permissions: role.permissions || []
      });
    } catch (error) {
      console.error('Error fetching user role:', error);
      res.status(500).json({ error: 'Failed to fetch user role' });
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
      
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
      
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
  app.post("/api/stripe-connect/create-payment-intent", requireAuth, async (req: any, res) => {
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
      
      // Don't expose sensitive data
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
        const bytes = crypto.randomBytes(12);
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
      const baseUrl = process.env.APP_BASE_URL 
        || (process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`
          : 'http://localhost:5000');
      const paymentUrl = `${baseUrl}/pay/${paymentToken}`;
      
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
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
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
        const baseUrl = `${req.protocol}://${req.get('host')}`;
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
  app.post("/api/stripe/terminal-connection-token", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ 
          error: 'Stripe Connect account not set up',
          code: 'STRIPE_NOT_CONNECTED',
          message: 'Please connect your Stripe account in Settings > Payments before using Tap to Pay'
        });
      }

      // Create connection token using the connected account
      const connectionToken = await stripe.terminal.connectionTokens.create(
        {},
        { stripeAccount: settings.stripeConnectAccountId }
      );
      
      res.json({ secret: connectionToken.secret });
    } catch (error: any) {
      console.error('Error creating Terminal connection token:', error);
      // Provide more helpful error messages
      if (error.code === 'resource_missing') {
        return res.status(400).json({ 
          error: 'Stripe Terminal not enabled for this account',
          code: 'TERMINAL_NOT_ENABLED',
          message: 'Tap to Pay requires Stripe Terminal to be enabled. Please contact support.'
        });
      }
      res.status(500).json({ 
        error: 'Failed to create connection token',
        code: 'TERMINAL_ERROR',
        message: 'Unable to initialize Tap to Pay. Please try again later.'
      });
    }
  });

  // Create payment intent for Terminal (Tap to Pay)
  app.post("/api/stripe/create-terminal-payment-intent", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { amount, description, currency = 'aud', invoiceId, jobId } = req.body;
      
      if (!amount || amount < 500) {
        return res.status(400).json({ 
          error: 'Minimum amount is $5.00 (500 cents)',
          code: 'AMOUNT_TOO_LOW'
        });
      }

      const settings = await storage.getBusinessSettings(userId);
      
      if (!settings?.stripeConnectAccountId) {
        return res.status(400).json({ 
          error: 'Stripe Connect account not set up',
          code: 'STRIPE_NOT_CONNECTED',
          message: 'Please connect your Stripe account in Settings > Payments before accepting payments'
        });
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
      // Provide more helpful error messages
      if (error.code === 'resource_missing') {
        return res.status(400).json({ 
          error: 'Stripe Terminal not enabled',
          code: 'TERMINAL_NOT_ENABLED',
          message: 'Tap to Pay requires Stripe Terminal to be enabled. Please contact support.'
        });
      }
      if (error.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ 
          error: 'Invalid payment request',
          code: 'INVALID_REQUEST',
          message: error.message || 'Unable to create payment. Please check your settings.'
        });
      }
      res.status(500).json({ 
        error: 'Failed to create payment intent',
        code: 'PAYMENT_ERROR',
        message: 'Unable to create payment. Please try again later.'
      });
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

  // Register device for push notifications (mobile app compatible)
  app.post("/api/notifications/register-device", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { pushToken, platform, deviceId } = req.body;
      
      if (!pushToken || !platform) {
        return res.status(400).json({ error: 'Push token and platform required' });
      }

      console.log(`[Push] Device registered for user ${userId}: ${pushToken.substring(0, 30)}... (${platform})`);
      
      res.json({ 
        success: true,
        message: 'Device registered for push notifications',
      });
    } catch (error: any) {
      console.error('Error registering device:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  });

  // Send test push notification (for verification)
  app.post("/api/notifications/test-push", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Push token required' });
      }

      // In production, this would use Expo's push notification API
      // For now, we log and return success
      console.log(`[Push] Test notification requested for user ${userId}`);
      
      // Simulate sending to Expo push API
      // const response = await fetch('https://exp.host/--/api/v2/push/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     to: token,
      //     title: 'TradieTrack Test',
      //     body: 'Push notifications are working!',
      //     data: { type: 'test' },
      //   }),
      // });
      
      res.json({ 
        success: true,
        message: 'Test notification sent',
      });
    } catch (error: any) {
      console.error('Error sending test push:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
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

  // Store geofence event (job site arrival/departure)
  app.post("/api/geofence-events", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { identifier, action, timestamp } = req.body;
      
      // Parse job ID from identifier (format: job_<jobId>)
      const jobId = identifier?.startsWith('job_') ? identifier.substring(4) : null;
      
      if (jobId) {
        console.log(`[Geofence] User ${userId} ${action}ed job site ${jobId}`);
        
        // Could create a time entry or update job status here
        // For now, just log it
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error handling geofence event:', error);
      res.status(500).json({ error: 'Failed to process geofence event' });
    }
  });

  // ===== JOB PHOTOS ROUTES =====
  
  // Get photos for a job
  app.get("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      
      const { getJobPhotos } = await import('./photoService');
      const photos = await getJobPhotos(jobId, userId);
      
      res.json(photos);
    } catch (error: any) {
      console.error('Error getting job photos:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload photo to a job
  app.post("/api/jobs/:jobId/photos", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const jobId = req.params.jobId;
      const { fileName, fileBase64, mimeType, category, caption, takenAt } = req.body;
      
      if (!fileName || !fileBase64 || !mimeType) {
        return res.status(400).json({ error: 'fileName, fileBase64, and mimeType required' });
      }
      
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      
      const { uploadJobPhoto } = await import('./photoService');
      const result = await uploadJobPhoto(userId, jobId, fileBuffer, {
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
  
  // Update photo metadata
  app.patch("/api/jobs/:jobId/photos/:photoId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;
      const { category, caption, sortOrder } = req.body;
      
      const { updatePhotoMetadata } = await import('./photoService');
      const result = await updatePhotoMetadata(photoId, userId, { category, caption, sortOrder });
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating photo:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete photo
  app.delete("/api/jobs/:jobId/photos/:photoId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { photoId } = req.params;
      
      const { deleteJobPhoto } = await import('./photoService');
      const result = await deleteJobPhoto(photoId, userId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting photo:', error);
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
      const enrichedMessage = {
        ...message,
        senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        senderAvatar: user?.profileImageUrl,
      };
      
      res.json(enrichedMessage);
    } catch (error: any) {
      console.error('Error sending job chat message:', error);
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
      
      res.json({ 
        participants,
        jobTitle: job.title,
        participantCount: participants.length,
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
  
  // Delete own message from job chat
  app.delete("/api/jobs/:jobId/chat/:messageId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;
      
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
      
      // Only owners and managers can view team locations
      if (!userContext.isOwner && !hasPermission(userContext, PERMISSIONS.VIEW_ALL)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const effectiveUserId = userContext.effectiveUserId;
      const teamMembers = await storage.getTeamMembers(effectiveUserId);
      const activeMembers = teamMembers.filter(m => m.inviteStatus === 'accepted' && m.isActive);
      
      const locations = [];
      
      for (const member of activeMembers) {
        if (!member.memberId) continue;
        
        const user = await storage.getUser(member.memberId);
        if (!user) continue;
        
        // Get most recent location for this team member
        const recentLocation = await storage.getLatestLocationForUser(member.memberId);
        
        // Get current active job if any
        const activeTimeEntry = await storage.getActiveTimeEntry(member.memberId);
        let currentJob = null;
        if (activeTimeEntry?.jobId) {
          currentJob = await storage.getJob(activeTimeEntry.jobId, effectiveUserId);
        }
        
        if (recentLocation) {
          locations.push({
            id: member.memberId,
            name: `${member.firstName || user.firstName || ''} ${member.lastName || user.lastName || ''}`.trim() || user.email,
            email: user.email,
            latitude: parseFloat(recentLocation.latitude),
            longitude: parseFloat(recentLocation.longitude),
            lastUpdated: recentLocation.timestamp,
            currentJobId: currentJob?.id || null,
            currentJobTitle: currentJob?.title || null,
          });
        }
      }
      
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
      
      // Transform jobs to map data format - only include jobs with valid coordinates
      const mapData = jobs
        .filter(job => {
          if (!job.latitude || !job.longitude) return false;
          const lat = parseFloat(job.latitude);
          const lng = parseFloat(job.longitude);
          return isValidCoordinate(lat, lng);
        })
        .map(job => {
          const client = job.clientId ? clientMap.get(job.clientId) : null;
          return {
            id: job.id,
            title: job.title,
            address: job.address || '',
            latitude: parseFloat(job.latitude!),
            longitude: parseFloat(job.longitude!),
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

  // Optimize route order (nearest-neighbor algorithm)
  app.post("/api/routes/optimize", requireAuth, async (req: any, res) => {
    try {
      const { jobIds, startLat, startLng } = req.body;
      const userContext = await getUserContext(req.userId);
      
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ error: 'jobIds array is required' });
      }
      
      // Get job details with coordinates
      const jobsWithCoords = [];
      for (const jobId of jobIds) {
        const job = await storage.getJob(jobId, userContext.effectiveUserId);
        if (job) {
          jobsWithCoords.push({
            id: job.id,
            title: (job as any).title,
            address: (job as any).address,
            latitude: (job as any).latitude,
            longitude: (job as any).longitude,
          });
        }
      }
      
      // Filter jobs with valid coordinates
      const validJobs = jobsWithCoords.filter(j => j.latitude && j.longitude);
      
      if (validJobs.length <= 1) {
        return res.json({
          optimizedOrder: jobIds,
          totalDistance: 0,
          estimatedDuration: 0,
          stops: validJobs.map((j, idx) => ({
            ...j,
            order: idx + 1,
            distanceFromPrevious: 0,
            estimatedArrival: null,
          })),
        });
      }
      
      // Haversine distance calculation
      function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      }
      
      // Nearest-neighbor optimization
      const optimizedOrder: typeof validJobs = [];
      const remaining = [...validJobs];
      
      // Start from provided coordinates or first job
      let currentLat = startLat ?? remaining[0].latitude;
      let currentLng = startLng ?? remaining[0].longitude;
      
      while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
          const dist = haversineDistance(currentLat, currentLng, remaining[i].latitude!, remaining[i].longitude!);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }
        
        const nearestJob = remaining.splice(nearestIdx, 1)[0];
        optimizedOrder.push(nearestJob);
        currentLat = nearestJob.latitude!;
        currentLng = nearestJob.longitude!;
      }
      
      // Calculate distances and estimated times
      let totalDistance = 0;
      const stops = optimizedOrder.map((job, idx) => {
        let distanceFromPrevious = 0;
        if (idx > 0) {
          const prev = optimizedOrder[idx - 1];
          distanceFromPrevious = haversineDistance(
            prev.latitude!, prev.longitude!,
            job.latitude!, job.longitude!
          );
        } else if (startLat && startLng) {
          distanceFromPrevious = haversineDistance(startLat, startLng, job.latitude!, job.longitude!);
        }
        totalDistance += distanceFromPrevious;
        
        // Estimate travel time: assume 40 km/h average speed in urban areas
        const travelMinutes = (distanceFromPrevious / 40) * 60;
        
        return {
          ...job,
          order: idx + 1,
          distanceFromPrevious: Math.round(distanceFromPrevious * 10) / 10, // km
          travelMinutes: Math.round(travelMinutes),
        };
      });
      
      // Estimate total duration: travel time + 30 min average per job
      const totalTravelMinutes = stops.reduce((sum, s) => sum + s.travelMinutes, 0);
      const estimatedDuration = totalTravelMinutes + (stops.length * 30);
      
      res.json({
        optimizedOrder: optimizedOrder.map(j => j.id),
        totalDistance: Math.round(totalDistance * 10) / 10, // km
        estimatedDuration, // minutes
        stops,
      });
    } catch (error: any) {
      console.error('Error optimizing route:', error);
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
      // Accept both 'message' and 'content' for backwards compatibility
      const messageText = req.body.message || req.body.content;
      
      if (!messageText?.trim()) {
        return res.status(400).json({ error: 'Message content is required' });
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
        message: messageText.trim(),
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
      const enrichedMessage = {
        ...message,
        senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        senderAvatar: user?.profileImageUrl,
      };
      
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
      
      if (context.hasAccess && context.businessOwnerId) {
        teamChatUnread = await storage.getUnreadTeamChatCount(context.businessOwnerId, userId);
      }
      
      // For now, return team chat count as total
      // Future: Add DM and job chat unread counts
      res.json({ 
        teamChat: teamChatUnread,
        directMessages: 0,
        jobChats: 0,
        total: teamChatUnread
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
  
  // Delete own message from team chat
  app.delete("/api/team-chat/:messageId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;
      
      // Users can only delete their own messages
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
      const { startTrial } = await import('./subscriptionService');
      const result = await startTrial(userId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, trialEndsAt: result.endsAt });
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
        const paidAt = invoice.paidAt ? new Date(invoice.paidAt) : null;
        if (paidAt && paidAt.getFullYear() === targetYear && invoice.status === 'paid') {
          const month = paidAt.getMonth();
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

  // ============================================
  // MOCK DATA SEEDING (Development/Testing)
  // ============================================
  
  // Seed mock data for testing
  app.post("/api/dev/seed-mock-data", requireAuth, async (req: any, res) => {
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
  app.post("/api/dev/clear-data", requireAuth, async (req: any, res) => {
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

  // ============================================
  // SERVICEM8 PARITY FEATURES
  // ============================================

  // ----- JOB SIGNATURES -----
  
  // Get all signatures for a job
  app.get("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const signatures = await storage.getJobSignatures(jobId);
      res.json(signatures);
    } catch (error: any) {
      console.error('Error fetching job signatures:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new signature for a job
  app.post("/api/jobs/:jobId/signatures", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const validatedData = insertJobSignatureSchema.parse({
        ...req.body,
        jobId,
        capturedBy: userId,
      });
      
      const signature = await storage.createJobSignature(validatedData);
      res.status(201).json(signature);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating job signature:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a signature
  app.delete("/api/jobs/:jobId/signatures/:signatureId", requireAuth, async (req: any, res) => {
    try {
      const { jobId, signatureId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await storage.deleteJobSignature(signatureId, effectiveUserId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting job signature:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- QUOTE REVISIONS -----
  
  // Get all revisions for a quote
  app.get("/api/quotes/:quoteId/revisions", requireAuth, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const quote = await storage.getQuote(quoteId, effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      const revisions = await storage.getQuoteRevisions(quoteId);
      res.json(revisions);
    } catch (error: any) {
      console.error('Error fetching quote revisions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a revision snapshot for a quote
  app.post("/api/quotes/:quoteId/revisions", requireAuth, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const quote = await storage.getQuoteWithLineItems(quoteId, effectiveUserId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      
      const existingRevisions = await storage.getQuoteRevisions(quoteId);
      const revisionNumber = existingRevisions.length + 1;
      
      const validatedData = insertQuoteRevisionSchema.parse({
        quoteId,
        revisionNumber,
        snapshotData: {
          quote: {
            total: quote.total,
            subtotal: quote.subtotal,
            gstAmount: quote.gstAmount,
            notes: quote.notes,
            status: quote.status,
          },
          lineItems: quote.lineItems,
        },
        createdBy: userId,
        notes: req.body.notes,
      });
      
      const revision = await storage.createQuoteRevision(validatedData);
      res.status(201).json(revision);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating quote revision:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- ASSETS -----
  
  // Get all assets for user
  app.get("/api/assets", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const assets = await storage.getAssets(effectiveUserId);
      res.json(assets);
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single asset
  app.get("/api/assets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const asset = await storage.getAsset(id, effectiveUserId);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      res.json(asset);
    } catch (error: any) {
      console.error('Error fetching asset:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new asset
  app.post("/api/assets", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const validatedData = insertAssetSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });
      
      const asset = await storage.createAsset(validatedData);
      res.status(201).json(asset);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating asset:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update asset
  app.patch("/api/assets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const asset = await storage.updateAsset(id, effectiveUserId, req.body);
      res.json(asset);
    } catch (error: any) {
      console.error('Error updating asset:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete asset
  app.delete("/api/assets/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      await storage.deleteAsset(id, effectiveUserId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- JOB ASSETS -----
  
  // Get assets assigned to job
  app.get("/api/jobs/:jobId/assets", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const jobAssets = await storage.getJobAssets(jobId);
      res.json(jobAssets);
    } catch (error: any) {
      console.error('Error fetching job assets:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add asset to job
  app.post("/api/jobs/:jobId/assets", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const validatedData = insertJobAssetSchema.parse({
        ...req.body,
        jobId,
      });
      
      const jobAsset = await storage.addJobAsset(validatedData);
      res.status(201).json(jobAsset);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error adding asset to job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update job asset
  app.patch("/api/jobs/:jobId/assets/:id", requireAuth, async (req: any, res) => {
    try {
      const { jobId, id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const jobAsset = await storage.updateJobAsset(id, req.body);
      res.json(jobAsset);
    } catch (error: any) {
      console.error('Error updating job asset:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove asset from job
  app.delete("/api/jobs/:jobId/assets/:id", requireAuth, async (req: any, res) => {
    try {
      const { jobId, id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      await storage.removeJobAsset(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing asset from job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- STAFF AVAILABILITY -----
  
  // Get availability for all staff (owner view)
  app.get("/api/staff/availability", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const availability = await storage.getStaffAvailability(userId, effectiveUserId);
      res.json(availability);
    } catch (error: any) {
      console.error('Error fetching staff availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get availability for specific staff member
  app.get("/api/staff/availability/:staffUserId", requireAuth, async (req: any, res) => {
    try {
      const { staffUserId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const availability = await storage.getStaffAvailability(staffUserId, effectiveUserId);
      res.json(availability);
    } catch (error: any) {
      console.error('Error fetching staff availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set availability
  app.post("/api/staff/availability", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const validatedData = insertStaffAvailabilitySchema.parse({
        ...req.body,
        userId: req.body.userId || userId,
        businessOwnerId: effectiveUserId,
      });
      
      const availability = await storage.setStaffAvailability(validatedData);
      res.status(201).json(availability);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error setting staff availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update availability
  app.patch("/api/staff/availability/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const availability = await storage.updateStaffAvailability(id, req.body);
      res.json(availability);
    } catch (error: any) {
      console.error('Error updating staff availability:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- STAFF TIME OFF -----
  
  // Get all time off requests
  app.get("/api/staff/time-off", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const timeOffRequests = await storage.getStaffTimeOff(effectiveUserId);
      res.json(timeOffRequests);
    } catch (error: any) {
      console.error('Error fetching time off requests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create time off request
  app.post("/api/staff/time-off", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const validatedData = insertStaffTimeOffSchema.parse({
        ...req.body,
        userId: req.body.userId || userId,
        businessOwnerId: effectiveUserId,
      });
      
      const timeOff = await storage.createTimeOffRequest(validatedData);
      res.status(201).json(timeOff);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating time off request:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update time off request (approve/reject)
  app.patch("/api/staff/time-off/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      
      const updateData = {
        ...req.body,
        ...(req.body.status && { reviewedBy: userId, reviewedAt: new Date() }),
      };
      
      const timeOff = await storage.updateTimeOffRequest(id, updateData);
      res.json(timeOff);
    } catch (error: any) {
      console.error('Error updating time off request:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- JOB FORMS -----
  
  // Get all form templates
  app.get("/api/job-forms/templates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const templates = await storage.getJobFormTemplates(effectiveUserId);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching form templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single form template
  app.get("/api/job-forms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const template = await storage.getJobFormTemplate(id, effectiveUserId);
      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching form template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create form template
  app.post("/api/job-forms/templates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const validatedData = insertJobFormTemplateSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });
      
      const template = await storage.createJobFormTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating form template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update form template
  app.patch("/api/job-forms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const template = await storage.updateJobFormTemplate(id, effectiveUserId, req.body);
      res.json(template);
    } catch (error: any) {
      console.error('Error updating form template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete form template
  app.delete("/api/job-forms/templates/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      await storage.deleteJobFormTemplate(id, effectiveUserId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting form template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get form responses for job
  app.get("/api/jobs/:jobId/forms", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const responses = await storage.getJobFormResponses(jobId);
      res.json(responses);
    } catch (error: any) {
      console.error('Error fetching job form responses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Submit form response for job
  app.post("/api/jobs/:jobId/forms", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const validatedData = insertJobFormResponseSchema.parse({
        ...req.body,
        jobId,
        submittedBy: userId,
      });
      
      const response = await storage.createJobFormResponse(validatedData);
      res.status(201).json(response);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error submitting form response:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update form response
  app.patch("/api/jobs/:jobId/forms/:id", requireAuth, async (req: any, res) => {
    try {
      const { jobId, id } = req.params;
      const userId = req.userId!;
      const context = await getUserContext(userId);
      const effectiveUserId = context.businessOwnerId || userId;
      
      const job = await storage.getJob(jobId, effectiveUserId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const response = await storage.updateJobFormResponse(id, req.body);
      res.json(response);
    } catch (error: any) {
      console.error('Error updating form response:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}