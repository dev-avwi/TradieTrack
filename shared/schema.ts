import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, jsonb, index, unique } from "drizzle-orm/pg-core";
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
    jobsPerMonth: 5,
    invoicesPerMonth: 5,
    quotesPerMonth: 10,
    clients: 10,
    teamMembers: 0,
    photoStorage: 50, // MB
    templates: 3,
    features: ['basic_jobs', 'basic_invoices', 'basic_quotes'],
  },
  pro: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    clients: -1,
    teamMembers: -1,
    photoStorage: -1,
    templates: -1,
    features: ['unlimited_jobs', 'unlimited_invoices', 'recurring', 'reports', 'photo_attachments', 'auto_reminders', 'team_management', 'branding', 'ai_assistant'],
  },
  trial: {
    durationDays: 14,
  },
} as const;

// User storage table - Updated for Replit Auth compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // Keep existing UUID structure
  email: varchar("email").unique(), // Replit Auth provides email (can be null)
  username: text("username").unique(), // Keep for existing users, new users get this from email or generated
  password: text("password"), // Keep for backwards compatibility but make nullable
  googleId: varchar("google_id").unique(), // For Google OAuth linkage
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
  subscriptionTier: text("subscription_tier").default('free'), // free, pro, trial
  // Usage tracking
  jobsCreatedThisMonth: integer("jobs_created_this_month").default(0),
  invoicesCreatedThisMonth: integer("invoices_created_this_month").default(0),
  quotesCreatedThisMonth: integer("quotes_created_this_month").default(0),
  usageResetDate: timestamp("usage_reset_date").defaultNow(),
  // Trial tracking
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialStatus: text("trial_status"), // active, expired, converted
  // Legacy field kept for compatibility
  subscriptionResetDate: timestamp("subscription_reset_date").defaultNow(),
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
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
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
  subscriptionStatus: text("subscription_status").default('none'), // none, active, past_due, canceled
  currentPeriodEnd: timestamp("current_period_end"), // When current billing period ends
  // Digital Signature Settings
  defaultSignature: text("default_signature"), // Base64 encoded signature image for quotes/invoices
  signatureName: text("signature_name"), // Name displayed under signature
  includeSignatureOnQuotes: boolean("include_signature_on_quotes").default(false),
  includeSignatureOnInvoices: boolean("include_signature_on_invoices").default(false),
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false),
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

// Clients
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
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
  // Geofence settings for automatic time tracking
  geofenceEnabled: boolean("geofence_enabled").default(false),
  geofenceRadius: integer("geofence_radius").default(100), // Radius in meters (default 100m)
  geofenceAutoClockIn: boolean("geofence_auto_clock_in").default(false), // Auto-start timer on entry
  geofenceAutoClockOut: boolean("geofence_auto_clock_out").default(false), // Auto-stop timer on exit
  archivedAt: timestamp("archived_at"), // When the job was archived
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
  inviteStatus: text("invite_status").notNull().default('pending'), // 'pending', 'accepted', 'declined'
  inviteToken: text("invite_token"), // Token for accepting invite
  inviteSentAt: timestamp("invite_sent_at"),
  inviteAcceptedAt: timestamp("invite_accepted_at"),
  // Custom permissions override - allows per-user permission customization by owner
  customPermissions: json("custom_permissions"), // null = use role defaults, [] = custom list
  useCustomPermissions: boolean("use_custom_permissions").default(false), // Whether to use custom or role permissions
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
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  signatureData: text("signature_data").notNull(), // Base64 signature image
  signedAt: timestamp("signed_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'form', 'contract'
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
