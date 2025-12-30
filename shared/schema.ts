import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, jsonb, index, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Managed by connect-pg-simple for express-session
// Must match the exact structure created by connect-pg-simple
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Subscription tier limits
export const TIER_LIMITS = {
  free: {
    jobsPerMonth: 25,
    invoicesPerMonth: 25,
    quotesPerMonth: -1, // unlimited quotes - key sales tool
    clients: 50,
    teamMembers: 0,
    photoStorage: 100, // MB
    templates: 5,
    features: ['basic_jobs', 'basic_invoices', 'unlimited_quotes', 'email_send'],
    restrictions: [
      'no_ai_assistant',
      'no_team_members', 
      'no_recurring_invoices',
      'no_sms',
      'no_tap_to_pay',
      'no_gps_tracking',
      'no_custom_branding',
      'no_xero_myob',
      'no_reports',
    ],
  },
  pro: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: 1, // Pro is single user only
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'branding', 'ai_assistant'],
  },
  team: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: -1, // unlimited based on purchased seats
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'team_management', 'branding', 'ai_assistant', 'live_tracking', 'team_chat'],
  },
  trial: {
    durationDays: 14,
  },
} as const;

// Pricing in cents (AUD)
export const PRICING = {
  pro: {
    monthly: 3900, // $39/month
    name: 'TradieTrack Pro',
    description: 'Unlimited jobs, quotes, and invoices for solo tradies',
  },
  team: {
    baseMonthly: 5900, // $59/month base
    seatMonthly: 2900, // $29/month per additional seat
    name: 'TradieTrack Team',
    baseName: 'TradieTrack Team (Base)',
    seatName: 'Additional Team Member',
    description: 'Full features plus team management and live tracking',
  },
} as const;

// User storage table - Updated for Replit Auth compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // Keep existing UUID structure
  email: varchar("email").unique(), // Replit Auth provides email (can be null)
  username: text("username").unique(), // Keep for existing users, new users get this from email or generated
  password: text("password"), // Keep for backwards compatibility but make nullable
  googleId: varchar("google_id").unique(), // For Google OAuth linkage
  appleId: varchar("apple_id").unique(), // For Apple Sign In linkage
  firstName: varchar("first_name"), // From Replit Auth claims
  lastName: varchar("last_name"), // From Replit Auth claims
  profileImageUrl: varchar("profile_image_url"), // From Replit Auth claims
  themeColor: varchar("theme_color"), // Custom color for map markers and theme (hex format e.g. #FF5733)
  tradeType: text("trade_type"), // 'plumbing', 'electrical', etc.
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  subscriptionTier: text("subscription_tier").default('free'), // free, pro, team, trial
  // Usage tracking
  jobsCreatedThisMonth: integer("jobs_created_this_month").default(0),
  invoicesCreatedThisMonth: integer("invoices_created_this_month").default(0),
  quotesCreatedThisMonth: integer("quotes_created_this_month").default(0),
  usageResetDate: timestamp("usage_reset_date").defaultNow(),
  // Trial tracking
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialStatus: text("trial_status"), // active, expired, converted
  intendedTier: text("intended_tier"), // 'free', 'pro', 'team' - set during registration
  // Legacy field kept for compatibility
  subscriptionResetDate: timestamp("subscription_reset_date").defaultNow(),
  // Platform admin flag - for admin@avwebinnovation.com to access platform dashboard
  isPlatformAdmin: boolean("is_platform_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Replit Auth user upsert type
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'password' | 'emailVerificationToken' | 'passwordResetToken'>; // Safe user for API responses

// Legacy schemas for backwards compatibility
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  tradeType: true,
  intendedTier: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  intendedTier: z.enum(['free', 'pro', 'team']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;

// Login Codes for passwordless email authentication
export const loginCodes = pgTable("login_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit code
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type LoginCode = typeof loginCodes.$inferSelect;
export type InsertLoginCode = typeof loginCodes.$inferInsert;

// Schemas for login code endpoints
export const requestLoginCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyLoginCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export type RequestLoginCode = z.infer<typeof requestLoginCodeSchema>;
export type VerifyLoginCode = z.infer<typeof verifyLoginCodeSchema>;

// Business Settings
export const businessSettings = pgTable("business_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text("business_name").notNull(),
  abn: text("abn"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  logoUrl: text("logo_url"),
  detectedColors: json("detected_colors").default([]),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  customThemeEnabled: boolean("custom_theme_enabled").default(false),
  gstEnabled: boolean("gst_enabled").default(false),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }).default('100.00'),
  calloutFee: decimal("callout_fee", { precision: 10, scale: 2 }).default('80.00'),
  quoteValidityDays: integer("quote_validity_days").default(30),
  invoicePrefix: text("invoice_prefix").default('TT-'),
  quotePrefix: text("quote_prefix").default('QT-'),
  paymentInstructions: text("payment_instructions"),
  brandColor: text("brand_color").default('#3B5998'),
  // Team/Business Size Settings
  teamSize: text("team_size").default('solo'), // 'solo', 'small' (2-5), 'medium' (6-20), 'large' (20+)
  numberOfEmployees: integer("number_of_employees").default(1),
  // Australian Compliance Fields
  licenseNumber: text("license_number"),
  regulatorRegistration: text("regulator_registration"), // QBCC, VBA, etc.
  insuranceDetails: text("insurance_details"), // Public liability insurance details
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceProvider: text("insurance_provider"),
  insuranceAmount: text("insurance_amount"),
  bankDetails: text("bank_details"), // Bank account details for payments
  warrantyPeriod: text("warranty_period").default('12 months'),
  lateFeeRate: text("late_fee_rate").default('1.5% per month'),
  // Legal Document Terms
  quoteTerms: text("quote_terms"), // Default terms for quotes
  invoiceTerms: text("invoice_terms"), // Default terms for invoices
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(14), // Net 14 by default
  // Stripe Connect Express for customer payments to tradie's bank
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectOnboardingStatus: text("stripe_connect_onboarding_status").default('not_started'), // not_started, pending, submitted, verified, rejected
  stripeConnectTosAcceptedAt: timestamp("stripe_connect_tos_accepted_at"),
  connectChargesEnabled: boolean("connect_charges_enabled").default(false),
  connectPayoutsEnabled: boolean("connect_payouts_enabled").default(false),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default('2.50'), // 2.5% platform fee
  // Automated reminder settings
  autoRemindersEnabled: boolean("auto_reminders_enabled").default(true),
  reminderDays: json("reminder_days").default([7, 14, 30]), // Days after due date to send reminders
  reminderTone: text("reminder_tone").default('friendly'), // friendly, professional, firm
  // TradieTrack Subscription Billing (tradie paying us $39/month)
  stripeCustomerId: text("stripe_customer_id"), // Platform customer ID for subscription billing
  stripeSubscriptionId: text("stripe_subscription_id"), // Active subscription ID
  subscriptionStatus: text("subscription_status").default('none'), // none, active, trialing, past_due, canceled
  currentPeriodEnd: timestamp("current_period_end"), // When current billing period ends
  seatCount: integer("seat_count").default(0), // Number of additional team seats purchased (for Team plan)
  // Payment method info (for display and reminders)
  paymentMethodLast4: text("payment_method_last4"), // Last 4 digits of saved card
  paymentMethodBrand: text("payment_method_brand"), // Card brand (visa, mastercard, etc.)
  defaultPaymentMethodId: text("default_payment_method_id"), // Stripe payment method ID
  // Billing reminder tracking
  nextBillingDate: timestamp("next_billing_date"), // Next charge date (for reminder scheduling)
  lastBillingReminderSentAt: timestamp("last_billing_reminder_sent_at"), // Prevent duplicate reminders
  billingReminderDays: json("billing_reminder_days").default([3, 1]), // Days before billing to send reminders
  billingRemindersEnabled: boolean("billing_reminders_enabled").default(true), // User can disable reminders
  // Trial tracking (at business level)
  trialStartDate: timestamp("trial_start_date"), // When trial started
  trialEndDate: timestamp("trial_end_date"), // When trial ends (14 days after start)
  trialConverted: boolean("trial_converted").default(false), // Did trial convert to paid?
  // Digital Signature Settings
  defaultSignature: text("default_signature"), // Base64 encoded signature image for quotes/invoices
  signatureName: text("signature_name"), // Name displayed under signature
  includeSignatureOnQuotes: boolean("include_signature_on_quotes").default(false),
  includeSignatureOnInvoices: boolean("include_signature_on_invoices").default(false),
  // Document Template Settings
  documentTemplate: text("document_template").default('professional'), // modern, professional, minimal
  documentTemplateSettings: json("document_template_settings"), // Custom overrides for template
  // Theme/Appearance Settings - synced across web and mobile
  themeMode: text("theme_mode").default('system'), // 'light', 'dark', 'system' - synced across all devices
  // SMS Branding Settings
  twilioPhoneNumber: text("twilio_phone_number"), // User's own Twilio phone number (E.164 format)
  twilioSenderId: text("twilio_sender_id"), // Alphanumeric sender ID (11 chars max, e.g., "TradieTrack")
  twilioAccountSid: text("twilio_account_sid"), // User's own Twilio account SID
  twilioAuthToken: text("twilio_auth_token"), // User's own Twilio auth token (encrypted at rest)
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false),
  // AI Features Settings
  aiEnabled: boolean("ai_enabled").default(true), // Enable/disable all AI features
  aiPhotoAnalysisEnabled: boolean("ai_photo_analysis_enabled").default(true), // Enable AI photo analysis
  aiSuggestionsEnabled: boolean("ai_suggestions_enabled").default(true), // Enable AI suggestions
  // Email Sending Preference
  emailSendingMode: text("email_sending_mode").default('manual'), // 'manual' (Gmail draft) or 'automatic' (SendGrid)
  // Google Calendar Integration (per-user OAuth)
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpiry: timestamp("google_calendar_token_expiry"),
  googleCalendarEmail: text("google_calendar_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeEnabled: boolean("stripe_enabled").default(false),
  emailEnabled: boolean("email_enabled").default(false),
  autoSendInvoices: boolean("auto_send_invoices").default(false),
  autoGeneratePaymentLinks: boolean("auto_generate_payment_links").default(false),
  emailTemplate: text("email_template"),
  paymentTerms: text("payment_terms").default('Net 30'),
  // Notification preferences
  notifyQuoteResponses: boolean("notify_quote_responses").default(true),
  notifyPaymentConfirmations: boolean("notify_payment_confirmations").default(true),
  notifyOverdueInvoices: boolean("notify_overdue_invoices").default(true),
  notifyWeeklySummary: boolean("notify_weekly_summary").default(false),
  // Google Calendar Integration
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpiry: timestamp("google_calendar_token_expiry"),
  googleCalendarEmail: text("google_calendar_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // job_reminder, overdue_invoice, payment_received, quote_accepted, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // jobId, invoiceId, quoteId, etc.
  relatedType: text("related_type"), // 'job', 'invoice', 'quote', etc.
  read: boolean("read").default(false),
  dismissed: boolean("dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Push Notification Tokens (for mobile app)
export const pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull(), // Expo push token
  platform: text("platform").notNull(), // 'ios' or 'android'
  deviceId: text("device_id"), // Unique device identifier
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

// Activity Logs - tracks all user activities for dashboard feed
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // job_created, job_started, job_completed, quote_created, quote_sent, quote_accepted, invoice_created, invoice_sent, invoice_paid, etc.
  title: text("title").notNull(),
  description: text("description"),
  // Entity references for navigation
  entityType: text("entity_type"), // 'job', 'quote', 'invoice', 'client'
  entityId: varchar("entity_id"), // ID of the related entity
  // Metadata for additional context
  metadata: jsonb("metadata").default({}), // Can store client name, amounts, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Team Presence - Track real-time status of team members
export const teamPresence = pgTable("team_presence", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 50 }).default('offline'), // online, offline, busy, on_job, break
  statusMessage: varchar("status_message", { length: 255 }),
  currentJobId: varchar("current_job_id").references(() => jobs.id),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  lastLocationLat: real("last_location_lat"),
  lastLocationLng: real("last_location_lng"),
  lastLocationUpdatedAt: timestamp("last_location_updated_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type TeamPresence = typeof teamPresence.$inferSelect;
export const insertTeamPresenceSchema = createInsertSchema(teamPresence).omit({ id: true, updatedAt: true });
export type InsertTeamPresence = z.infer<typeof insertTeamPresenceSchema>;

// Activity Feed - Track team/business activity
export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey(),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actorName: varchar("actor_name", { length: 255 }),
  activityType: varchar("activity_type", { length: 100 }).notNull(), // job_started, job_completed, check_in, check_out, message_sent, quote_sent, invoice_paid, client_added, etc.
  entityType: varchar("entity_type", { length: 50 }), // job, quote, invoice, client, team_member
  entityId: varchar("entity_id"),
  entityTitle: varchar("entity_title", { length: 255 }),
  description: text("description"),
  metadata: jsonb("metadata"), // Additional context data
  isImportant: boolean("is_important").default(false), // For highlighting key events
  createdAt: timestamp("created_at").defaultNow(),
});

export type ActivityFeed = typeof activityFeed.$inferSelect;
export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ id: true, createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;

// Clients
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  savedSignatureData: text("saved_signature_data"),
  savedSignatureDate: timestamp("saved_signature_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jobs
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  address: text("address"),
  // Geocoded coordinates for map display
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  status: text("status").notNull().default('pending'), // pending, scheduled, in_progress, done, invoiced
  scheduledAt: timestamp("scheduled_at"),
  scheduledTime: text("scheduled_time"), // Time of day in HH:MM format
  estimatedDuration: integer("estimated_duration").default(60), // Duration in minutes
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  // Recurring job settings
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // weekly, fortnightly, monthly, quarterly, yearly
  recurrenceInterval: integer("recurrence_interval").default(1), // e.g., every 2 weeks
  recurrenceEndDate: timestamp("recurrence_end_date"), // When to stop recurring
  parentJobId: varchar("parent_job_id"), // Links to original recurring job
  nextRecurrenceDate: timestamp("next_recurrence_date"), // When to create next occurrence
  // Stage timestamps for tracking when each phase was reached
  startedAt: timestamp("started_at"), // When job moved to in_progress
  completedAt: timestamp("completed_at"), // When job moved to done
  invoicedAt: timestamp("invoiced_at"), // When job moved to invoiced
  // Geofence settings for automatic time tracking
  geofenceEnabled: boolean("geofence_enabled").default(false),
  geofenceRadius: integer("geofence_radius").default(100), // Radius in meters (default 100m)
  geofenceAutoClockIn: boolean("geofence_auto_clock_in").default(false), // Auto-start timer on entry
  geofenceAutoClockOut: boolean("geofence_auto_clock_out").default(false), // Auto-stop timer on exit
  // Google Calendar integration
  calendarEventId: text("calendar_event_id"), // Google Calendar event ID for synced jobs
  archivedAt: timestamp("archived_at"), // When the job was archived
  // Xero integration tracking
  isXeroImport: boolean("is_xero_import").default(false), // Whether job was imported from Xero
  xeroJobId: varchar("xero_job_id"), // Xero project/job ID
  xeroContactId: varchar("xero_contact_id"), // Xero contact ID for client mapping
  xeroQuoteId: varchar("xero_quote_id"), // Xero quote ID if associated
  xeroSyncedAt: timestamp("xero_synced_at"), // When job was last synced with Xero
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job Checklist Items
export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  text: text("text").notNull(),
  isCompleted: boolean("is_completed").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job Check-ins for location tracking
export const jobCheckins = pgTable("job_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('checkin'), // checkin, checkout
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }), // GPS accuracy in meters
  address: text("address"), // Reverse geocoded address
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type JobCheckin = typeof jobCheckins.$inferSelect;
export const insertJobCheckinSchema = createInsertSchema(jobCheckins).omit({ id: true, createdAt: true });
export type InsertJobCheckin = z.infer<typeof insertJobCheckinSchema>;

// Quotes
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('draft'), // draft, sent, accepted, declined
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  // Client acceptance tracking
  acceptanceToken: varchar("acceptance_token").unique(), // Secure token for public quote acceptance
  acceptedBy: text("accepted_by"), // Name of person who accepted
  acceptanceIp: text("acceptance_ip"), // IP address for audit trail
  declineReason: text("decline_reason"), // Optional reason if declined
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  familyKey: varchar("family_key"),
  // Deposit payment tracking
  depositRequired: boolean("deposit_required").default(false), // Whether deposit is required
  depositPercent: decimal("deposit_percent", { precision: 5, scale: 2 }), // Deposit percentage (e.g., 20.00 for 20%)
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }), // Calculated deposit amount
  depositPaid: boolean("deposit_paid").default(false), // Whether deposit has been paid
  depositPaidAt: timestamp("deposit_paid_at"), // When deposit was paid
  depositPaymentIntentId: varchar("deposit_payment_intent_id"), // Stripe payment intent ID
  archivedAt: timestamp("archived_at"), // When the quote was archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote Line Items
export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1.00'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  cost: decimal("cost", { precision: 10, scale: 2 }), // Optional cost per unit for profit margin calculation
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'set null' }),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('draft'), // draft, sent, paid, overdue
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  receiptSentAt: timestamp("receipt_sent_at"), // When payment receipt email was sent
  // Payment tracking
  paymentReference: text("payment_reference"), // Reference number for payment
  paymentMethod: text("payment_method"), // bank_transfer, cash, card, stripe
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  allowOnlinePayment: boolean("allow_online_payment").default(false), // Enable card payment via Stripe Connect
  paymentToken: text("payment_token").unique(), // Secure token for public payment URL
  stripePaymentLink: text("stripe_payment_link"), // Pre-generated Stripe checkout session URL
  notes: text("notes"),
  photos: jsonb("photos").default([]),
  templateId: varchar("template_id"),
  familyKey: varchar("family_key"),
  // Recurring invoice settings
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // weekly, fortnightly, monthly, quarterly, yearly
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  parentInvoiceId: varchar("parent_invoice_id"), // Links to original recurring invoice
  nextRecurrenceDate: timestamp("next_recurrence_date"),
  archivedAt: timestamp("archived_at"), // When the invoice was archived
  // Xero integration tracking
  xeroInvoiceId: varchar("xero_invoice_id"), // Xero invoice ID to prevent duplicate pushes
  xeroSyncedAt: timestamp("xero_synced_at"), // When invoice was last synced to Xero
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Line Items
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1.00'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Requests - for phone-to-phone payments (like ServiceM8's Scan & Pay)
export const paymentRequests = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  description: text("description").notNull(),
  reference: text("reference"), // Custom reference for tradie
  // Secure token for public access (QR code / link)
  token: text("token").notNull().unique(),
  // Status: pending, paid, expired, cancelled
  status: text("status").notNull().default('pending'),
  // Stripe payment tracking
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeClientSecret: text("stripe_client_secret"),
  // Payment completion
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"), // card, apple_pay, google_pay
  // Expiry and metadata
  expiresAt: timestamp("expires_at"), // Optional expiry time
  qrCodeUrl: text("qr_code_url"), // Generated QR code data URL
  notificationsSent: jsonb("notifications_sent").default([]), // Track SMS/email sent
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Receipts - professional receipts stored and linked to jobs
export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  paymentRequestId: varchar("payment_request_id").references(() => paymentRequests.id, { onDelete: 'set null' }),
  // Receipt identification
  receiptNumber: text("receipt_number").notNull().unique(), // Format: REC-0001
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default('0.00'),
  description: text("description"),
  paymentMethod: text("payment_method"), // card, tap_to_pay, bank_transfer, cash, qr_code
  paymentReference: text("payment_reference"), // External payment ID (Stripe, etc.)
  // Timestamps
  paidAt: timestamp("paid_at").notNull(),
  // PDF and signature
  pdfUrl: text("pdf_url"), // Stored PDF URL
  signatureUrl: text("signature_url"), // On-site signature capture
  // Delivery tracking
  emailSentAt: timestamp("email_sent_at"),
  smsSentAt: timestamp("sms_sent_at"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, createdAt: true });
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

// Document Templates  
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'job', 'quote', 'invoice'
  familyKey: varchar("family_key").notNull(), // Links quote and invoice templates
  name: text("name").notNull(),
  tradeType: text("trade_type").notNull(), // 'plumbing', 'electrical', etc.
  rateCardId: varchar("rate_card_id"),
  styling: json("styling").default({}), // { logoUrl?, brandColor? }
  sections: json("sections").default({}), // { showHeader, showLineItems, showTotals, showTerms, showSignature }
  defaults: json("defaults").default({}), // { title, description, terms, depositPct?, dueTermDays?, gstEnabled? }
  defaultLineItems: json("default_line_items").default([]), // [{ catalogItemId? | inline { description, qty, unitPrice }}]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Line Item Catalog
export const lineItemCatalog = pgTable("line_item_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tradeType: text("trade_type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(), // 'hour', 'item', 'm', 'sqm'
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  defaultQty: decimal("default_qty", { precision: 10, scale: 2 }).default('1.00'),
  tags: json("tags").default([]), // string[]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rate Cards
export const rateCards = pgTable("rate_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  tradeType: text("trade_type").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull().default('100.00'),
  calloutFee: decimal("callout_fee", { precision: 10, scale: 2 }).notNull().default('80.00'),
  materialMarkupPct: decimal("material_markup_pct", { precision: 5, scale: 2 }).default('20.00'),
  afterHoursMultiplier: decimal("after_hours_multiplier", { precision: 3, scale: 2 }).default('1.50'),
  gstEnabled: boolean("gst_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for inserts
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateChecklistItemSchema = insertChecklistItemSchema.omit({
  jobId: true, // Prevent jobId changes via updates
});
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type UpdateChecklistItem = z.infer<typeof updateChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  number: z.string().optional(), // Auto-generate if not provided
  status: z.string().optional(), // Default to 'draft' if not provided
  // Coerce date fields to handle both Date objects and ISO strings from frontend
  validUntil: z.coerce.date().optional(),
  // Coerce decimal fields to handle both string and number inputs from frontend
  subtotal: z.coerce.string().optional(),
  gstAmount: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Use preprocess for nullable decimal fields to bypass coercion for null values
  depositPercent: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
  depositAmount: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
});

export const updateQuoteSchema = insertQuoteSchema.partial().extend({
  sentAt: z.coerce.date().optional(),
  acceptedAt: z.coerce.date().optional(),
  rejectedAt: z.coerce.date().optional(),
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  // Coerce decimal fields to handle both string and number inputs from frontend
  quantity: z.coerce.string().optional(),
  unitPrice: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Cost is nullable - use preprocess to handle null values
  cost: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  number: z.string().optional(), // Auto-generate if not provided
  // Coerce date fields to handle both Date objects and ISO strings from frontend
  dueDate: z.coerce.date().optional(),
  // Coerce decimal fields to handle both string and number inputs from frontend
  subtotal: z.coerce.string().optional(),
  gstAmount: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
  // Use preprocess for nullable decimal fields to bypass coercion for null values
  amountPaid: z.preprocess(
    (v) => (v === null || v === undefined ? null : v),
    z.coerce.string().nullable()
  ).optional(),
});

export const updateInvoiceSchema = insertInvoiceSchema.partial().extend({
  sentAt: z.coerce.date().optional(),
  paidAt: z.coerce.date().optional(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  // Coerce decimal fields to handle both string and number inputs from frontend
  quantity: z.coerce.string().optional(),
  unitPrice: z.coerce.string().optional(),
  total: z.coerce.string().optional(),
});

// Payment Request schemas
export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({
  id: true,
  userId: true,
  token: true, // Generated server-side
  createdAt: true,
  updatedAt: true,
});

export const updatePaymentRequestSchema = insertPaymentRequestSchema.partial().extend({
  status: z.enum(['pending', 'paid', 'expired', 'cancelled']).optional(),
  paidAt: z.coerce.date().optional(),
});

// Types
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettings.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;

// Template system schemas
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLineItemCatalogSchema = createInsertSchema(lineItemCatalog).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRateCardSchema = createInsertSchema(rateCards).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Template system types
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

export type InsertLineItemCatalog = z.infer<typeof insertLineItemCatalogSchema>;
export type LineItemCatalog = typeof lineItemCatalog.$inferSelect;

export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type RateCard = typeof rateCards.$inferSelect;

// Template Analysis Jobs - for AI-powered template extraction from PDFs
export const templateAnalysisJobs = pgTable("template_analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateType: text("template_type").notNull(), // 'quote' | 'invoice'
  originalFileName: text("original_file_name").notNull(),
  originalFileKey: text("original_file_key").notNull(), // Object storage key
  status: text("status").notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  analysisResult: jsonb("analysis_result"), // GPT analysis output
  error: text("error"),
  createdTemplateId: varchar("created_template_id").references(() => documentTemplates.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateAnalysisJobSchema = createInsertSchema(templateAnalysisJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplateAnalysisJob = z.infer<typeof insertTemplateAnalysisJobSchema>;
export type TemplateAnalysisJob = typeof templateAnalysisJobs.$inferSelect;

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;

// ===== ADVANCED FEATURES SCHEMAS =====

// Inventory Management
export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").references(() => inventoryCategories.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  unit: text("unit").default('each'), // each, box, m, kg, etc.
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }),
  currentStock: integer("current_stock").default(0),
  minimumStock: integer("minimum_stock").default(0),
  maximumStock: integer("maximum_stock"),
  reorderLevel: integer("reorder_level").default(0),
  reorderQuantity: integer("reorder_quantity"),
  supplierId: varchar("supplier_id"),
  location: text("location"), // warehouse location/bin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'in', 'out', 'adjustment'
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  reference: text("reference"), // PO number, job reference, etc.
  notes: text("notes"),
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Time Tracking
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in minutes
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  description: text("description"),
  isBreak: boolean("is_break").default(false),
  isOvertime: boolean("is_overtime").default(false),
  approved: boolean("approved").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  // Origin tracking for geofence-triggered entries
  origin: text("origin").default('manual'), // manual, geofence
  geofenceEventId: varchar("geofence_event_id"), // Link to triggering geofence event
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timesheets = pgTable("timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStarting: timestamp("week_starting").notNull(),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).default('0.00'),
  regularHours: decimal("regular_hours", { precision: 10, scale: 2 }).default('0.00'),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }).default('0.00'),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default('0.00'),
  status: text("status").default('draft'), // draft, submitted, approved, paid
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expense Tracking
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").notNull().references(() => expenseCategories.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  description: text("description").notNull(),
  vendor: text("vendor"),
  receiptUrl: text("receipt_url"),
  receiptNumber: text("receipt_number"),
  expenseDate: timestamp("expense_date").notNull(),
  isBillable: boolean("is_billable").default(true),
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: text("recurring_frequency"), // monthly, quarterly, yearly
  status: text("status").default('pending'), // pending, approved, rejected, reimbursed
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Management
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  permissions: json("permissions").default([]), // ['read_jobs', 'write_jobs', 'manage_team', etc.]
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: varchar("member_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable for pending invites
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: 'cascade' }),
  // Invite functionality
  email: text("email").notNull(), // Email for invites (before user account exists)
  firstName: text("first_name"), // For display before account exists
  lastName: text("last_name"), // For display before account exists
  phone: text("phone"), // Phone number for direct calls
  inviteStatus: text("invite_status").notNull().default('pending'), // 'pending', 'accepted', 'declined'
  inviteToken: text("invite_token"), // Token for accepting invite
  inviteSentAt: timestamp("invite_sent_at"),
  inviteAcceptedAt: timestamp("invite_accepted_at"),
  // Custom permissions override - allows per-user permission customization by owner
  customPermissions: json("custom_permissions"), // null = use role defaults, [] = custom list
  useCustomPermissions: boolean("use_custom_permissions").default(false), // Whether to use custom or role permissions
  // Location tracking control
  allowLocationSharing: boolean("allow_location_sharing").default(true), // Whether this member shares their location with owner
  locationEnabledByOwner: boolean("location_enabled_by_owner").default(true), // Owner can disable location access for this member
  // Employment details
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const staffSchedules = pgTable("staff_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default('scheduled'), // scheduled, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Member Skills & Certifications - track qualifications with expiry dates
export const teamMemberSkills = pgTable("team_member_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  skillName: text("skill_name").notNull(), // e.g., "Electrical License", "White Card", "First Aid"
  skillType: text("skill_type").notNull().default('certification'), // 'certification', 'license', 'training', 'skill'
  licenseNumber: text("license_number"), // For licenses/certifications
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"), // null = no expiry
  isVerified: boolean("is_verified").default(false), // Owner has verified the documentation
  documentUrl: text("document_url"), // Uploaded proof document
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Member Availability - weekly work schedule preferences
export const teamMemberAvailability = pgTable("team_member_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  isAvailable: boolean("is_available").default(true),
  startTime: text("start_time").default('08:00'), // HH:MM format
  endTime: text("end_time").default('17:00'), // HH:MM format
  notes: text("notes"), // e.g., "school pickup at 3pm"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Member Time Off - leave requests and holidays
export const teamMemberTimeOff = pgTable("team_member_time_off", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(), // 'annual_leave', 'sick_leave', 'personal', 'public_holiday', 'other'
  status: text("status").default('pending'), // 'pending', 'approved', 'rejected'
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Member Performance Metrics - track productivity and ratings
export const teamMemberMetrics = pgTable("team_member_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: 'cascade' }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  jobsCompleted: integer("jobs_completed").default(0),
  jobsOnTime: integer("jobs_on_time").default(0), // Completed before deadline
  totalHoursWorked: decimal("total_hours_worked", { precision: 10, scale: 2 }).default('0'),
  averageJobDuration: decimal("average_job_duration", { precision: 10, scale: 2 }), // hours
  customerRatingSum: decimal("customer_rating_sum", { precision: 10, scale: 2 }).default('0'),
  customerRatingCount: integer("customer_rating_count").default(0),
  callbackRate: decimal("callback_rate", { precision: 5, scale: 2 }), // % of jobs requiring callback
  revenueGenerated: decimal("revenue_generated", { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// GPS Tracking - Life360-style location with battery and activity
export const locationTracking = pgTable("location_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  address: text("address"),
  speed: decimal("speed", { precision: 10, scale: 2 }), // km/h
  heading: decimal("heading", { precision: 10, scale: 2 }), // degrees 0-360
  altitude: decimal("altitude", { precision: 10, scale: 2 }),
  // Life360-style additions
  batteryLevel: integer("battery_level"), // 0-100 percentage
  isCharging: boolean("is_charging").default(false),
  activityType: text("activity_type").default('stationary'), // stationary, walking, driving, working
  timestamp: timestamp("timestamp").notNull(),
  trackingType: text("tracking_type").default('automatic'), // automatic, manual, job_site
  createdAt: timestamp("created_at").defaultNow(),
});

// Geofence Alerts - triggered when tradies enter/leave job sites
export const geofenceAlerts = pgTable("geofence_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  alertType: text("alert_type").notNull(), // 'arrival', 'departure'
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  address: text("address"),
  distanceFromSite: decimal("distance_from_site", { precision: 10, scale: 2 }), // meters
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tradie Status - current activity and presence
export const tradieStatus = pgTable("tradie_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Current location
  currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }),
  currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
  currentAddress: text("current_address"),
  // Activity
  activityStatus: text("activity_status").default('offline'), // online, driving, working, break, offline
  currentJobId: varchar("current_job_id").references(() => jobs.id, { onDelete: 'set null' }),
  // Device info
  batteryLevel: integer("battery_level"),
  isCharging: boolean("is_charging").default(false),
  speed: decimal("speed", { precision: 10, scale: 2 }), // km/h
  heading: decimal("heading", { precision: 10, scale: 2 }), // degrees
  // Timestamps
  lastSeenAt: timestamp("last_seen_at"),
  lastLocationUpdate: timestamp("last_location_update"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  jobIds: json("job_ids").default([]), // Array of job IDs for this route
  startAddress: text("start_address"),
  endAddress: text("end_address"),
  waypoints: json("waypoints").default([]), // Array of addresses
  distance: decimal("distance", { precision: 10, scale: 2 }), // in kilometers
  estimatedDuration: integer("estimated_duration"), // in minutes
  actualDuration: integer("actual_duration"), // in minutes
  optimizedOrder: json("optimized_order").default([]), // Optimized job order
  routeDate: timestamp("route_date"),
  status: text("status").default('saved'), // saved, planned, in_progress, completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Route schemas
export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

// Customer Portal
export const customerUsers = pgTable("customer_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerSessions = pgTable("customer_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerUserId: varchar("customer_user_id").notNull().references(() => customerUsers.id, { onDelete: 'cascade' }),
  sessionToken: text("session_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Equipment Management
export const equipmentCategories = pgTable("equipment_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").references(() => equipmentCategories.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model"),
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  warrantyProvider: text("warranty_provider"),
  location: text("location"),
  status: text("status").default('active'), // active, maintenance, retired, sold
  assignedTo: varchar("assigned_to").references(() => users.id),
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  equipmentId: varchar("equipment_id").notNull().references(() => equipment.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'scheduled', 'repair', 'inspection'
  title: text("title").notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  vendor: text("vendor"),
  performedBy: varchar("performed_by").references(() => users.id),
  status: text("status").default('scheduled'), // scheduled, in_progress, completed, cancelled
  nextDueDate: timestamp("next_due_date"),
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Assets - Equipment/systems installed at customer locations (Mrs Smith's AC unit)
export const clientAssets = pgTable("client_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // e.g., "Split System AC - Living Room"
  assetType: text("asset_type").notNull(), // 'hvac', 'hot_water', 'electrical', 'plumbing', 'solar', 'appliance', 'other'
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  installDate: timestamp("install_date"),
  installedBy: text("installed_by"), // Could be this tradie or another
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  warrantyProvider: text("warranty_provider"),
  warrantyNotes: text("warranty_notes"),
  location: text("location"), // Where in the property: "Kitchen", "Garage", "Unit 2"
  notes: text("notes"),
  specifications: json("specifications").default({}), // Flexible specs: capacity, kW rating, etc.
  photos: json("photos").default([]),
  documents: json("documents").default([]), // Manuals, warranty docs
  lastServiceDate: timestamp("last_service_date"),
  nextServiceDue: timestamp("next_service_due"),
  serviceIntervalMonths: integer("service_interval_months"), // e.g., 12 for annual service
  status: text("status").default('active'), // active, decommissioned, replaced
  replacedByAssetId: varchar("replaced_by_asset_id"), // Links to new asset if replaced
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Asset Service History - Track all work done on a client's asset
export const clientAssetServices = pgTable("client_asset_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: varchar("asset_id").notNull().references(() => clientAssets.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }), // Link to job if applicable
  serviceType: text("service_type").notNull(), // 'installation', 'maintenance', 'repair', 'inspection', 'replacement'
  title: text("title").notNull(),
  description: text("description"),
  serviceDate: timestamp("service_date").notNull(),
  performedBy: varchar("performed_by").references(() => users.id),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 5, scale: 2 }),
  partsUsed: json("parts_used").default([]), // [{ name, partNumber, quantity, cost }]
  findings: text("findings"), // What was found during inspection
  recommendations: text("recommendations"), // Suggested future work
  photos: json("photos").default([]),
  documents: json("documents").default([]),
  nextServiceDue: timestamp("next_service_due"), // Updates asset's next service date
  createdAt: timestamp("created_at").defaultNow(),
});

// Recurring Jobs & Contracts
export const recurringContracts = pgTable("recurring_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  contractValue: decimal("contract_value", { precision: 10, scale: 2 }),
  frequency: text("frequency").notNull(), // 'weekly', 'monthly', 'quarterly', 'yearly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  nextJobDate: timestamp("next_job_date").notNull(),
  autoCreateJobs: boolean("auto_create_jobs").default(true),
  autoSendInvoices: boolean("auto_send_invoices").default(false),
  jobTemplate: json("job_template").default({}),
  invoiceTemplate: json("invoice_template").default({}),
  status: text("status").default('active'), // active, paused, completed, cancelled
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recurringSchedules = pgTable("recurring_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => recurringContracts.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp("scheduled_date").notNull(),
  completedDate: timestamp("completed_date"),
  status: text("status").default('scheduled'), // scheduled, completed, skipped, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Digital Forms & Signatures
export const customForms = pgTable("custom_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  formType: text("form_type").default('general'), // 'general', 'safety', 'compliance', 'inspection'
  fields: json("fields").default([]), // Form field definitions
  settings: json("settings").default({}), // Form settings and styling
  requiresSignature: boolean("requires_signature").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").notNull().references(() => customForms.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  submittedBy: varchar("submitted_by").references(() => users.id),
  customerUserId: varchar("customer_user_id").references(() => customerUsers.id),
  submissionData: json("submission_data").default({}), // Form responses
  submittedAt: timestamp("submitted_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").default('submitted'), // submitted, reviewed, approved, rejected
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const digitalSignatures = pgTable("digital_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formSubmissionId: varchar("form_submission_id").references(() => formSubmissions.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  signerRole: text("signer_role").default('client'), // 'client', 'worker', 'owner'
  signatureData: text("signature_data").notNull(), // Base64 signature image
  signedAt: timestamp("signed_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'form', 'contract', 'job_completion'
  isValid: boolean("is_valid").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing Automation
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  templateType: text("template_type").default('custom'), // 'custom', 'follow_up', 'maintenance', 'review'
  targetAudience: text("target_audience").default('all_clients'), // 'all_clients', 'recent_jobs', 'overdue_invoices'
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  status: text("status").default('draft'), // 'draft', 'scheduled', 'sending', 'sent', 'cancelled'
  recipientCount: integer("recipient_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  bounceCount: integer("bounce_count").default(0),
  unsubscribeCount: integer("unsubscribe_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerSurveys = pgTable("customer_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  surveyType: text("survey_type").default('satisfaction'), // 'satisfaction', 'follow_up', 'feedback'
  questions: json("questions").default([]),
  responses: json("responses").default({}),
  overallRating: integer("overall_rating"), // 1-5 stars
  completedAt: timestamp("completed_at"),
  sentAt: timestamp("sent_at"),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  status: text("status").default('pending'), // 'pending', 'completed', 'expired'
  publicReviewPosted: boolean("public_review_posted").default(false),
  reviewPlatform: text("review_platform"), // 'google', 'facebook', 'custom'
  createdAt: timestamp("created_at").defaultNow(),
});

// Supplier Management
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  abn: text("abn"),
  accountNumber: text("account_number"),
  paymentTerms: text("payment_terms").default('Net 30'),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  notes: text("notes"),
  rating: integer("rating"), // 1-5 stars
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'cascade' }),
  poNumber: text("po_number").notNull(),
  orderDate: timestamp("order_date").defaultNow(),
  requiredDate: timestamp("required_date"),
  deliveryDate: timestamp("delivery_date"),
  status: text("status").default('pending'), // 'pending', 'approved', 'sent', 'received', 'cancelled'
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  total: decimal("total", { precision: 10, scale: 2 }).default('0.00'),
  terms: text("terms"),
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poId: varchar("po_id").notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  status: text("status").default('pending'), // 'pending', 'partial', 'received', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
});

// Advanced Reporting
export const reportConfigurations = pgTable("report_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(), // 'profit_loss', 'cash_flow', 'job_profitability', 'time_summary'
  filters: json("filters").default({}),
  groupBy: text("group_by"), // 'client', 'job_type', 'month', 'team_member'
  dateRange: json("date_range").default({}),
  chartType: text("chart_type").default('table'), // 'table', 'bar', 'line', 'pie'
  isScheduled: boolean("is_scheduled").default(false),
  scheduleFrequency: text("schedule_frequency"), // 'daily', 'weekly', 'monthly'
  emailRecipients: json("email_recipients").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").notNull().references(() => reportConfigurations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  reportData: json("report_data").default({}),
  generatedAt: timestamp("generated_at").defaultNow(),
  fileUrl: text("file_url"), // PDF/Excel export URL
  parameters: json("parameters").default({}),
  isAutoGenerated: boolean("is_auto_generated").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== ZOD SCHEMAS AND TYPES FOR ADVANCED FEATURES =====

// Time Tracking Schemas
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.preprocess(
    (val) => val ? new Date(val as string | number | Date) : undefined,
    z.date().optional()
  ), // Allow backend to set current time, accept string/Date
  endTime: z.preprocess(
    (val) => val ? new Date(val as string | number | Date) : undefined,
    z.date().optional()
  ), // Allow string/Date for end time
  hourlyRate: z.string().optional(), // Accept as string (decimal)
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Expense Tracking Schemas
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Inventory Management Schemas  
export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Team Management Schemas
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffScheduleSchema = createInsertSchema(staffSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Advanced Team Management Schemas
export const insertTeamMemberSkillSchema = createInsertSchema(teamMemberSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberAvailabilitySchema = createInsertSchema(teamMemberAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberTimeOffSchema = createInsertSchema(teamMemberTimeOff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberMetricsSchema = createInsertSchema(teamMemberMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// GPS Tracking Schemas
export const insertLocationTrackingSchema = createInsertSchema(locationTracking).omit({
  id: true,
  createdAt: true,
});

export const insertGeofenceAlertSchema = createInsertSchema(geofenceAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertTradieStatusSchema = createInsertSchema(tradieStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Customer Portal Schemas
export const insertCustomerUserSchema = createInsertSchema(customerUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Equipment Management Schemas
export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentMaintenanceSchema = createInsertSchema(equipmentMaintenance).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Client Assets Schemas
export const insertClientAssetSchema = createInsertSchema(clientAssets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientAssetServiceSchema = createInsertSchema(clientAssetServices).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Recurring Jobs Schemas
export const insertRecurringContractSchema = createInsertSchema(recurringContracts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecurringScheduleSchema = createInsertSchema(recurringSchedules).omit({
  id: true,
  createdAt: true,
});

// Digital Forms Schemas
export const insertCustomFormSchema = createInsertSchema(customForms).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertDigitalSignatureSchema = createInsertSchema(digitalSignatures).omit({
  id: true,
  createdAt: true,
});

// Marketing Automation Schemas
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSurveySchema = createInsertSchema(customerSurveys).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Supplier Management Schemas
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

// Advanced Reporting Schemas
export const insertReportConfigurationSchema = createInsertSchema(reportConfigurations).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
});

// ===== TYPES FOR ADVANCED FEATURES =====

// Time Tracking Types
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheets.$inferSelect;

// Expense Tracking Types
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Inventory Management Types
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;
export type InventoryCategory = typeof inventoryCategories.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

// Team Management Types
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertStaffSchedule = z.infer<typeof insertStaffScheduleSchema>;
export type StaffSchedule = typeof staffSchedules.$inferSelect;

// Advanced Team Management Types
export type InsertTeamMemberSkill = z.infer<typeof insertTeamMemberSkillSchema>;
export type TeamMemberSkill = typeof teamMemberSkills.$inferSelect;

export type InsertTeamMemberAvailability = z.infer<typeof insertTeamMemberAvailabilitySchema>;
export type TeamMemberAvailability = typeof teamMemberAvailability.$inferSelect;

export type InsertTeamMemberTimeOff = z.infer<typeof insertTeamMemberTimeOffSchema>;
export type TeamMemberTimeOff = typeof teamMemberTimeOff.$inferSelect;

export type InsertTeamMemberMetrics = z.infer<typeof insertTeamMemberMetricsSchema>;
export type TeamMemberMetrics = typeof teamMemberMetrics.$inferSelect;

// GPS Tracking Types
export type InsertLocationTracking = z.infer<typeof insertLocationTrackingSchema>;
export type LocationTracking = typeof locationTracking.$inferSelect;

export type InsertGeofenceAlert = z.infer<typeof insertGeofenceAlertSchema>;
export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;

export type InsertTradieStatus = z.infer<typeof insertTradieStatusSchema>;
export type TradieStatus = typeof tradieStatus.$inferSelect;

// Customer Portal Types
export type InsertCustomerUser = z.infer<typeof insertCustomerUserSchema>;
export type CustomerUser = typeof customerUsers.$inferSelect;

// Equipment Management Types
export type InsertEquipmentCategory = z.infer<typeof insertEquipmentCategorySchema>;
export type EquipmentCategory = typeof equipmentCategories.$inferSelect;

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

export type InsertEquipmentMaintenance = z.infer<typeof insertEquipmentMaintenanceSchema>;
export type EquipmentMaintenance = typeof equipmentMaintenance.$inferSelect;

// Client Assets Types
export type InsertClientAsset = z.infer<typeof insertClientAssetSchema>;
export type ClientAsset = typeof clientAssets.$inferSelect;

export type InsertClientAssetService = z.infer<typeof insertClientAssetServiceSchema>;
export type ClientAssetService = typeof clientAssetServices.$inferSelect;

// Recurring Jobs Types
export type InsertRecurringContract = z.infer<typeof insertRecurringContractSchema>;
export type RecurringContract = typeof recurringContracts.$inferSelect;

export type InsertRecurringSchedule = z.infer<typeof insertRecurringScheduleSchema>;
export type RecurringSchedule = typeof recurringSchedules.$inferSelect;

// Digital Forms Types
export type InsertCustomForm = z.infer<typeof insertCustomFormSchema>;
export type CustomForm = typeof customForms.$inferSelect;

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertDigitalSignature = z.infer<typeof insertDigitalSignatureSchema>;
export type DigitalSignature = typeof digitalSignatures.$inferSelect;

// Marketing Automation Types
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export type InsertCustomerSurvey = z.infer<typeof insertCustomerSurveySchema>;
export type CustomerSurvey = typeof customerSurveys.$inferSelect;

// Supplier Management Types
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Advanced Reporting Types
export type InsertReportConfiguration = z.infer<typeof insertReportConfigurationSchema>;
export type ReportConfiguration = typeof reportConfigurations.$inferSelect;

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

// Email Integration - Allows tradies to connect their own email accounts
export const emailIntegrations = pgTable("email_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(), // 'gmail', 'outlook', 'smtp'
  status: text("status").default('pending'), // 'pending', 'connected', 'error', 'disconnected'
  // For OAuth providers (Gmail, Outlook)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  // For SMTP
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"), // Encrypted
  smtpSecure: boolean("smtp_secure").default(true),
  // Email address used for sending
  emailAddress: text("email_address"),
  displayName: text("display_name"),
  // Tracking
  lastUsedAt: timestamp("last_used_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailIntegrationSchema = createInsertSchema(emailIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailIntegration = z.infer<typeof insertEmailIntegrationSchema>;
export type EmailIntegration = typeof emailIntegrations.$inferSelect;

// Email delivery logs - Track sent emails
export const emailDeliveryLogs = pgTable("email_delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  emailIntegrationId: varchar("email_integration_id").references(() => emailIntegrations.id, { onDelete: 'set null' }),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull(), // 'quote', 'invoice', 'receipt', 'reminder'
  relatedId: varchar("related_id"), // quote_id or invoice_id
  status: text("status").default('pending'), // 'pending', 'sent', 'delivered', 'failed', 'opened'
  sentVia: text("sent_via"), // 'gmail', 'outlook', 'smtp', 'sendgrid'
  messageId: text("message_id"), // Provider's message ID
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailDeliveryLogSchema = createInsertSchema(emailDeliveryLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailDeliveryLog = z.infer<typeof insertEmailDeliveryLogSchema>;
export type EmailDeliveryLog = typeof emailDeliveryLogs.$inferSelect;

// Job Photos - Proper table for photo attachments with metadata
export const jobPhotos = pgTable("job_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  objectStorageKey: text("object_storage_key").notNull(), // Path in object storage
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // In bytes
  mimeType: text("mime_type"),
  category: text("category").default('general'), // before, after, progress, damage, materials
  caption: text("caption"),
  takenAt: timestamp("taken_at"), // When photo was taken (from EXIF or user input)
  uploadedBy: varchar("uploaded_by").references(() => users.id), // Team member who uploaded
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotos).omit({
  id: true,
  createdAt: true,
});
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotos.$inferSelect;

// Voice Notes - Audio recordings attached to jobs
export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  objectStorageKey: text("object_storage_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type").default('audio/webm'),
  duration: integer("duration"), // Duration in seconds
  title: text("title"), // Optional title/label for the note
  transcription: text("transcription"), // AI transcription of the audio
  recordedBy: varchar("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
});
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;

// Job Documents - External PDF files (quotes/invoices from other sources)
export const jobDocuments = pgTable("job_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default('other'), // 'quote', 'invoice', 'other'
  fileName: text("file_name").notNull(),
  objectStorageKey: text("object_storage_key").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobDocumentSchema = createInsertSchema(jobDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertJobDocument = z.infer<typeof insertJobDocumentSchema>;
export type JobDocument = typeof jobDocuments.$inferSelect;

// Invoice Reminder Logs - Track sent reminders to avoid duplicates
export const invoiceReminderLogs = pgTable("invoice_reminder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reminderType: text("reminder_type").notNull(), // 7day, 14day, 30day, manual
  daysPastDue: integer("days_past_due"),
  sentVia: text("sent_via"), // email, sms, both
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  response: text("response"), // Any client response or action taken
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvoiceReminderLogSchema = createInsertSchema(invoiceReminderLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertInvoiceReminderLog = z.infer<typeof insertInvoiceReminderLogSchema>;
export type InvoiceReminderLog = typeof invoiceReminderLogs.$inferSelect;

// Stripe Connect Payouts - Track payouts to tradies
export const stripePayouts = pgTable("stripe_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  stripePayoutId: text("stripe_payout_id").unique(),
  stripeTransferId: text("stripe_transfer_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Amount paid to tradie
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // Platform's cut
  currency: text("currency").default('aud'),
  status: text("status").default('pending'), // pending, in_transit, paid, failed, canceled
  failureMessage: text("failure_message"),
  arrivalDate: timestamp("arrival_date"), // Expected arrival in bank
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStripePayoutSchema = createInsertSchema(stripePayouts).omit({
  id: true,
  createdAt: true,
});
export type InsertStripePayout = z.infer<typeof insertStripePayoutSchema>;
export type StripePayout = typeof stripePayouts.$inferSelect;

// Job Chat Messages - Communication for specific jobs
export const jobChat = pgTable("job_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  messageType: text("message_type").default('text'), // text, image, file, status_update
  attachmentUrl: text("attachment_url"), // URL for image/file attachments
  attachmentName: text("attachment_name"), // Original filename
  isSystemMessage: boolean("is_system_message").default(false), // For automated status updates
  readBy: jsonb("read_by").default([]), // Array of user IDs who have read this message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobChatSchema = createInsertSchema(jobChat).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobChat = z.infer<typeof insertJobChatSchema>;
export type JobChat = typeof jobChat.$inferSelect;

// Team Chat Messages - General team communication
export const teamChat = pgTable("team_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  messageType: text("message_type").default('text'), // text, image, file, announcement
  attachmentUrl: text("attachment_url"), // URL for image/file attachments
  attachmentName: text("attachment_name"), // Original filename
  isAnnouncement: boolean("is_announcement").default(false), // For important team announcements
  isPinned: boolean("is_pinned").default(false), // Pinned messages stay at top
  readBy: jsonb("read_by").default([]), // Array of user IDs who have read this message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeamChatSchema = createInsertSchema(teamChat).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeamChat = z.infer<typeof insertTeamChatSchema>;
export type TeamChat = typeof teamChat.$inferSelect;

// Direct Messages - Private conversations between team members
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // image, file, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// SMS Conversations - Two-way SMS with clients via Twilio
export const smsConversations = pgTable("sms_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  clientPhone: varchar("client_phone", { length: 20 }).notNull(),
  clientName: varchar("client_name", { length: 255 }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  isArchived: boolean("is_archived").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsConversationSchema = createInsertSchema(smsConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsConversation = z.infer<typeof insertSmsConversationSchema>;
export type SmsConversation = typeof smsConversations.$inferSelect;

// SMS Messages - Individual messages within conversations
export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => smsConversations.id, { onDelete: 'cascade' }),
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  body: text("body").notNull(),
  senderUserId: varchar("sender_user_id").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").default('pending'), // pending, sent, delivered, failed
  twilioSid: varchar("twilio_sid", { length: 50 }),
  errorMessage: text("error_message"),
  isQuickAction: boolean("is_quick_action").default(false),
  quickActionType: text("quick_action_type"), // on_my_way, job_finished, etc.
  // MMS support - array of media URLs (max 10 per Twilio MMS, each up to 5MB)
  mediaUrls: jsonb("media_urls").default([]), // Array of media attachment URLs
  // AI Intent Detection - for "Create Job from SMS" feature
  isJobRequest: boolean("is_job_request").default(false),
  intentConfidence: text("intent_confidence"), // 'high', 'medium', 'low'
  intentType: text("intent_type"), // 'quote_request', 'job_request', 'enquiry', 'followup', 'other'
  suggestedJobTitle: varchar("suggested_job_title", { length: 100 }),
  suggestedDescription: text("suggested_description"),
  jobCreatedFromSms: varchar("job_created_from_sms").references(() => jobs.id, { onDelete: 'set null' }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;

// Automation Rules - ServiceM8-style workflow automation
export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  trigger: jsonb("trigger").notNull(), // { type, entityType, fromStatus, toStatus, delayDays }
  actions: jsonb("actions").notNull().default([]), // [{ type, template, message, newStatus }]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// Automation Logs - Track processed automations to prevent duplicates
export const automationLogs = pgTable("automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => automations.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // job, quote, invoice
  entityId: varchar("entity_id").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  result: text("result"), // success, error
  errorMessage: text("error_message"),
}, (table) => ({
  uniqueAutomationEntity: unique().on(table.automationId, table.entityType, table.entityId),
}));

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  processedAt: true,
});
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;

// SMS Templates - Reusable message templates with merge fields
export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  category: text("category").default('general'), // general, booking, quote, invoice, reminder, arrival
  body: text("body").notNull(), // Template with merge fields like {client_name}, {job_title}
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;

// Message Templates - Unified email/SMS templates with merge fields
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  channel: varchar("channel", { length: 10 }).notNull(), // 'email' or 'sms'
  category: varchar("category", { length: 50 }).notNull(), // 'quote_follow_up', 'payment_reminder', 'job_booking', etc.
  name: varchar("name", { length: 100 }).notNull(),
  subject: text("subject"), // Only for email templates
  body: text("body").notNull(), // Template with merge fields like {client_name}, {job_title}
  isDefault: boolean("is_default").default(false), // System default templates
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMessageTemplateSchema = insertMessageTemplateSchema.partial().omit({
  userId: true,
  isDefault: true,
});

export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Template purposes - defines when a template is triggered
// Multiple templates can be active per family, but only one per purpose
export const BUSINESS_TEMPLATE_PURPOSES = [
  // Email purposes
  'quote_sent',
  'invoice_sent',
  'payment_reminder',
  'job_confirmation',
  'job_completed',
  'quote_accepted',
  'quote_declined',
  // SMS purposes
  'sms_quote_sent',
  'sms_invoice_sent',
  'sms_payment_reminder',
  'sms_job_confirmation',
  'sms_job_completed',
  // Document purposes (general/single use per family)
  'general',
] as const;
export type BusinessTemplatePurpose = typeof BUSINESS_TEMPLATE_PURPOSES[number];

// Business Templates - Unified template system for Templates Hub
// Supports multiple template families: terms_conditions, warranty, email, sms, safety_form, checklist, payment_notice
export const businessTemplates = pgTable("business_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  family: text("family").notNull(), // 'terms_conditions', 'warranty', 'email', 'sms', 'safety_form', 'checklist', 'payment_notice'
  purpose: text("purpose").default('general'), // When this template is used (quote_sent, invoice_sent, etc.)
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false), // System-provided default template
  isActive: boolean("is_active").default(true), // Currently selected for use
  subject: text("subject"), // For email templates
  content: text("content").notNull(), // Main template content (plain text or structured)
  contentHtml: text("content_html"), // HTML version for rich templates
  sections: jsonb("sections").default([]), // For multi-section templates (safety forms, checklists)
  mergeFields: text("merge_fields").array().default([]), // Available merge fields
  metadata: jsonb("metadata").default({}), // { validityDays, depositPercent, warrantyMonths, etc. }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessTemplateSchema = createInsertSchema(businessTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBusinessTemplateSchema = insertBusinessTemplateSchema.partial().omit({
  userId: true,
});

export type InsertBusinessTemplate = z.infer<typeof insertBusinessTemplateSchema>;
export type BusinessTemplate = typeof businessTemplates.$inferSelect;

// Template family type for validation
export const BUSINESS_TEMPLATE_FAMILIES = [
  'terms_conditions',
  'warranty',
  'email',
  'sms',
  'safety_form',
  'checklist',
  'payment_notice',
] as const;
export type BusinessTemplateFamily = typeof BUSINESS_TEMPLATE_FAMILIES[number];

// Purpose-family mapping: defines which purposes are valid for each template family
// This prevents misassignment (e.g., quote email template used for invoice)
export const FAMILY_PURPOSE_MAP: Record<BusinessTemplateFamily, readonly BusinessTemplatePurpose[]> = {
  email: ['quote_sent', 'invoice_sent', 'payment_reminder', 'job_confirmation', 'job_completed', 'quote_accepted', 'quote_declined'],
  sms: ['sms_quote_sent', 'sms_invoice_sent', 'sms_payment_reminder', 'sms_job_confirmation', 'sms_job_completed'],
  terms_conditions: ['general'],
  warranty: ['general'],
  safety_form: ['general'],
  checklist: ['general'],
  payment_notice: ['general'],
} as const;

// Helper function to validate purpose is valid for a given family
export function isValidPurposeForFamily(family: BusinessTemplateFamily, purpose: BusinessTemplatePurpose): boolean {
  const validPurposes = FAMILY_PURPOSE_MAP[family];
  return validPurposes?.includes(purpose) ?? false;
}

// Get valid purposes for a family
export function getValidPurposesForFamily(family: BusinessTemplateFamily): readonly BusinessTemplatePurpose[] {
  return FAMILY_PURPOSE_MAP[family] ?? ['general'];
}

// Human-readable purpose labels
export const PURPOSE_LABELS: Record<BusinessTemplatePurpose, string> = {
  quote_sent: 'Quote Sent',
  invoice_sent: 'Invoice Sent',
  payment_reminder: 'Payment Reminder',
  job_confirmation: 'Job Confirmation',
  job_completed: 'Job Completed',
  quote_accepted: 'Quote Accepted',
  quote_declined: 'Quote Declined',
  sms_quote_sent: 'Quote Sent (SMS)',
  sms_invoice_sent: 'Invoice Sent (SMS)',
  sms_payment_reminder: 'Payment Reminder (SMS)',
  sms_job_confirmation: 'Job Confirmation (SMS)',
  sms_job_completed: 'Job Completed (SMS)',
  general: 'General',
};

// SMS Booking Links - Unique links for clients to confirm/reschedule bookings
export const smsBookingLinks = pgTable("sms_booking_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(), // Secure random token for URL
  status: text("status").default('pending'), // pending, confirmed, rescheduled, expired, cancelled
  clientResponse: text("client_response"), // confirmed, reschedule_requested, cancelled
  clientNotes: text("client_notes"),
  expiresAt: timestamp("expires_at").notNull(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmsBookingLinkSchema = createInsertSchema(smsBookingLinks).omit({
  id: true,
  status: true,
  respondedAt: true,
  createdAt: true,
});
export type InsertSmsBookingLink = z.infer<typeof insertSmsBookingLinkSchema>;
export type SmsBookingLink = typeof smsBookingLinks.$inferSelect;

// SMS Tracking Links - Live arrival tracking for clients
export const smsTrackingLinks = pgTable("sms_tracking_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  teamMemberId: varchar("team_member_id").references(() => users.id, { onDelete: 'set null' }),
  businessOwnerId: varchar("business_owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  isActive: boolean("is_active").default(true),
  lastLocationLat: decimal("last_location_lat", { precision: 10, scale: 7 }),
  lastLocationLng: decimal("last_location_lng", { precision: 10, scale: 7 }),
  lastLocationAt: timestamp("last_location_at"),
  estimatedArrival: timestamp("estimated_arrival"),
  expiresAt: timestamp("expires_at").notNull(),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSmsTrackingLinkSchema = createInsertSchema(smsTrackingLinks).omit({
  id: true,
  isActive: true,
  lastLocationLat: true,
  lastLocationLng: true,
  lastLocationAt: true,
  viewCount: true,
  createdAt: true,
});
export type InsertSmsTrackingLink = z.infer<typeof insertSmsTrackingLinkSchema>;
export type SmsTrackingLink = typeof smsTrackingLinks.$inferSelect;

// SMS Automation Rules - Automated SMS sending rules
export const smsAutomationRules = pgTable("sms_automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  triggerType: text("trigger_type").notNull(), // quote_sent, invoice_sent, invoice_overdue, job_scheduled, job_day_before, quote_follow_up
  delayMinutes: integer("delay_minutes").default(0), // Delay before sending (0 = immediate)
  templateId: varchar("template_id").references(() => smsTemplates.id, { onDelete: 'set null' }),
  customMessage: text("custom_message"), // If no template, use this message
  conditions: jsonb("conditions").default({}), // Additional conditions like { minAmount: 100, jobStatus: 'scheduled' }
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsAutomationRuleSchema = createInsertSchema(smsAutomationRules).omit({
  id: true,
  lastTriggeredAt: true,
  triggerCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSmsAutomationRule = z.infer<typeof insertSmsAutomationRuleSchema>;
export type SmsAutomationRule = typeof smsAutomationRules.$inferSelect;

// SMS Automation Log - Track sent automated messages
export const smsAutomationLogs = pgTable("sms_automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull().references(() => smsAutomationRules.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // job, quote, invoice
  entityId: varchar("entity_id").notNull(),
  messageId: varchar("message_id").references(() => smsMessages.id, { onDelete: 'set null' }),
  status: text("status").default('sent'), // sent, failed, skipped
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueRuleEntity: unique().on(table.ruleId, table.entityType, table.entityId),
}));

export const insertSmsAutomationLogSchema = createInsertSchema(smsAutomationLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsAutomationLog = z.infer<typeof insertSmsAutomationLogSchema>;
export type SmsAutomationLog = typeof smsAutomationLogs.$inferSelect;

// ========================
// Xero Integration Tables
// ========================

// Xero Connections - OAuth tokens and connection info
export const xeroConnections = pgTable("xero_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull(),
  tenantName: varchar("tenant_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active'),
});

export const insertXeroConnectionSchema = createInsertSchema(xeroConnections).omit({
  id: true,
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertXeroConnection = z.infer<typeof insertXeroConnectionSchema>;
export type XeroConnection = typeof xeroConnections.$inferSelect;

// Xero Sync State - Track sync progress per entity type
export const xeroSyncState = pgTable("xero_sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar("entity_type").notNull(),
  lastSyncCursor: varchar("last_sync_cursor"),
  lastSyncAt: timestamp("last_sync_at"),
  syncDirection: varchar("sync_direction").default('bidirectional'),
});

export const insertXeroSyncStateSchema = createInsertSchema(xeroSyncState).omit({
  id: true,
});
export type InsertXeroSyncState = z.infer<typeof insertXeroSyncStateSchema>;
export type XeroSyncState = typeof xeroSyncState.$inferSelect;

// External Accounting IDs - Map local entities to Xero entities
export const externalAccountingIds = pgTable("external_accounting_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  localEntityType: varchar("local_entity_type").notNull(),
  localEntityId: varchar("local_entity_id").notNull(),
  provider: varchar("provider").notNull(),
  externalId: varchar("external_id").notNull(),
  syncStatus: varchar("sync_status").default('synced'),
  lastSyncAt: timestamp("last_sync_at"),
}, (table) => ({
  uniqueLocalEntity: unique().on(table.localEntityType, table.localEntityId, table.provider),
}));

export const insertExternalAccountingIdSchema = createInsertSchema(externalAccountingIds).omit({
  id: true,
});
export type InsertExternalAccountingId = z.infer<typeof insertExternalAccountingIdSchema>;
export type ExternalAccountingId = typeof externalAccountingIds.$inferSelect;

// ========================
// MYOB Integration Tables
// ========================

// MYOB Connections - OAuth tokens and connection info for MYOB AccountRight
export const myobConnections = pgTable("myob_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: varchar("business_id").notNull(), // Company File GUID from callback
  companyName: varchar("company_name"),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token").notNull(), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  cfUsername: text("cf_username"), // Company File username (encrypted)
  cfPassword: text("cf_password"), // Company File password (encrypted)
  scope: varchar("scope"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status").default('active'),
});

export const insertMyobConnectionSchema = createInsertSchema(myobConnections).omit({
  id: true,
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertMyobConnection = z.infer<typeof insertMyobConnectionSchema>;
export type MyobConnection = typeof myobConnections.$inferSelect;

// ========================
// Australian WHS Safety Form Templates
// ========================

export const SWMS_TEMPLATE_FIELDS = [
  { id: 'project_name', type: 'text', label: 'Project/Job Name', required: true },
  { id: 'location', type: 'text', label: 'Work Location/Address', required: true },
  { id: 'date', type: 'date', label: 'Date of Work', required: true },
  { id: 'section_scope', type: 'section', label: 'Scope of Work' },
  { id: 'work_description', type: 'textarea', label: 'Description of High Risk Work', required: true, description: 'Describe the construction work to be performed' },
  { id: 'section_hazards', type: 'section', label: 'Hazard Identification' },
  { id: 'hazards_identified', type: 'textarea', label: 'Hazards Identified', required: true, description: 'List all hazards associated with this work' },
  { id: 'risk_level', type: 'select', label: 'Initial Risk Level', required: true, options: ['Low', 'Medium', 'High', 'Extreme'] },
  { id: 'section_controls', type: 'section', label: 'Control Measures' },
  { id: 'elimination_controls', type: 'textarea', label: 'Elimination Controls', description: 'Can the hazard be eliminated?' },
  { id: 'substitution_controls', type: 'textarea', label: 'Substitution Controls', description: 'Can a safer alternative be used?' },
  { id: 'engineering_controls', type: 'textarea', label: 'Engineering Controls', description: 'Physical controls (barriers, ventilation, etc.)' },
  { id: 'admin_controls', type: 'textarea', label: 'Administrative Controls', description: 'Procedures, training, signage, etc.' },
  { id: 'ppe_required', type: 'textarea', label: 'PPE Required', required: true, description: 'List all required personal protective equipment' },
  { id: 'residual_risk', type: 'select', label: 'Residual Risk Level', required: true, options: ['Low', 'Medium', 'High', 'Extreme'] },
  { id: 'section_emergency', type: 'section', label: 'Emergency Procedures' },
  { id: 'emergency_contacts', type: 'textarea', label: 'Emergency Contacts', required: true },
  { id: 'first_aid_location', type: 'text', label: 'First Aid Kit Location' },
  { id: 'evacuation_point', type: 'text', label: 'Emergency Assembly Point' },
  { id: 'section_workers', type: 'section', label: 'Worker Acknowledgement' },
  { id: 'workers_briefed', type: 'checkbox', label: 'All workers have been briefed on this SWMS', required: true },
  { id: 'induction_completed', type: 'checkbox', label: 'Site induction completed' },
  { id: 'competency_verified', type: 'checkbox', label: 'Worker competencies verified' },
] as const;

export const JSA_TEMPLATE_FIELDS = [
  { id: 'job_title', type: 'text', label: 'Job/Task Title', required: true },
  { id: 'location', type: 'text', label: 'Location', required: true },
  { id: 'date', type: 'date', label: 'Date', required: true },
  { id: 'supervisor', type: 'text', label: 'Supervisor Name', required: true },
  { id: 'section_steps', type: 'section', label: 'Job Steps & Hazards' },
  { id: 'step_1', type: 'textarea', label: 'Step 1: Task Description', required: true },
  { id: 'step_1_hazards', type: 'textarea', label: 'Step 1: Potential Hazards' },
  { id: 'step_1_controls', type: 'textarea', label: 'Step 1: Control Measures' },
  { id: 'step_2', type: 'textarea', label: 'Step 2: Task Description' },
  { id: 'step_2_hazards', type: 'textarea', label: 'Step 2: Potential Hazards' },
  { id: 'step_2_controls', type: 'textarea', label: 'Step 2: Control Measures' },
  { id: 'step_3', type: 'textarea', label: 'Step 3: Task Description' },
  { id: 'step_3_hazards', type: 'textarea', label: 'Step 3: Potential Hazards' },
  { id: 'step_3_controls', type: 'textarea', label: 'Step 3: Control Measures' },
  { id: 'section_ppe', type: 'section', label: 'Required PPE' },
  { id: 'ppe_hardhat', type: 'checkbox', label: 'Hard Hat' },
  { id: 'ppe_safety_glasses', type: 'checkbox', label: 'Safety Glasses' },
  { id: 'ppe_hearing', type: 'checkbox', label: 'Hearing Protection' },
  { id: 'ppe_gloves', type: 'checkbox', label: 'Gloves' },
  { id: 'ppe_boots', type: 'checkbox', label: 'Safety Boots' },
  { id: 'ppe_hivis', type: 'checkbox', label: 'Hi-Vis Vest/Clothing' },
  { id: 'ppe_respirator', type: 'checkbox', label: 'Respirator/Dust Mask' },
  { id: 'ppe_other', type: 'text', label: 'Other PPE Required' },
  { id: 'section_acknowledgement', type: 'section', label: 'Acknowledgement' },
  { id: 'reviewed_by_all', type: 'checkbox', label: 'This JSA has been reviewed with all workers', required: true },
] as const;

export const SAFETY_FORM_TYPES = {
  swms: {
    name: 'Safe Work Method Statement (SWMS)',
    description: 'Required for high-risk construction work under WHS regulations',
    fields: SWMS_TEMPLATE_FIELDS,
    requiresSignature: true,
    formType: 'safety' as const,
  },
  jsa: {
    name: 'Job Safety Analysis (JSA)',
    description: 'Step-by-step hazard analysis for work tasks',
    fields: JSA_TEMPLATE_FIELDS,
    requiresSignature: true,
    formType: 'safety' as const,
  },
  toolbox_talk: {
    name: 'Toolbox Talk Record',
    description: 'Record of safety briefing conducted with workers',
    fields: [
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'topic', type: 'text', label: 'Topic Discussed', required: true },
      { id: 'presenter', type: 'text', label: 'Presented By', required: true },
      { id: 'attendees', type: 'textarea', label: 'Attendees (Names)', required: true },
      { id: 'key_points', type: 'textarea', label: 'Key Points Discussed', required: true },
      { id: 'actions', type: 'textarea', label: 'Actions Required' },
      { id: 'questions', type: 'textarea', label: 'Questions Raised' },
    ],
    requiresSignature: true,
    formType: 'safety' as const,
  },
  site_inspection: {
    name: 'Site Safety Inspection',
    description: 'Routine safety inspection checklist',
    fields: [
      { id: 'date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector', type: 'text', label: 'Inspector Name', required: true },
      { id: 'section_general', type: 'section', label: 'General Site Conditions' },
      { id: 'access_clear', type: 'checkbox', label: 'Access/egress routes clear' },
      { id: 'housekeeping', type: 'checkbox', label: 'Good housekeeping maintained' },
      { id: 'signage_adequate', type: 'checkbox', label: 'Safety signage adequate' },
      { id: 'first_aid_available', type: 'checkbox', label: 'First aid kit available and stocked' },
      { id: 'fire_extinguisher', type: 'checkbox', label: 'Fire extinguisher accessible' },
      { id: 'section_hazards', type: 'section', label: 'Hazard Checks' },
      { id: 'electrical_safe', type: 'checkbox', label: 'Electrical leads/equipment safe' },
      { id: 'fall_protection', type: 'checkbox', label: 'Fall protection in place (if required)' },
      { id: 'ppe_worn', type: 'checkbox', label: 'Workers wearing required PPE' },
      { id: 'plant_safe', type: 'checkbox', label: 'Plant/equipment safe and maintained' },
      { id: 'hazardous_materials', type: 'checkbox', label: 'Hazardous materials stored correctly' },
      { id: 'issues_found', type: 'textarea', label: 'Issues/Hazards Found' },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required' },
    ],
    requiresSignature: true,
    formType: 'inspection' as const,
  },
} as const;

export type SafetyFormType = keyof typeof SAFETY_FORM_TYPES;

// Job Reminders - Automated SMS/email notifications before job starts
export const jobReminders = pgTable("job_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('sms'), // sms, email, both
  sendAt: timestamp("send_at").notNull(), // When to send the reminder
  hoursBeforeJob: integer("hours_before_job").notNull().default(24), // 24h, 1h, etc.
  status: text("status").notNull().default('pending'), // pending, sent, failed, cancelled
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobReminderSchema = createInsertSchema(jobReminders).omit({ id: true, createdAt: true });
export type InsertJobReminder = z.infer<typeof insertJobReminderSchema>;
export type JobReminder = typeof jobReminders.$inferSelect;

// Job Photo Requirements - Require photos at specific stages
export const jobPhotoRequirements = pgTable("job_photo_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  stage: text("stage").notNull(), // before_start, during, after_completion
  description: text("description").notNull(),
  isRequired: boolean("is_required").default(true),
  isFulfilled: boolean("is_fulfilled").default(false),
  fulfilledAt: timestamp("fulfilled_at"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobPhotoRequirementSchema = createInsertSchema(jobPhotoRequirements).omit({ id: true, createdAt: true });
export type InsertJobPhotoRequirement = z.infer<typeof insertJobPhotoRequirementSchema>;
export type JobPhotoRequirement = typeof jobPhotoRequirements.$inferSelect;

// Defect Tracking - Track warranty work and defects
export const defects = pgTable("defects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default('medium'), // low, medium, high, critical
  status: text("status").notNull().default('reported'), // reported, acknowledged, in_progress, resolved, closed
  reportedBy: text("reported_by"), // Client name or staff member
  reportedAt: timestamp("reported_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  photos: jsonb("photos").default([]),
  resolutionNotes: text("resolution_notes"),
  warrantyClaimId: varchar("warranty_claim_id"), // Link to warranty if applicable
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDefectSchema = createInsertSchema(defects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defects.$inferSelect;

// Timesheet Approvals - Workflow for crew timesheets
export const timesheetApprovals = pgTable("timesheet_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('pending'), // pending, approved, rejected, revision_requested
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimesheetApprovalSchema = createInsertSchema(timesheetApprovals).omit({ id: true, createdAt: true });
export type InsertTimesheetApproval = z.infer<typeof insertTimesheetApprovalSchema>;
export type TimesheetApproval = typeof timesheetApprovals.$inferSelect;

// Automation Settings - Configure automatic behaviors
export const automationSettings = pgTable("automation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  // Job Reminders
  jobReminderEnabled: boolean("job_reminder_enabled").default(true),
  jobReminderHoursBefore: integer("job_reminder_hours_before").default(24),
  jobReminderType: text("job_reminder_type").default('sms'), // sms, email, both
  // Quote Reminders
  quoteFollowUpEnabled: boolean("quote_follow_up_enabled").default(true),
  quoteFollowUpDays: integer("quote_follow_up_days").default(3), // Days after sending to follow up
  // Invoice Reminders
  invoiceReminderEnabled: boolean("invoice_reminder_enabled").default(true),
  invoiceReminderDaysBeforeDue: integer("invoice_reminder_days_before_due").default(3),
  invoiceOverdueReminderDays: integer("invoice_overdue_reminder_days").default(7), // Days after overdue
  // Photo Requirements
  requirePhotoBeforeStart: boolean("require_photo_before_start").default(false),
  requirePhotoAfterComplete: boolean("require_photo_after_complete").default(false),
  // GPS Check-in
  autoCheckInOnArrival: boolean("auto_check_in_on_arrival").default(false),
  autoCheckOutOnDeparture: boolean("auto_check_out_on_departure").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationSettingsSchema = createInsertSchema(automationSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutomationSettings = z.infer<typeof insertAutomationSettingsSchema>;
export type AutomationSettings = typeof automationSettings.$inferSelect;
