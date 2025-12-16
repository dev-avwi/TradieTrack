import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, asc, sql, and, or, lt, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm";
import crypto from "crypto";
import {
  type User,
  type UpsertUser,
  type InsertUser,
  type BusinessSettings,
  type InsertBusinessSettings,
  type Client,
  type InsertClient,
  type Job,
  type InsertJob,
  type Quote,
  type InsertQuote,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type DocumentTemplate,
  type InsertDocumentTemplate,
  type LineItemCatalog,
  type InsertLineItemCatalog,
  type RateCard,
  type InsertRateCard,
  type IntegrationSettings,
  type InsertIntegrationSettings,
  type LoginCode,
  type InsertLoginCode,
  type ChecklistItem,
  type InsertChecklistItem,
  type PaymentRequest,
  type InsertPaymentRequest,
  // Advanced features types
  type TimeEntry,
  type InsertTimeEntry,
  type Timesheet,
  type InsertTimesheet,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type InventoryCategory,
  type InsertInventoryCategory,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type UserRole,
  type InsertUserRole,
  type TeamMember,
  type InsertTeamMember,
  type StaffSchedule,
  type InsertStaffSchedule,
  type LocationTracking,
  type InsertLocationTracking,
  type TradieStatus,
  type InsertTradieStatus,
  type GeofenceAlert,
  type InsertGeofenceAlert,
  type Route,
  type InsertRoute,
  type Notification,
  type InsertNotification,
  type PushToken,
  type InsertPushToken,
  type JobPhoto,
  type InsertJobPhoto,
  type VoiceNote,
  type InsertVoiceNote,
  type InvoiceReminderLog,
  type InsertInvoiceReminderLog,
  type DigitalSignature,
  type InsertDigitalSignature,
  type JobCheckin,
  type InsertJobCheckin,
  users,
  digitalSignatures,
  businessSettings,
  clients,
  jobs,
  quotes,
  quoteLineItems,
  invoices,
  invoiceLineItems,
  documentTemplates,
  lineItemCatalog,
  rateCards,
  integrationSettings,
  notifications,
  pushTokens,
  loginCodes,
  checklistItems,
  jobCheckins,
  paymentRequests,
  timeEntries,
  timesheets,
  expenseCategories,
  expenses,
  inventoryCategories,
  inventoryItems,
  inventoryTransactions,
  userRoles,
  teamMembers,
  staffSchedules,
  locationTracking,
  tradieStatus,
  geofenceAlerts,
  routes,
  jobPhotos,
  voiceNotes,
  invoiceReminderLogs,
  jobChat,
  teamChat,
  directMessages,
  automations,
  automationLogs,
  type JobChat,
  type InsertJobChat,
  type TeamChat,
  type InsertTeamChat,
  type DirectMessage,
  type InsertDirectMessage,
  type Automation,
  type InsertAutomation,
  type AutomationLog,
  type CustomForm,
  type InsertCustomForm,
  type FormSubmission,
  type InsertFormSubmission,
  customForms,
  formSubmissions,
  smsConversations,
  smsMessages,
  smsTemplates,
  smsAutomationRules,
  smsAutomationLogs,
  smsBookingLinks,
  smsTrackingLinks,
  type SmsConversation,
  type InsertSmsConversation,
  type SmsMessage,
  type InsertSmsMessage,
  type SmsTemplate,
  type InsertSmsTemplate,
  type SmsAutomationRule,
  type InsertSmsAutomationRule,
  type SmsAutomationLog,
  type InsertSmsAutomationLog,
  type SmsBookingLink,
  type InsertSmsBookingLink,
  type SmsTrackingLink,
  type InsertSmsTrackingLink,
  xeroConnections,
  xeroSyncState,
  externalAccountingIds,
  type XeroConnection,
  type InsertXeroConnection,
  type XeroSyncState,
  type InsertXeroSyncState,
  type ExternalAccountingId,
  type InsertExternalAccountingId,
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Replit Auth required methods
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserJobCount(id: string, count: number): Promise<User | undefined>;
  resetUserJobCount(id: string, nextResetDate: Date): Promise<User | undefined>;
  linkGoogleAccount(userId: string, googleId: string): Promise<void>;

  // Login Codes (Passwordless Email Auth)
  createLoginCode(email: string, code: string): Promise<void>;
  getLoginCode(email: string, code: string): Promise<{ id: string; email: string; verified: boolean; expiresAt: Date } | undefined>;
  getLatestLoginCodeForEmail(email: string): Promise<{ id: string; email: string; code: string; verified: boolean; expiresAt: Date; createdAt: Date } | undefined>;
  verifyLoginCodeAndCreateUser(email: string, code: string): Promise<User | null>;
  cleanupExpiredCodes(): Promise<void>;

  // Business Settings
  getBusinessSettings(userId: string): Promise<BusinessSettings | undefined>;
  createBusinessSettings(settings: InsertBusinessSettings): Promise<BusinessSettings>;
  updateBusinessSettings(userId: string, settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings | undefined>;

  // Integration Settings
  getIntegrationSettings(userId: string): Promise<IntegrationSettings | undefined>;
  createIntegrationSettings(settings: InsertIntegrationSettings & { userId: string }): Promise<IntegrationSettings>;
  updateIntegrationSettings(userId: string, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
  dismissNotification(id: string, userId: string): Promise<Notification | undefined>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  // Push Tokens (Mobile App)
  getPushTokens(userId: string): Promise<PushToken[]>;
  registerPushToken(token: InsertPushToken): Promise<PushToken>;
  deactivatePushToken(tokenId: string, userId: string): Promise<boolean>;
  deactivatePushTokenByValue(token: string, userId: string): Promise<boolean>;

  // Platform Stats (for trust signals)
  getPlatformStats(): Promise<{ userCount: number; quotesCount: number; paidInvoicesCount: number }>;

  // Clients
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string, userId: string): Promise<Client | undefined>;
  getClientById(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, userId: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string, userId: string): Promise<boolean>;

  // Jobs
  getJobs(userId: string, includeArchived?: boolean): Promise<Job[]>;
  getJob(id: string, userId: string): Promise<Job | undefined>;
  getJobPublic(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, userId: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string, userId: string): Promise<boolean>;
  getJobsForClient(clientId: string, userId: string): Promise<Job[]>;
  getJobsByAssignee(assigneeId: string): Promise<Job[]>;
  archiveJob(id: string, userId: string): Promise<Job | undefined>;
  unarchiveJob(id: string, userId: string): Promise<Job | undefined>;

  // Checklist Items
  getChecklistItems(jobId: string, userId: string): Promise<ChecklistItem[]>;
  createChecklistItem(item: InsertChecklistItem, userId: string): Promise<ChecklistItem>;
  updateChecklistItem(id: string, userId: string, item: Partial<Omit<InsertChecklistItem, 'jobId'>>): Promise<ChecklistItem | undefined>;
  deleteChecklistItem(id: string, userId: string): Promise<boolean>;

  // Job Check-ins (Location Tracking)
  getJobCheckins(jobId: string, userId: string): Promise<JobCheckin[]>;
  createJobCheckin(checkin: InsertJobCheckin): Promise<JobCheckin>;
  getLatestCheckin(jobId: string, userId: string): Promise<JobCheckin | undefined>;

  // Quotes
  getQuotes(userId: string, includeArchived?: boolean): Promise<Quote[]>;
  getQuote(id: string, userId: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string, userId: string): Promise<boolean>;
  getQuoteWithLineItems(id: string, userId: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined>;
  archiveQuote(id: string, userId: string): Promise<Quote | undefined>;
  unarchiveQuote(id: string, userId: string): Promise<Quote | undefined>;
  // Public quote access (for client acceptance flow)
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  getQuoteWithLineItemsByToken(token: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined>;
  acceptQuoteByToken(token: string, acceptedBy: string, acceptanceIp: string): Promise<Quote | undefined>;
  declineQuoteByToken(token: string, declineReason?: string): Promise<Quote | undefined>;
  generateQuoteAcceptanceToken(id: string, userId: string): Promise<string | null>;
  updateQuoteByToken(token: string, updates: Partial<Quote>): Promise<Quote | undefined>;

  // Quote Line Items
  getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]>;
  createQuoteLineItem(lineItem: InsertQuoteLineItem, userId?: string): Promise<QuoteLineItem>;
  updateQuoteLineItem(id: string, lineItem: Partial<InsertQuoteLineItem>, userId?: string): Promise<QuoteLineItem | undefined>;
  deleteQuoteLineItem(id: string, userId?: string): Promise<boolean>;

  // Invoices
  getInvoices(userId: string, includeArchived?: boolean): Promise<Invoice[]>;
  getInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, userId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string, userId: string): Promise<boolean>;
  getInvoiceWithLineItems(id: string, userId: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined>;
  archiveInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  unarchiveInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  // Public invoice access (for payment page)
  getInvoiceByPaymentToken(token: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined>;
  updateInvoiceByToken(token: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getBusinessSettingsByUserId(userId: string): Promise<BusinessSettings | undefined>;
  getBusinessSettingsByConnectAccountId(accountId: string): Promise<BusinessSettings | undefined>;

  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem, userId?: string): Promise<InvoiceLineItem>;
  updateInvoiceLineItem(id: string, lineItem: Partial<InsertInvoiceLineItem>, userId?: string): Promise<InvoiceLineItem | undefined>;
  deleteInvoiceLineItem(id: string, userId?: string): Promise<boolean>;

  // Payment Requests (phone-to-phone payments)
  getPaymentRequests(userId: string): Promise<PaymentRequest[]>;
  getPaymentRequest(id: string, userId: string): Promise<PaymentRequest | undefined>;
  getPaymentRequestByToken(token: string): Promise<PaymentRequest | undefined>;
  createPaymentRequest(request: InsertPaymentRequest & { userId: string; token: string }): Promise<PaymentRequest>;
  updatePaymentRequest(id: string, userId: string, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  updatePaymentRequestByToken(token: string, updates: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  deletePaymentRequest(id: string, userId: string): Promise<boolean>;

  // Document Templates
  getDocumentTemplates(userId: string, type?: string, tradeType?: string): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | null>;
  createDocumentTemplate(data: InsertDocumentTemplate & { userId: string }): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate>;
  deleteDocumentTemplate(id: string): Promise<void>;

  // Line Item Catalog
  getLineItemCatalog(userId: string, tradeType?: string): Promise<LineItemCatalog[]>;
  getLineItemCatalogItem(id: string): Promise<LineItemCatalog | null>;
  createLineItemCatalogItem(data: InsertLineItemCatalog & { userId: string }): Promise<LineItemCatalog>;
  updateLineItemCatalogItem(id: string, data: Partial<InsertLineItemCatalog>): Promise<LineItemCatalog>;
  deleteLineItemCatalogItem(id: string): Promise<void>;

  // Rate Cards
  getRateCards(userId: string, tradeType?: string): Promise<RateCard[]>;
  getRateCard(id: string): Promise<RateCard | null>;
  createRateCard(data: InsertRateCard & { userId: string }): Promise<RateCard>;
  updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard>;
  deleteRateCard(id: string): Promise<void>;

  // Utility methods
  generateQuoteNumber(userId: string): Promise<string>;
  generateInvoiceNumber(userId: string): Promise<string>;

  // ===== ADVANCED FEATURES METHODS =====
  
  // Time Tracking
  getTimeEntries(userId: string, jobId?: string): Promise<TimeEntry[]>;
  getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry & { userId: string }): Promise<TimeEntry>;
  updateTimeEntry(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string, userId: string): Promise<boolean>;
  stopTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined>;
  getActiveTimeEntry(userId: string): Promise<TimeEntry | undefined>;
  
  // Timesheets
  getTimesheets(userId: string): Promise<Timesheet[]>;
  getTimesheet(id: string, userId: string): Promise<Timesheet | undefined>;
  createTimesheet(timesheet: InsertTimesheet & { userId: string }): Promise<Timesheet>;
  updateTimesheet(id: string, userId: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  
  // Expense Tracking
  getExpenseCategories(userId: string): Promise<ExpenseCategory[]>;
  createExpenseCategory(category: InsertExpenseCategory & { userId: string }): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, userId: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string, userId: string): Promise<boolean>;
  
  getExpenses(userId: string, filters?: { jobId?: string; categoryId?: string; startDate?: string; endDate?: string; }): Promise<any[]>;
  getExpense(id: string, userId: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense & { userId: string }): Promise<Expense>;
  updateExpense(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string, userId: string): Promise<boolean>;
  
  // Inventory Management
  getInventoryCategories(userId: string): Promise<InventoryCategory[]>;
  createInventoryCategory(category: InsertInventoryCategory & { userId: string }): Promise<InventoryCategory>;
  updateInventoryCategory(id: string, userId: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory | undefined>;
  deleteInventoryCategory(id: string, userId: string): Promise<boolean>;
  
  getInventoryItems(userId: string, categoryId?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string, userId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem & { userId: string }): Promise<InventoryItem>;
  updateInventoryItem(id: string, userId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string, userId: string): Promise<boolean>;
  
  getInventoryTransactions(userId: string, itemId?: string): Promise<InventoryTransaction[]>;
  createInventoryTransaction(transaction: InsertInventoryTransaction & { userId: string }): Promise<InventoryTransaction>;
  
  // Team Management
  getUserRoles(): Promise<UserRole[]>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: string, role: Partial<InsertUserRole>): Promise<UserRole | undefined>;
  deleteUserRole(id: string): Promise<boolean>;
  
  getTeamMembers(businessOwnerId: string): Promise<TeamMember[]>;
  getTeamMember(id: string, businessOwnerId: string): Promise<TeamMember | undefined>;
  getTeamMembershipByMemberId(memberId: string): Promise<TeamMember | undefined>;
  getTeamMemberByUserIdAndBusiness(userId: string, businessOwnerId: string): Promise<TeamMember | undefined>;
  getUserRole(id: string): Promise<UserRole | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, businessOwnerId: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  updateTeamMemberPermissions(id: string, permissions: { customPermissions: string[], useCustomPermissions: boolean }): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string, businessOwnerId: string): Promise<boolean>;
  
  getStaffSchedules(userId: string, jobId?: string): Promise<StaffSchedule[]>;
  createStaffSchedule(schedule: InsertStaffSchedule): Promise<StaffSchedule>;
  updateStaffSchedule(id: string, userId: string, schedule: Partial<InsertStaffSchedule>): Promise<StaffSchedule | undefined>;
  deleteStaffSchedule(id: string, userId: string): Promise<boolean>;
  
  // GPS Tracking
  getLocationTracking(userId: string, jobId?: string): Promise<LocationTracking[]>;
  createLocationTracking(location: InsertLocationTracking & { userId: string }): Promise<LocationTracking>;
  
  getRoutes(userId: string): Promise<Route[]>;
  getRoute(id: string, userId: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, userId: string, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: string, userId: string): Promise<boolean>;

  // Team-level time tracking methods
  getActiveTimeEntryForJob(jobId: string): Promise<TimeEntry | undefined>;
  getAllActiveTimeEntries(): Promise<TimeEntry[]>;

  // Digital Signatures
  createDigitalSignature(signature: Omit<InsertDigitalSignature, 'id' | 'createdAt'>): Promise<DigitalSignature>;
  getDigitalSignatureByQuoteId(quoteId: string): Promise<DigitalSignature | undefined>;

  // Job Chat
  getJobChatMessages(jobId: string): Promise<JobChat[]>;
  createJobChatMessage(message: InsertJobChat): Promise<JobChat>;
  markJobChatAsRead(jobId: string, userId: string): Promise<void>;
  getUnreadJobChatCount(jobId: string, userId: string): Promise<number>;
  deleteJobChatMessage(id: string, userId: string): Promise<boolean>;
  forceDeleteJobChatMessage(id: string, jobId: string, businessOwnerId: string): Promise<boolean>;

  // Team Chat
  getTeamChatMessages(businessOwnerId: string): Promise<TeamChat[]>;
  createTeamChatMessage(message: InsertTeamChat): Promise<TeamChat>;
  markTeamChatAsRead(businessOwnerId: string, userId: string): Promise<void>;
  getUnreadTeamChatCount(businessOwnerId: string, userId: string): Promise<number>;
  pinTeamChatMessage(id: string, businessOwnerId: string, pinned: boolean): Promise<TeamChat | undefined>;
  deleteTeamChatMessage(id: string, senderId: string): Promise<boolean>;
  forceDeleteTeamChatMessage(id: string, businessOwnerId: string): Promise<boolean>;

  // Automations
  getAutomations(userId: string): Promise<Automation[]>;
  getAutomation(id: string, userId: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation & { userId: string }): Promise<Automation>;
  updateAutomation(id: string, userId: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(id: string, userId: string): Promise<boolean>;
  getAllUsersWithAutomations(): Promise<string[]>;
  
  // Automation Logs
  hasAutomationProcessed(automationId: string, entityType: string, entityId: string): Promise<boolean>;
  logAutomationProcessed(automationId: string, entityType: string, entityId: string, result: string, errorMessage?: string): Promise<void>;
  getAutomationLogs(userId: string, limit?: number): Promise<AutomationLog[]>;

  // Custom Forms
  getCustomForms(userId: string): Promise<CustomForm[]>;
  getCustomForm(id: string, userId: string): Promise<CustomForm | undefined>;
  createCustomForm(form: InsertCustomForm & { userId: string }): Promise<CustomForm>;
  updateCustomForm(id: string, userId: string, form: Partial<InsertCustomForm>): Promise<CustomForm | undefined>;
  deleteCustomForm(id: string, userId: string): Promise<boolean>;

  // Form Submissions
  getFormSubmissions(formId: string, userId: string): Promise<FormSubmission[]>;
  getFormSubmissionsByJob(jobId: string, userId: string): Promise<FormSubmission[]>;
  getFormSubmission(id: string, userId: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  updateFormSubmission(id: string, userId: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined>;
  deleteFormSubmission(id: string, userId: string): Promise<boolean>;

  // SMS Conversations
  getSmsConversation(id: string): Promise<SmsConversation | undefined>;
  getSmsConversationByPhone(businessOwnerId: string, clientPhone: string): Promise<SmsConversation | undefined>;
  getSmsConversationsByBusiness(businessOwnerId: string): Promise<SmsConversation[]>;
  getSmsConversationsByClientPhone(clientPhone: string): Promise<SmsConversation[]>;
  getSmsConversationsByJobIds(jobIds: string[]): Promise<SmsConversation[]>;
  createSmsConversation(conversation: InsertSmsConversation): Promise<SmsConversation>;
  updateSmsConversation(id: string, updates: Partial<InsertSmsConversation>): Promise<SmsConversation>;

  // SMS Messages  
  getSmsMessages(conversationId: string): Promise<SmsMessage[]>;
  createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage>;
  updateSmsMessage(id: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage>;
  markSmsMessagesAsRead(conversationId: string): Promise<void>;

  // SMS Templates
  getSmsTemplates(userId: string): Promise<SmsTemplate[]>;
  getSmsTemplate(id: string, userId: string): Promise<SmsTemplate | undefined>;
  createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate>;
  updateSmsTemplate(id: string, userId: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate>;
  deleteSmsTemplate(id: string, userId: string): Promise<boolean>;
  incrementSmsTemplateUsage(id: string): Promise<void>;

  // SMS Automation Rules
  getSmsAutomationRules(userId: string): Promise<SmsAutomationRule[]>;
  getSmsAutomationRule(id: string, userId: string): Promise<SmsAutomationRule | undefined>;
  createSmsAutomationRule(data: InsertSmsAutomationRule): Promise<SmsAutomationRule>;
  updateSmsAutomationRule(id: string, userId: string, data: Partial<InsertSmsAutomationRule>): Promise<SmsAutomationRule>;
  deleteSmsAutomationRule(id: string, userId: string): Promise<boolean>;
  getSmsAutomationRulesByTrigger(userId: string, triggerType: string): Promise<SmsAutomationRule[]>;

  // SMS Automation Logs
  createSmsAutomationLog(data: InsertSmsAutomationLog): Promise<SmsAutomationLog>;
  getSmsAutomationLog(ruleId: string, entityType: string, entityId: string): Promise<SmsAutomationLog | undefined>;

  // SMS Booking Links
  createSmsBookingLink(data: InsertSmsBookingLink): Promise<SmsBookingLink>;
  getSmsBookingLinkByToken(token: string): Promise<SmsBookingLink | undefined>;
  updateSmsBookingLink(id: string, data: Partial<SmsBookingLink>): Promise<SmsBookingLink>;

  // SMS Tracking Links (Live Arrival Tracking)
  createSmsTrackingLink(data: InsertSmsTrackingLink): Promise<SmsTrackingLink>;
  getSmsTrackingLinkByToken(token: string): Promise<SmsTrackingLink | undefined>;
  getSmsTrackingLinkByJobId(jobId: string): Promise<SmsTrackingLink | undefined>;
  updateSmsTrackingLink(id: string, data: Partial<SmsTrackingLink>): Promise<SmsTrackingLink>;
  incrementTrackingLinkViews(id: string): Promise<void>;
  deactivateSmsTrackingLink(id: string): Promise<void>;

  // Xero Integration
  getXeroConnection(userId: string): Promise<XeroConnection | undefined>;
  createXeroConnection(data: InsertXeroConnection): Promise<XeroConnection>;
  updateXeroConnection(id: string, data: Partial<XeroConnection>): Promise<XeroConnection | undefined>;
  deleteXeroConnection(userId: string): Promise<boolean>;
}

// Initialize database connection
const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client);

export class PostgresStorage implements IStorage {
  // Replit Auth required methods
  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserJobCount(id: string, count: number): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ jobsCreatedThisMonth: count, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async resetUserJobCount(id: string, nextResetDate: Date): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        jobsCreatedThisMonth: 0,
        subscriptionResetDate: nextResetDate,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token))
      .limit(1);
    return result[0];
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token))
      .limit(1);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return result[0];
  }

  async linkGoogleAccount(userId: string, googleId: string): Promise<void> {
    await db
      .update(users)
      .set({ googleId: googleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Login Codes (Passwordless Email Auth)
  async createLoginCode(email: string, code: string): Promise<void> {
    // Invalidate any existing codes for this email
    await db
      .delete(loginCodes)
      .where(eq(loginCodes.email, email.toLowerCase()));

    // Create new code with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db.insert(loginCodes).values({
      email: email.toLowerCase(),
      code,
      expiresAt,
      verified: false,
    });
  }

  async getLoginCode(email: string, code: string): Promise<{ id: string; email: string; verified: boolean; expiresAt: Date } | undefined> {
    const result = await db
      .select()
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.email, email.toLowerCase()),
          eq(loginCodes.code, code)
        )
      )
      .limit(1);
    
    if (!result[0]) return undefined;
    
    return {
      id: result[0].id,
      email: result[0].email,
      verified: result[0].verified ?? false,
      expiresAt: result[0].expiresAt,
    };
  }

  async getLatestLoginCodeForEmail(email: string): Promise<{ id: string; email: string; code: string; verified: boolean; expiresAt: Date; createdAt: Date } | undefined> {
    const result = await db
      .select()
      .from(loginCodes)
      .where(eq(loginCodes.email, email.toLowerCase()))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    return {
      id: result[0].id,
      email: result[0].email,
      code: result[0].code,
      verified: result[0].verified ?? false,
      expiresAt: result[0].expiresAt,
      createdAt: result[0].createdAt,
    };
  }

  async verifyLoginCodeAndCreateUser(email: string, code: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();
    
    // Wrap entire verification flow in a transaction for atomicity
    return await db.transaction(async (tx) => {
      // Atomically mark code as verified ONLY if it's not already used and not expired
      // This provides row-level locking and prevents concurrent use
      const updatedCodeResult = await tx
        .update(loginCodes)
        .set({ verified: true })
        .where(and(
          eq(loginCodes.email, normalizedEmail),
          eq(loginCodes.code, code),
          eq(loginCodes.verified, false)
        ))
        .returning();
      
      // If no rows updated, code is invalid, already used, or doesn't exist
      if (updatedCodeResult.length === 0) return null;
      
      const loginCode = updatedCodeResult[0];
      
      // Check expiry after securing the row
      if (new Date() > loginCode.expiresAt) {
        // Clean up expired code
        await tx.delete(loginCodes).where(eq(loginCodes.id, loginCode.id));
        return null;
      }
      
      // Find existing user or create new one
      const existingUserResult = await tx
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      
      let user = existingUserResult[0];
      
      if (!user) {
        // Create new user for email-based auth
        const username = normalizedEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 7);
        const newUserResult = await tx.insert(users).values({
          email: normalizedEmail,
          username: username,
          emailVerified: true,
          password: null,
        }).returning();
        user = newUserResult[0];
      } else {
        // Update existing user to mark email as verified
        const updatedUserResult = await tx
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUserResult[0];
      }
      
      // Delete used code (cleanup)
      await tx.delete(loginCodes).where(eq(loginCodes.id, loginCode.id));
      
      return user;
    });
  }

  async cleanupExpiredCodes(): Promise<void> {
    await db
      .delete(loginCodes)
      .where(lt(loginCodes.expiresAt, new Date()));
  }

  // Business Settings
  async getBusinessSettings(userId: string): Promise<BusinessSettings | undefined> {
    const result = await db.select().from(businessSettings).where(eq(businessSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createBusinessSettings(settings: InsertBusinessSettings & { userId: string }): Promise<BusinessSettings> {
    const result = await db.insert(businessSettings).values(settings).returning();
    return result[0];
  }

  async updateBusinessSettings(userId: string, settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings | undefined> {
    const result = await db
      .update(businessSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(businessSettings.userId, userId))
      .returning();
    return result[0];
  }

  // Integration Settings
  async getIntegrationSettings(userId: string): Promise<IntegrationSettings | undefined> {
    const result = await db.select().from(integrationSettings).where(eq(integrationSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createIntegrationSettings(settings: InsertIntegrationSettings & { userId: string }): Promise<IntegrationSettings> {
    const result = await db.insert(integrationSettings).values(settings).returning();
    return result[0];
  }

  async updateIntegrationSettings(userId: string, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined> {
    const result = await db
      .update(integrationSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(integrationSettings.userId, userId))
      .returning();
    return result[0];
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.dismissed, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result.rowCount || 0;
  }

  async dismissNotification(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ dismissed: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return result.rowCount > 0;
  }

  // Push Tokens (Mobile App)
  async getPushTokens(userId: string): Promise<PushToken[]> {
    return await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));
  }

  async registerPushToken(token: InsertPushToken): Promise<PushToken> {
    // First, check if this token already exists
    const existing = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token.token))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing token to be active and update lastUsedAt
      const updated = await db
        .update(pushTokens)
        .set({ 
          isActive: true, 
          lastUsedAt: new Date(),
          userId: token.userId // In case user changed
        })
        .where(eq(pushTokens.token, token.token))
        .returning();
      return updated[0];
    }
    
    // Create new token
    const result = await db.insert(pushTokens).values(token).returning();
    return result[0];
  }

  async deactivatePushToken(tokenId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(and(eq(pushTokens.id, tokenId), eq(pushTokens.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deactivatePushTokenByValue(token: string, userId: string): Promise<boolean> {
    const result = await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Platform Stats (for trust signals)
  async getPlatformStats(): Promise<{ userCount: number; quotesCount: number; paidInvoicesCount: number }> {
    try {
      const [userResult, quotesResult, invoicesResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(quotes),
        db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.status, 'paid')),
      ]);
      
      return {
        userCount: Number(userResult[0]?.count || 0),
        quotesCount: Number(quotesResult[0]?.count || 0),
        paidInvoicesCount: Number(invoicesResult[0]?.count || 0),
      };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return { userCount: 0, quotesCount: 0, paidInvoicesCount: 0 };
    }
  }

  // Clients
  async getClients(userId: string): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string, userId: string): Promise<Client | undefined> {
    const result = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .limit(1);
    return result[0];
  }

  // Get client by ID only (for public access like quote acceptance)
  async getClientById(id: string): Promise<Client | undefined> {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return result[0];
  }

  async createClient(client: InsertClient & { userId: string }): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: string, userId: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteClient(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)));
    return result.rowCount > 0;
  }

  // Jobs
  async getJobs(userId: string, includeArchived?: boolean): Promise<Job[]> {
    if (includeArchived) {
      return await db.select().from(jobs).where(and(eq(jobs.userId, userId), isNotNull(jobs.archivedAt))).orderBy(desc(jobs.createdAt));
    }
    return await db.select().from(jobs).where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt))).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getJobPublic(id: string): Promise<Job | undefined> {
    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    return result[0];
  }

  async createJob(job: InsertJob & { userId: string }): Promise<Job> {
    const result = await db.insert(jobs).values(job).returning();
    return result[0];
  }

  async updateJob(id: string, userId: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const updateData: any = { ...job, updatedAt: new Date() };
    if (job.photos && Array.isArray(job.photos)) {
      updateData.photos = job.photos;
    }
    
    const result = await db
      .update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteJob(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    return result.rowCount > 0;
  }

  async getJobsForClient(clientId: string, userId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.clientId, clientId), eq(jobs.userId, userId)))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByAssignee(assigneeId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.assignedTo, assigneeId))
      .orderBy(desc(jobs.createdAt));
  }

  async archiveJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .update(jobs)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .update(jobs)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return result[0];
  }

  // Checklist Items
  async getChecklistItems(jobId: string, userId: string): Promise<ChecklistItem[]> {
    // First verify the job belongs to the user
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.jobId, jobId))
      .orderBy(asc(checklistItems.sortOrder), asc(checklistItems.createdAt));
  }

  async createChecklistItem(item: InsertChecklistItem, userId: string): Promise<ChecklistItem> {
    // Verify the job belongs to the user before creating checklist item
    const job = await this.getJob(item.jobId, userId);
    if (!job) {
      throw new Error("Job not found or access denied");
    }
    
    // Auto-calculate sortOrder server-side to prevent ordering manipulation
    const existingItems = await db
      .select({ sortOrder: checklistItems.sortOrder })
      .from(checklistItems)
      .where(eq(checklistItems.jobId, item.jobId))
      .orderBy(desc(checklistItems.sortOrder))
      .limit(1);
    
    const maxSortOrder = existingItems[0]?.sortOrder ?? -1;
    const serverSortOrder = maxSortOrder + 1;
    
    // Ignore client-provided sortOrder and use server-calculated value
    const safeItem = {
      jobId: item.jobId,
      text: item.text,
      isCompleted: item.isCompleted ?? false,
      sortOrder: serverSortOrder,
    };
    
    const result = await db.insert(checklistItems).values(safeItem).returning();
    return result[0];
  }

  async updateChecklistItem(id: string, userId: string, item: Partial<Omit<InsertChecklistItem, 'jobId'>>): Promise<ChecklistItem | undefined> {
    // First get the checklist item to find its job
    const existingItem = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .limit(1);
    
    if (!existingItem[0]) return undefined;
    
    // Verify the job belongs to the user
    const job = await this.getJob(existingItem[0].jobId, userId);
    if (!job) return undefined;
    
    // Strict whitelist: only allow specific fields to prevent privilege escalation
    const safeUpdates: Partial<{
      text: string;
      isCompleted: boolean;
      sortOrder: number;
    }> = {};
    
    if (item.text !== undefined) safeUpdates.text = item.text;
    if (item.isCompleted !== undefined && item.isCompleted !== null) {
      safeUpdates.isCompleted = item.isCompleted;
    }
    if (item.sortOrder !== undefined && item.sortOrder !== null) {
      // Validate sortOrder: must be non-negative and within reasonable bounds
      if (item.sortOrder < 0 || item.sortOrder > 9999) {
        throw new Error("Invalid sortOrder: must be between 0 and 9999");
      }
      safeUpdates.sortOrder = item.sortOrder;
    }
    
    const result = await db
      .update(checklistItems)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(checklistItems.id, id))
      .returning();
    return result[0];
  }

  async deleteChecklistItem(id: string, userId: string): Promise<boolean> {
    // First get the checklist item to find its job
    const existingItem = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .limit(1);
    
    if (!existingItem[0]) return false;
    
    // Verify the job belongs to the user
    const job = await this.getJob(existingItem[0].jobId, userId);
    if (!job) return false;
    
    const result = await db.delete(checklistItems).where(eq(checklistItems.id, id));
    return result.rowCount > 0;
  }

  // Job Check-ins (Location Tracking)
  async getJobCheckins(jobId: string, userId: string): Promise<JobCheckin[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(jobCheckins)
      .where(eq(jobCheckins.jobId, jobId))
      .orderBy(desc(jobCheckins.createdAt));
  }

  async createJobCheckin(checkin: InsertJobCheckin): Promise<JobCheckin> {
    const [newCheckin] = await db.insert(jobCheckins).values(checkin).returning();
    return newCheckin;
  }

  async getLatestCheckin(jobId: string, userId: string): Promise<JobCheckin | undefined> {
    const checkins = await db
      .select()
      .from(jobCheckins)
      .where(and(eq(jobCheckins.jobId, jobId), eq(jobCheckins.userId, userId)))
      .orderBy(desc(jobCheckins.createdAt))
      .limit(1);
    return checkins[0];
  }

  // Quotes
  async getQuotes(userId: string, includeArchived?: boolean): Promise<Quote[]> {
    if (includeArchived) {
      return await db.select().from(quotes).where(and(eq(quotes.userId, userId), isNotNull(quotes.archivedAt))).orderBy(desc(quotes.createdAt));
    }
    return await db.select().from(quotes).where(and(eq(quotes.userId, userId), isNull(quotes.archivedAt))).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createQuote(quote: InsertQuote & { userId: string }): Promise<Quote> {
    // Ensure number is provided
    const quoteData = {
      ...quote,
      number: quote.number || await this.generateQuoteNumber(quote.userId)
    };
    const result = await db.insert(quotes).values(quoteData).returning();
    return result[0];
  }

  async updateQuote(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteQuote(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
    return result.rowCount > 0;
  }

  async getQuoteWithLineItems(id: string, userId: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined> {
    const quote = await this.getQuote(id, userId);
    if (!quote) return undefined;
    
    const lineItems = await this.getQuoteLineItems(id);
    return { ...quote, lineItems };
  }

  async archiveQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    return result[0];
  }

  // Public quote access by token (no auth required)
  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    const result = await db
      .select()
      .from(quotes)
      .where(eq(quotes.acceptanceToken, token))
      .limit(1);
    return result[0];
  }

  async getQuoteWithLineItemsByToken(token: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined> {
    const quote = await this.getQuoteByToken(token);
    if (!quote) return undefined;
    
    const lineItems = await this.getQuoteLineItems(quote.id);
    return { ...quote, lineItems };
  }

  async acceptQuoteByToken(token: string, acceptedBy: string, acceptanceIp: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy,
        acceptanceIp,
        updatedAt: new Date()
      })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  async declineQuoteByToken(token: string, declineReason?: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ 
        status: 'declined',
        rejectedAt: new Date(),
        declineReason: declineReason || null,
        updatedAt: new Date()
      })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  async generateQuoteAcceptanceToken(id: string, userId: string): Promise<string | null> {
    // Generate a shorter but still secure token (12 chars alphanumeric)
    // 54^12 = ~2.3e20 possibilities - still very secure
    // Excludes ambiguous chars: 0/O, 1/I/l to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars[bytes[i] % chars.length];
    }
    
    const result = await db
      .update(quotes)
      .set({ acceptanceToken: token, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    
    return result[0] ? token : null;
  }

  async updateQuoteByToken(token: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  // Quote Line Items
  async getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
    return await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(quoteLineItems.sortOrder);
  }

  async createQuoteLineItem(lineItem: InsertQuoteLineItem, userId?: string): Promise<QuoteLineItem> {
    // Validate ownership if userId provided
    if (userId) {
      const quote = await this.getQuote(lineItem.quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db.insert(quoteLineItems).values(lineItem).returning();
    return result[0];
  }

  async updateQuoteLineItem(id: string, lineItem: Partial<InsertQuoteLineItem>, userId?: string): Promise<QuoteLineItem | undefined> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(quoteLineItems).where(eq(quoteLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Quote line item not found');
      }
      const quote = await this.getQuote(existing[0].quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db
      .update(quoteLineItems)
      .set(lineItem)
      .where(eq(quoteLineItems.id, id))
      .returning();
    return result[0];
  }

  async deleteQuoteLineItem(id: string, userId?: string): Promise<boolean> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(quoteLineItems).where(eq(quoteLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Quote line item not found');
      }
      const quote = await this.getQuote(existing[0].quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db.delete(quoteLineItems).where(eq(quoteLineItems.id, id));
    return result.rowCount > 0;
  }

  // Invoices
  async getInvoices(userId: string, includeArchived?: boolean): Promise<Invoice[]> {
    if (includeArchived) {
      return await db.select().from(invoices).where(and(eq(invoices.userId, userId), isNotNull(invoices.archivedAt))).orderBy(desc(invoices.createdAt));
    }
    return await db.select().from(invoices).where(and(eq(invoices.userId, userId), isNull(invoices.archivedAt))).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createInvoice(invoice: InsertInvoice & { userId: string }): Promise<Invoice> {
    // Ensure number is provided
    const invoiceData = {
      ...invoice,
      number: invoice.number || await this.generateInvoiceNumber(invoice.userId)
    };
    const result = await db.insert(invoices).values(invoiceData).returning();
    return result[0];
  }

  async updateInvoice(id: string, userId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInvoice(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
    return result.rowCount > 0;
  }

  async getInvoiceWithLineItems(id: string, userId: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined> {
    const invoice = await this.getInvoice(id, userId);
    if (!invoice) return undefined;
    
    const lineItems = await this.getInvoiceLineItems(id);
    return { ...invoice, lineItems };
  }

  async archiveInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return result[0];
  }

  // Public invoice access by payment token
  async getInvoiceByPaymentToken(token: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined> {
    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentToken, token))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    const lineItems = await this.getInvoiceLineItems(result[0].id);
    return { ...result[0], lineItems };
  }

  async updateInvoiceByToken(token: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.paymentToken, token))
      .returning();
    return result[0];
  }

  async getBusinessSettingsByUserId(userId: string): Promise<BusinessSettings | undefined> {
    // This is the same as getBusinessSettings but exposed for public routes
    return this.getBusinessSettings(userId);
  }

  async getBusinessSettingsByConnectAccountId(accountId: string): Promise<BusinessSettings | undefined> {
    const result = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.stripeConnectAccountId, accountId))
      .limit(1);
    return result[0];
  }

  // Invoice Line Items
  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.sortOrder);
  }

  async createInvoiceLineItem(lineItem: InsertInvoiceLineItem, userId?: string): Promise<InvoiceLineItem> {
    // Validate ownership if userId provided
    if (userId) {
      const invoice = await this.getInvoice(lineItem.invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db.insert(invoiceLineItems).values(lineItem).returning();
    return result[0];
  }

  async updateInvoiceLineItem(id: string, lineItem: Partial<InsertInvoiceLineItem>, userId?: string): Promise<InvoiceLineItem | undefined> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Invoice line item not found');
      }
      const invoice = await this.getInvoice(existing[0].invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db
      .update(invoiceLineItems)
      .set(lineItem)
      .where(eq(invoiceLineItems.id, id))
      .returning();
    return result[0];
  }

  async deleteInvoiceLineItem(id: string, userId?: string): Promise<boolean> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Invoice line item not found');
      }
      const invoice = await this.getInvoice(existing[0].invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id));
    return result.rowCount > 0;
  }

  // Payment Requests (phone-to-phone payments)
  async getPaymentRequests(userId: string): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequest(id: string, userId: string): Promise<PaymentRequest | undefined> {
    const result = await db
      .select()
      .from(paymentRequests)
      .where(and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getPaymentRequestByToken(token: string): Promise<PaymentRequest | undefined> {
    const result = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.token, token))
      .limit(1);
    return result[0];
  }

  async createPaymentRequest(request: InsertPaymentRequest & { userId: string; token: string }): Promise<PaymentRequest> {
    const result = await db.insert(paymentRequests).values(request).returning();
    return result[0];
  }

  async updatePaymentRequest(id: string, userId: string, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const result = await db
      .update(paymentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId)))
      .returning();
    return result[0];
  }

  async updatePaymentRequestByToken(token: string, updates: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const result = await db
      .update(paymentRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentRequests.token, token))
      .returning();
    return result[0];
  }

  async deletePaymentRequest(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(paymentRequests).where(
      and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId))
    );
    return result.rowCount > 0;
  }

  // Utility methods
  async generateQuoteNumber(userId: string): Promise<string> {
    const settings = await this.getBusinessSettings(userId);
    const prefix = settings?.quotePrefix || 'QT-';
    
    const year = new Date().getFullYear();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotes)
      .where(and(
        eq(quotes.userId, userId),
        sql`EXTRACT(YEAR FROM created_at) = ${year}`
      ));
    
    const count = result[0]?.count || 0;
    const nextNumber = count + 1;
    
    return `${prefix}${year}-${nextNumber.toString().padStart(3, '0')}`;
  }

  async generateInvoiceNumber(userId: string): Promise<string> {
    const settings = await this.getBusinessSettings(userId);
    const prefix = settings?.invoicePrefix || 'TT-';
    
    const year = new Date().getFullYear();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        sql`EXTRACT(YEAR FROM created_at) = ${year}`
      ));
    
    const count = result[0]?.count || 0;
    const nextNumber = count + 1;
    
    return `${prefix}${year}-${nextNumber.toString().padStart(3, '0')}`;
  }

  // Document Templates implementation
  async getDocumentTemplates(userId: string, type?: string, tradeType?: string): Promise<DocumentTemplate[]> {
    // Only return user-specific templates or shared templates - no cross-user data leakage
    const baseCondition = or(
      eq(documentTemplates.userId, userId),
      eq(documentTemplates.userId, 'shared')
    );
    
    if (type && tradeType) {
      const conditions = and(baseCondition, eq(documentTemplates.type, type), eq(documentTemplates.tradeType, tradeType));
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    } else if (type) {
      const conditions = and(baseCondition, eq(documentTemplates.type, type));
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    } else if (tradeType) {
      const conditions = and(baseCondition, eq(documentTemplates.tradeType, tradeType));
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    }
    
    return await db.select().from(documentTemplates).where(baseCondition).orderBy(desc(documentTemplates.createdAt));
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
    const result = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).limit(1);
    return result[0] || null;
  }

  async createDocumentTemplate(data: InsertDocumentTemplate & { userId: string }): Promise<DocumentTemplate> {
    const result = await db.insert(documentTemplates).values(data).returning();
    return result[0];
  }

  async updateDocumentTemplate(id: string, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate> {
    const result = await db
      .update(documentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  // Line Item Catalog implementation
  async getLineItemCatalog(userId: string, tradeType?: string): Promise<LineItemCatalog[]> {
    // Look for both user-specific catalog items AND shared items (userId = 'shared')
    const baseCondition = or(eq(lineItemCatalog.userId, userId), eq(lineItemCatalog.userId, 'shared'));
    const condition = tradeType 
      ? and(baseCondition, eq(lineItemCatalog.tradeType, tradeType))
      : baseCondition;
    
    return await db.select().from(lineItemCatalog).where(condition).orderBy(desc(lineItemCatalog.createdAt));
  }

  async getLineItemCatalogItem(id: string): Promise<LineItemCatalog | null> {
    const result = await db.select().from(lineItemCatalog).where(eq(lineItemCatalog.id, id)).limit(1);
    return result[0] || null;
  }

  async createLineItemCatalogItem(data: InsertLineItemCatalog & { userId: string }): Promise<LineItemCatalog> {
    const result = await db.insert(lineItemCatalog).values(data).returning();
    return result[0];
  }

  async updateLineItemCatalogItem(id: string, data: Partial<InsertLineItemCatalog>): Promise<LineItemCatalog> {
    const result = await db
      .update(lineItemCatalog)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lineItemCatalog.id, id))
      .returning();
    return result[0];
  }

  async deleteLineItemCatalogItem(id: string): Promise<void> {
    await db.delete(lineItemCatalog).where(eq(lineItemCatalog.id, id));
  }

  // Rate Cards implementation
  async getRateCards(userId: string, tradeType?: string): Promise<RateCard[]> {
    // Look for both user-specific rate cards AND shared cards (userId = 'shared')
    const baseCondition = or(eq(rateCards.userId, userId), eq(rateCards.userId, 'shared'));
    const condition = tradeType 
      ? and(baseCondition, eq(rateCards.tradeType, tradeType))
      : baseCondition;
    
    return await db.select().from(rateCards).where(condition).orderBy(desc(rateCards.createdAt));
  }

  async getRateCard(id: string): Promise<RateCard | null> {
    const result = await db.select().from(rateCards).where(eq(rateCards.id, id)).limit(1);
    return result[0] || null;
  }

  async createRateCard(data: InsertRateCard & { userId: string }): Promise<RateCard> {
    const result = await db.insert(rateCards).values(data).returning();
    return result[0];
  }

  async updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard> {
    const result = await db
      .update(rateCards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rateCards.id, id))
      .returning();
    return result[0];
  }

  async deleteRateCard(id: string): Promise<void> {
    await db.delete(rateCards).where(eq(rateCards.id, id));
  }


  // ===== ADVANCED FEATURES IMPLEMENTATIONS =====

  // Time Tracking
  async getTimeEntries(userId: string, jobId?: string): Promise<TimeEntry[]> {
    if (jobId) {
      return await db.select().from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), eq(timeEntries.jobId, jobId)))
        .orderBy(desc(timeEntries.startTime));
    }
    return await db.select().from(timeEntries)
      .where(eq(timeEntries.userId, userId))
      .orderBy(desc(timeEntries.startTime));
  }

  async getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createTimeEntry(entry: InsertTimeEntry & { userId: string }): Promise<TimeEntry> {
    const result = await db.insert(timeEntries).values(entry as any).returning();
    return result[0];
  }

  async updateTimeEntry(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const result = await db.update(timeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteTimeEntry(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
    return result.rowCount > 0;
  }

  async stopTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined> {
    const now = new Date();
    const entry = await this.getTimeEntry(id, userId);
    if (!entry || entry.endTime) return undefined;
    
    const startTime = new Date(entry.startTime);
    const duration = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60)); // duration in minutes
    
    return await this.updateTimeEntry(id, userId, {
      endTime: now,
      duration: duration
    });
  }

  async getActiveTimeEntry(userId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.userId, userId),
        sql`${timeEntries.endTime} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getActiveTimeEntryForJob(jobId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.jobId, jobId),
        sql`${timeEntries.endTime} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getAllActiveTimeEntries(): Promise<TimeEntry[]> {
    const result = await db.select().from(timeEntries)
      .where(sql`${timeEntries.endTime} IS NULL`)
      .orderBy(desc(timeEntries.startTime));
    return result;
  }

  // Timesheets
  async getTimesheets(userId: string): Promise<Timesheet[]> {
    return await db.select().from(timesheets)
      .where(eq(timesheets.userId, userId))
      .orderBy(desc(timesheets.weekStarting));
  }

  async getTimesheet(id: string, userId: string): Promise<Timesheet | undefined> {
    const result = await db.select().from(timesheets)
      .where(and(eq(timesheets.id, id), eq(timesheets.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createTimesheet(timesheet: InsertTimesheet & { userId: string }): Promise<Timesheet> {
    const result = await db.insert(timesheets).values(timesheet).returning();
    return result[0];
  }

  async updateTimesheet(id: string, userId: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const result = await db.update(timesheets)
      .set({ ...timesheet, updatedAt: new Date() })
      .where(and(eq(timesheets.id, id), eq(timesheets.userId, userId)))
      .returning();
    return result[0];
  }

  // Expense Tracking
  async getExpenseCategories(userId: string): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories)
      .where(eq(expenseCategories.userId, userId))
      .orderBy(expenseCategories.name);
  }

  async createExpenseCategory(category: InsertExpenseCategory & { userId: string }): Promise<ExpenseCategory> {
    const result = await db.insert(expenseCategories).values(category).returning();
    return result[0];
  }

  async updateExpenseCategory(id: string, userId: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const result = await db.update(expenseCategories)
      .set(category)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteExpenseCategory(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(expenseCategories)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)));
    return result.rowCount > 0;
  }

  async getExpenses(userId: string, filters?: { jobId?: string; categoryId?: string; startDate?: string; endDate?: string; }): Promise<any[]> {
    let query = db.select({
      id: expenses.id,
      userId: expenses.userId,
      jobId: expenses.jobId,
      categoryId: expenses.categoryId,
      amount: expenses.amount,
      gstAmount: expenses.gstAmount,
      description: expenses.description,
      vendor: expenses.vendor,
      receiptUrl: expenses.receiptUrl,
      receiptNumber: expenses.receiptNumber,
      expenseDate: expenses.expenseDate,
      isBillable: expenses.isBillable,
      isRecurring: expenses.isRecurring,
      recurringFrequency: expenses.recurringFrequency,
      status: expenses.status,
      approvedBy: expenses.approvedBy,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      categoryName: expenseCategories.name,
      jobTitle: jobs.title
    }).from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(jobs, eq(expenses.jobId, jobs.id));

    const conditions = [eq(expenses.userId, userId)];

    if (filters?.jobId) {
      conditions.push(eq(expenses.jobId, filters.jobId));
    }

    if (filters?.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }

    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        and(
          sql`${expenses.expenseDate} >= ${filters.startDate}`,
          sql`${expenses.expenseDate} <= ${filters.endDate}`
        ) as any
      );
    }

    return await query
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpense(id: string, userId: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createExpense(expense: InsertExpense & { userId: string }): Promise<Expense> {
    const result = await db.insert(expenses).values(expense).returning();
    return result[0];
  }

  async updateExpense(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteExpense(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    return result.rowCount > 0;
  }

  // Inventory Management
  async getInventoryCategories(userId: string): Promise<InventoryCategory[]> {
    return await db.select().from(inventoryCategories)
      .where(eq(inventoryCategories.userId, userId))
      .orderBy(inventoryCategories.name);
  }

  async createInventoryCategory(category: InsertInventoryCategory & { userId: string }): Promise<InventoryCategory> {
    const result = await db.insert(inventoryCategories).values(category).returning();
    return result[0];
  }

  async updateInventoryCategory(id: string, userId: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory | undefined> {
    const result = await db.update(inventoryCategories)
      .set(category)
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInventoryCategory(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(inventoryCategories)
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.userId, userId)));
    return result.rowCount > 0;
  }

  async getInventoryItems(userId: string, categoryId?: string): Promise<InventoryItem[]> {
    if (categoryId) {
      return await db.select().from(inventoryItems)
        .where(and(eq(inventoryItems.userId, userId), eq(inventoryItems.categoryId, categoryId)))
        .orderBy(inventoryItems.name);
    }
    return await db.select().from(inventoryItems)
      .where(eq(inventoryItems.userId, userId))
      .orderBy(inventoryItems.name);
  }

  async getInventoryItem(id: string, userId: string): Promise<InventoryItem | undefined> {
    const result = await db.select().from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createInventoryItem(item: InsertInventoryItem & { userId: string }): Promise<InventoryItem> {
    const result = await db.insert(inventoryItems).values(item).returning();
    return result[0];
  }

  async updateInventoryItem(id: string, userId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const result = await db.update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInventoryItem(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)));
    return result.rowCount > 0;
  }

  async getInventoryTransactions(userId: string, itemId?: string): Promise<InventoryTransaction[]> {
    if (itemId) {
      return await db.select().from(inventoryTransactions)
        .where(and(eq(inventoryTransactions.userId, userId), eq(inventoryTransactions.itemId, itemId)))
        .orderBy(desc(inventoryTransactions.transactionDate));
    }
    return await db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.userId, userId))
      .orderBy(desc(inventoryTransactions.transactionDate));
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction & { userId: string }): Promise<InventoryTransaction> {
    const result = await db.insert(inventoryTransactions).values(transaction).returning();
    return result[0];
  }

  // Team Management
  async getUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles)
      .where(eq(userRoles.isActive, true))
      .orderBy(userRoles.name);
  }

  async createUserRole(role: InsertUserRole): Promise<UserRole> {
    const result = await db.insert(userRoles).values(role).returning();
    return result[0];
  }

  async updateUserRole(id: string, role: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const result = await db.update(userRoles)
      .set(role)
      .where(eq(userRoles.id, id))
      .returning();
    return result[0];
  }

  async deleteUserRole(id: string): Promise<boolean> {
    const result = await db.delete(userRoles).where(eq(userRoles.id, id));
    return result.rowCount > 0;
  }

  async getTeamMembers(businessOwnerId: string): Promise<TeamMember[]> {
    return await db.select().from(teamMembers)
      .where(and(eq(teamMembers.businessOwnerId, businessOwnerId), eq(teamMembers.isActive, true)))
      .orderBy(teamMembers.startDate);
  }

  async getTeamMember(id: string, businessOwnerId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)))
      .limit(1);
    return result[0];
  }

  async getTeamMembershipByMemberId(memberId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.memberId, memberId), eq(teamMembers.isActive, true)))
      .limit(1);
    return result[0];
  }

  async getTeamMemberByUserIdAndBusiness(userId: string, businessOwnerId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.memberId, userId), 
        eq(teamMembers.businessOwnerId, businessOwnerId),
        eq(teamMembers.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async getUserRole(id: string): Promise<UserRole | undefined> {
    const result = await db.select().from(userRoles)
      .where(eq(userRoles.id, id))
      .limit(1);
    return result[0];
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const result = await db.insert(teamMembers).values(member).returning();
    return result[0];
  }

  async updateTeamMember(id: string, businessOwnerId: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const result = await db.update(teamMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)))
      .returning();
    return result[0];
  }
  
  async updateTeamMemberPermissions(id: string, permissions: { customPermissions: string[], useCustomPermissions: boolean }): Promise<TeamMember | undefined> {
    const result = await db.update(teamMembers)
      .set({ 
        customPermissions: permissions.customPermissions,
        useCustomPermissions: permissions.useCustomPermissions,
        updatedAt: new Date() 
      })
      .where(eq(teamMembers.id, id))
      .returning();
    return result[0];
  }

  async deleteTeamMember(id: string, businessOwnerId: string): Promise<boolean> {
    const result = await db.delete(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)));
    return result.rowCount > 0;
  }

  async getStaffSchedules(userId: string, filters?: {
    jobId?: string;
    startDate?: Date;
    endDate?: Date;
    teamMemberId?: string;
  }): Promise<StaffSchedule[]> {
    let conditions = [eq(staffSchedules.userId, userId)];
    
    if (filters?.jobId) {
      conditions.push(eq(staffSchedules.jobId, filters.jobId));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(staffSchedules.scheduledDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(staffSchedules.scheduledDate, filters.endDate));
    }
    
    return await db.select().from(staffSchedules)
      .where(and(...conditions))
      .orderBy(staffSchedules.scheduledDate);
  }

  async createStaffSchedule(schedule: InsertStaffSchedule): Promise<StaffSchedule> {
    const result = await db.insert(staffSchedules).values(schedule).returning();
    return result[0];
  }

  async updateStaffSchedule(id: string, userId: string, schedule: Partial<InsertStaffSchedule>): Promise<StaffSchedule | undefined> {
    const result = await db.update(staffSchedules)
      .set({ ...schedule, updatedAt: new Date() })
      .where(and(eq(staffSchedules.id, id), eq(staffSchedules.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteStaffSchedule(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(staffSchedules)
      .where(and(eq(staffSchedules.id, id), eq(staffSchedules.userId, userId)));
    return result.rowCount > 0;
  }

  // GPS Tracking
  async getLocationTracking(userId: string, jobId?: string): Promise<LocationTracking[]> {
    if (jobId) {
      return await db.select().from(locationTracking)
        .where(and(eq(locationTracking.userId, userId), eq(locationTracking.jobId, jobId)))
        .orderBy(desc(locationTracking.timestamp));
    }
    return await db.select().from(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .orderBy(desc(locationTracking.timestamp));
  }

  async createLocationTracking(location: InsertLocationTracking): Promise<LocationTracking> {
    const result = await db.insert(locationTracking).values(location).returning();
    return result[0];
  }

  async getRoutes(userId: string): Promise<Route[]> {
    return await db.select().from(routes)
      .where(eq(routes.userId, userId))
      .orderBy(desc(routes.routeDate));
  }

  async getRoute(id: string, userId: string): Promise<Route | undefined> {
    const result = await db.select().from(routes)
      .where(and(eq(routes.id, id), eq(routes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const result = await db.insert(routes).values(route).returning();
    return result[0];
  }

  async updateRoute(id: string, userId: string, route: Partial<InsertRoute>): Promise<Route | undefined> {
    const result = await db.update(routes)
      .set({ ...route, updatedAt: new Date() })
      .where(and(eq(routes.id, id), eq(routes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteRoute(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(routes)
      .where(and(eq(routes.id, id), eq(routes.userId, userId)));
    return result.rowCount > 0;
  }

  async getBusinessSettingsByStripeCustomer(stripeCustomerId: string): Promise<BusinessSettings | undefined> {
    const result = await db.select().from(businessSettings)
      .where(eq(businessSettings.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return result[0];
  }

  // Job Photos
  async getJobPhotos(jobId: string, userId: string): Promise<JobPhoto[]> {
    return await db.select().from(jobPhotos)
      .where(and(eq(jobPhotos.jobId, jobId), eq(jobPhotos.userId, userId)))
      .orderBy(asc(jobPhotos.sortOrder), desc(jobPhotos.createdAt));
  }

  async getJobPhoto(id: string, userId: string): Promise<JobPhoto | undefined> {
    const result = await db.select().from(jobPhotos)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createJobPhoto(photo: InsertJobPhoto): Promise<JobPhoto> {
    const result = await db.insert(jobPhotos).values(photo).returning();
    return result[0];
  }

  async updateJobPhoto(id: string, userId: string, updates: Partial<InsertJobPhoto>): Promise<JobPhoto | undefined> {
    const result = await db.update(jobPhotos)
      .set(updates)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteJobPhoto(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jobPhotos)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)));
    return result.rowCount > 0;
  }

  // Voice Notes
  async getJobVoiceNotes(jobId: string, userId: string): Promise<VoiceNote[]> {
    return await db.select().from(voiceNotes)
      .where(and(eq(voiceNotes.jobId, jobId), eq(voiceNotes.userId, userId)))
      .orderBy(desc(voiceNotes.createdAt));
  }

  async getVoiceNote(id: string, userId: string): Promise<VoiceNote | undefined> {
    const result = await db.select().from(voiceNotes)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createVoiceNote(note: InsertVoiceNote): Promise<VoiceNote> {
    const result = await db.insert(voiceNotes).values(note).returning();
    return result[0];
  }

  async updateVoiceNote(id: string, userId: string, updates: Partial<InsertVoiceNote>): Promise<VoiceNote | undefined> {
    const result = await db.update(voiceNotes)
      .set(updates)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteVoiceNote(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(voiceNotes)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));
    return result.rowCount > 0;
  }

  // Invoice Reminder Logs
  async getInvoiceReminderLogs(invoiceId: string, userId: string): Promise<InvoiceReminderLog[]> {
    return await db.select().from(invoiceReminderLogs)
      .where(and(eq(invoiceReminderLogs.invoiceId, invoiceId), eq(invoiceReminderLogs.userId, userId)))
      .orderBy(desc(invoiceReminderLogs.createdAt));
  }

  async hasReminderBeenSent(invoiceId: string, reminderType: string): Promise<boolean> {
    const result = await db.select().from(invoiceReminderLogs)
      .where(and(
        eq(invoiceReminderLogs.invoiceId, invoiceId),
        eq(invoiceReminderLogs.reminderType, reminderType)
      ))
      .limit(1);
    return result.length > 0;
  }

  async createInvoiceReminderLog(log: InsertInvoiceReminderLog): Promise<InvoiceReminderLog> {
    const result = await db.insert(invoiceReminderLogs).values(log).returning();
    return result[0];
  }

  // Helper methods for reminder service
  async getAllUsersWithSettings(): Promise<Array<{ id: string; businessSettings: any }>> {
    const usersWithSettings = await db.select({
      id: users.id,
      businessSettings: businessSettings,
    })
    .from(users)
    .leftJoin(businessSettings, eq(users.id, businessSettings.userId));
    
    return usersWithSettings.map(u => ({
      id: u.id,
      businessSettings: u.businessSettings,
    }));
  }

  async getOverdueInvoicesForReminders(userId: string): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        eq(invoices.status, 'unpaid'),
        lt(invoices.dueDate, now)
      ));
  }
  
  async getRecurringJobsDue(): Promise<Job[]> {
    const now = new Date();
    return await db.select().from(jobs)
      .where(and(
        eq(jobs.isRecurring, true),
        lte(jobs.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringInvoicesDue(): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.isRecurring, true),
        lte(invoices.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringJobsDueForUser(userId: string): Promise<Job[]> {
    const now = new Date();
    return await db.select().from(jobs)
      .where(and(
        eq(jobs.userId, userId),
        eq(jobs.isRecurring, true),
        lte(jobs.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringInvoicesDueForUser(userId: string): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        eq(invoices.isRecurring, true),
        lte(invoices.nextRecurrenceDate, now)
      ));
  }
  
  // Subscription and usage tracking
  async incrementUserUsage(userId: string, type: 'jobs' | 'invoices' | 'quotes'): Promise<void> {
    const field = type === 'jobs' 
      ? users.jobsCreatedThisMonth 
      : type === 'invoices' 
        ? users.invoicesCreatedThisMonth 
        : users.quotesCreatedThisMonth;
    
    await db.update(users)
      .set({ [field.name]: sql`${field} + 1` })
      .where(eq(users.id, userId));
  }
  
  async resetUserUsage(userId: string): Promise<void> {
    await db.update(users)
      .set({
        jobsCreatedThisMonth: 0,
        invoicesCreatedThisMonth: 0,
        quotesCreatedThisMonth: 0,
        usageResetDate: new Date(),
      })
      .where(eq(users.id, userId));
  }
  
  async getUsersWithActiveTrial(): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.trialStatus, 'active'));
  }
  
  async getUsersWithAutoReminders(): Promise<Array<{ id: string; businessSettings: any }>> {
    const result = await db.select({
      id: users.id,
      businessSettings: businessSettings,
    })
    .from(users)
    .leftJoin(businessSettings, eq(users.id, businessSettings.userId))
    .where(eq(users.isActive, true));
    
    return result.map(u => ({
      id: u.id,
      businessSettings: u.businessSettings,
    })).filter(u => u.businessSettings?.autoRemindersEnabled);
  }
  
  async getUsersWithRecurringItems(): Promise<Array<{ id: string }>> {
    const usersWithRecurringJobs = await db.selectDistinct({ userId: jobs.userId })
      .from(jobs)
      .where(and(
        eq(jobs.isRecurring, true),
        isNotNull(jobs.nextRecurrenceDate)
      ));
    
    const usersWithRecurringInvoices = await db.selectDistinct({ userId: invoices.userId })
      .from(invoices)
      .where(and(
        eq(invoices.isRecurring, true),
        isNotNull(invoices.nextRecurrenceDate)
      ));
    
    const userIds = new Set<string>();
    for (const u of usersWithRecurringJobs) {
      userIds.add(u.userId);
    }
    for (const u of usersWithRecurringInvoices) {
      userIds.add(u.userId);
    }
    
    return Array.from(userIds).map(id => ({ id }));
  }

  // Digital Signatures
  async createDigitalSignature(signature: Omit<InsertDigitalSignature, 'id' | 'createdAt'>): Promise<DigitalSignature> {
    const [result] = await db.insert(digitalSignatures)
      .values({
        ...signature,
        id: randomUUID(),
      })
      .returning();
    return result;
  }

  async getDigitalSignatureByQuoteId(quoteId: string): Promise<DigitalSignature | undefined> {
    const result = await db.select().from(digitalSignatures)
      .where(eq(digitalSignatures.quoteId, quoteId))
      .orderBy(desc(digitalSignatures.signedAt))
      .limit(1);
    return result[0];
  }

  // Job Chat
  async getJobChatMessages(jobId: string): Promise<JobChat[]> {
    return await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId))
      .orderBy(asc(jobChat.createdAt));
  }

  async createJobChatMessage(message: InsertJobChat): Promise<JobChat> {
    const [result] = await db.insert(jobChat).values(message).returning();
    return result;
  }

  async markJobChatAsRead(jobId: string, userId: string): Promise<void> {
    const messages = await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId));
    
    for (const msg of messages) {
      const readBy = (msg.readBy as string[]) || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(jobChat)
          .set({ readBy })
          .where(eq(jobChat.id, msg.id));
      }
    }
  }

  async getUnreadJobChatCount(jobId: string, userId: string): Promise<number> {
    const messages = await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId));
    
    return messages.filter(msg => {
      const readBy = (msg.readBy as string[]) || [];
      return !readBy.includes(userId);
    }).length;
  }

  async deleteJobChatMessage(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jobChat)
      .where(and(eq(jobChat.id, id), eq(jobChat.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async forceDeleteJobChatMessage(id: string, jobId: string, businessOwnerId: string): Promise<boolean> {
    // First verify the job belongs to the business owner
    const job = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, businessOwnerId)))
      .limit(1);
    
    if (job.length === 0) {
      return false;
    }
    
    const result = await db.delete(jobChat)
      .where(and(eq(jobChat.id, id), eq(jobChat.jobId, jobId)))
      .returning();
    return result.length > 0;
  }

  // Team Chat
  async getTeamChatMessages(businessOwnerId: string): Promise<TeamChat[]> {
    return await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId))
      .orderBy(asc(teamChat.createdAt));
  }

  async createTeamChatMessage(message: InsertTeamChat): Promise<TeamChat> {
    const [result] = await db.insert(teamChat).values(message).returning();
    return result;
  }

  async markTeamChatAsRead(businessOwnerId: string, userId: string): Promise<void> {
    const messages = await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId));
    
    for (const msg of messages) {
      const readBy = (msg.readBy as string[]) || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(teamChat)
          .set({ readBy })
          .where(eq(teamChat.id, msg.id));
      }
    }
  }

  async getUnreadTeamChatCount(businessOwnerId: string, userId: string): Promise<number> {
    const messages = await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId));
    
    return messages.filter(msg => {
      const readBy = (msg.readBy as string[]) || [];
      return !readBy.includes(userId);
    }).length;
  }

  async pinTeamChatMessage(id: string, businessOwnerId: string, pinned: boolean): Promise<TeamChat | undefined> {
    const [result] = await db.update(teamChat)
      .set({ isPinned: pinned, updatedAt: new Date() })
      .where(and(eq(teamChat.id, id), eq(teamChat.businessOwnerId, businessOwnerId)))
      .returning();
    return result;
  }

  async deleteTeamChatMessage(id: string, senderId: string): Promise<boolean> {
    const result = await db.delete(teamChat)
      .where(and(eq(teamChat.id, id), eq(teamChat.senderId, senderId)))
      .returning();
    return result.length > 0;
  }

  async forceDeleteTeamChatMessage(id: string, businessOwnerId: string): Promise<boolean> {
    const result = await db.delete(teamChat)
      .where(and(eq(teamChat.id, id), eq(teamChat.businessOwnerId, businessOwnerId)))
      .returning();
    return result.length > 0;
  }

  // Location Tracking
  async getLatestLocationForUser(userId: string): Promise<LocationTracking | undefined> {
    const [result] = await db.select().from(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .orderBy(desc(locationTracking.timestamp))
      .limit(1);
    return result;
  }

  async createLocationEntry(entry: InsertLocationTracking): Promise<LocationTracking> {
    const [result] = await db.insert(locationTracking).values(entry).returning();
    return result;
  }

  // Tradie Status (Life360-style tracking)
  async getTradieStatus(userId: string): Promise<TradieStatus | undefined> {
    const [result] = await db.select().from(tradieStatus)
      .where(eq(tradieStatus.userId, userId))
      .limit(1);
    return result;
  }

  async upsertTradieStatus(data: InsertTradieStatus): Promise<TradieStatus> {
    const existing = await this.getTradieStatus(data.userId);
    if (existing) {
      const [result] = await db.update(tradieStatus)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tradieStatus.userId, data.userId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(tradieStatus).values(data).returning();
      return result;
    }
  }

  async getAllTradieStatusesForBusiness(businessOwnerId: string): Promise<TradieStatus[]> {
    return await db.select().from(tradieStatus)
      .where(eq(tradieStatus.businessOwnerId, businessOwnerId));
  }

  // Geofence Alerts
  async createGeofenceAlert(alert: InsertGeofenceAlert): Promise<GeofenceAlert> {
    const [result] = await db.insert(geofenceAlerts).values(alert).returning();
    return result;
  }

  async getGeofenceAlertsForBusiness(businessOwnerId: string, limit: number = 50): Promise<GeofenceAlert[]> {
    return await db.select().from(geofenceAlerts)
      .where(eq(geofenceAlerts.businessOwnerId, businessOwnerId))
      .orderBy(desc(geofenceAlerts.createdAt))
      .limit(limit);
  }

  async getUnreadGeofenceAlertsCount(businessOwnerId: string): Promise<number> {
    const results = await db.select().from(geofenceAlerts)
      .where(and(
        eq(geofenceAlerts.businessOwnerId, businessOwnerId),
        eq(geofenceAlerts.isRead, false)
      ));
    return results.length;
  }

  async markGeofenceAlertAsRead(alertId: string): Promise<void> {
    await db.update(geofenceAlerts)
      .set({ isRead: true })
      .where(eq(geofenceAlerts.id, alertId));
  }

  // Direct Messages
  async getDirectMessageConversations(userId: string): Promise<any[]> {
    const sent = await db.select().from(directMessages)
      .where(eq(directMessages.senderId, userId));
    const received = await db.select().from(directMessages)
      .where(eq(directMessages.recipientId, userId));
    
    const conversationMap = new Map<string, any>();
    
    for (const msg of [...sent, ...received]) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const existing = conversationMap.get(partnerId);
      if (!existing || new Date(msg.createdAt!) > new Date(existing.lastMessageAt)) {
        const partner = await this.getUser(partnerId);
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: partner ? `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email : 'Unknown',
          partnerAvatar: partner?.profileImageUrl,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: received.filter(m => m.senderId === partnerId && !m.isRead).length,
        });
      }
    }
    
    return Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  async getDirectMessages(userId: string, partnerId: string): Promise<DirectMessage[]> {
    return await db.select().from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, partnerId)),
          and(eq(directMessages.senderId, partnerId), eq(directMessages.recipientId, userId))
        )
      )
      .orderBy(asc(directMessages.createdAt));
  }

  async createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage> {
    const [result] = await db.insert(directMessages).values(message).returning();
    return result;
  }

  async markDirectMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db.update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.senderId, senderId),
          eq(directMessages.isRead, false)
        )
      );
  }

  async getUnreadDirectMessageCount(userId: string): Promise<number> {
    const result = await db.select().from(directMessages)
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.isRead, false)
        )
      );
    return result.length;
  }

  // Automations
  async getAutomations(userId: string): Promise<Automation[]> {
    return await db.select().from(automations)
      .where(eq(automations.userId, userId))
      .orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string, userId: string): Promise<Automation | undefined> {
    const result = await db.select().from(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createAutomation(automation: InsertAutomation & { userId: string }): Promise<Automation> {
    const [result] = await db.insert(automations).values(automation).returning();
    return result;
  }

  async updateAutomation(id: string, userId: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const [result] = await db.update(automations)
      .set({ ...automation, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();
    return result;
  }

  async deleteAutomation(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getAllUsersWithAutomations(): Promise<string[]> {
    const result = await db.selectDistinct({ userId: automations.userId })
      .from(automations)
      .where(eq(automations.isActive, true));
    return result.map(r => r.userId);
  }

  async hasAutomationProcessed(automationId: string, entityType: string, entityId: string): Promise<boolean> {
    try {
      const result = await db.select()
        .from(automationLogs)
        .where(
          and(
            eq(automationLogs.automationId, automationId),
            eq(automationLogs.entityType, entityType),
            eq(automationLogs.entityId, entityId)
          )
        )
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error(`[Storage] Error checking automation log:`, error);
      return false;
    }
  }

  async logAutomationProcessed(
    automationId: string, 
    entityType: string, 
    entityId: string, 
    result: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(automationLogs).values({
        automationId,
        entityType,
        entityId,
        result,
        errorMessage: errorMessage || null,
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`[Storage] Error logging automation:`, error);
    }
  }

  async getAutomationLogs(userId: string, limit: number = 50): Promise<AutomationLog[]> {
    try {
      const userAutomations = await this.getAutomations(userId);
      const automationIds = userAutomations.map(a => a.id);
      
      if (automationIds.length === 0) return [];
      
      const result = await db.select()
        .from(automationLogs)
        .where(inArray(automationLogs.automationId, automationIds))
        .orderBy(desc(automationLogs.processedAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error(`[Storage] Error getting automation logs:`, error);
      return [];
    }
  }

  // Custom Forms
  async getCustomForms(userId: string): Promise<CustomForm[]> {
    return await db.select().from(customForms)
      .where(eq(customForms.userId, userId))
      .orderBy(desc(customForms.createdAt));
  }

  async getCustomForm(id: string, userId: string): Promise<CustomForm | undefined> {
    const result = await db.select().from(customForms)
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createCustomForm(form: InsertCustomForm & { userId: string }): Promise<CustomForm> {
    const [result] = await db.insert(customForms).values(form).returning();
    return result;
  }

  async updateCustomForm(id: string, userId: string, form: Partial<InsertCustomForm>): Promise<CustomForm | undefined> {
    const [result] = await db.update(customForms)
      .set({ ...form, updatedAt: new Date() })
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .returning();
    return result;
  }

  async deleteCustomForm(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(customForms)
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Form Submissions
  async getFormSubmissions(formId: string, userId: string): Promise<FormSubmission[]> {
    const form = await this.getCustomForm(formId, userId);
    if (!form) return [];
    
    return await db.select().from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.submittedAt));
  }

  async getFormSubmissionsByJob(jobId: string, userId: string): Promise<FormSubmission[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db.select().from(formSubmissions)
      .where(eq(formSubmissions.jobId, jobId))
      .orderBy(desc(formSubmissions.submittedAt));
  }

  async getFormSubmission(id: string, userId: string): Promise<FormSubmission | undefined> {
    const result = await db.select().from(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    const form = await this.getCustomForm(result[0].formId, userId);
    if (!form) return undefined;
    
    return result[0];
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [result] = await db.insert(formSubmissions).values(submission).returning();
    return result;
  }

  async updateFormSubmission(id: string, userId: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined> {
    const existing = await this.getFormSubmission(id, userId);
    if (!existing) return undefined;
    
    const [result] = await db.update(formSubmissions)
      .set(submission)
      .where(eq(formSubmissions.id, id))
      .returning();
    return result;
  }

  async deleteFormSubmission(id: string, userId: string): Promise<boolean> {
    const existing = await this.getFormSubmission(id, userId);
    if (!existing) return false;
    
    const result = await db.delete(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .returning();
    return result.length > 0;
  }

  // SMS Conversations
  async getSmsConversation(id: string): Promise<SmsConversation | undefined> {
    const result = await db.select().from(smsConversations)
      .where(and(eq(smsConversations.id, id), isNull(smsConversations.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getSmsConversationByPhone(businessOwnerId: string, clientPhone: string): Promise<SmsConversation | undefined> {
    const result = await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.businessOwnerId, businessOwnerId),
        eq(smsConversations.clientPhone, clientPhone),
        isNull(smsConversations.deletedAt)
      ))
      .limit(1);
    return result[0];
  }

  async getSmsConversationsByBusiness(businessOwnerId: string): Promise<SmsConversation[]> {
    return await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.businessOwnerId, businessOwnerId),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async getSmsConversationsByClientPhone(clientPhone: string): Promise<SmsConversation[]> {
    return await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.clientPhone, clientPhone),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async getSmsConversationsByJobIds(jobIds: string[]): Promise<SmsConversation[]> {
    if (jobIds.length === 0) return [];
    return await db.select().from(smsConversations)
      .where(and(
        inArray(smsConversations.jobId, jobIds),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async createSmsConversation(conversation: InsertSmsConversation): Promise<SmsConversation> {
    const [result] = await db.insert(smsConversations).values(conversation).returning();
    return result;
  }

  async updateSmsConversation(id: string, updates: Partial<InsertSmsConversation>): Promise<SmsConversation> {
    const [result] = await db.update(smsConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(smsConversations.id, id))
      .returning();
    return result;
  }

  // SMS Messages
  async getSmsMessages(conversationId: string): Promise<SmsMessage[]> {
    return await db.select().from(smsMessages)
      .where(eq(smsMessages.conversationId, conversationId))
      .orderBy(asc(smsMessages.createdAt));
  }

  async createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage> {
    const [result] = await db.insert(smsMessages).values(message).returning();
    return result;
  }

  async updateSmsMessage(id: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage> {
    const [result] = await db.update(smsMessages)
      .set(updates)
      .where(eq(smsMessages.id, id))
      .returning();
    return result;
  }

  async markSmsMessagesAsRead(conversationId: string): Promise<void> {
    await db.update(smsMessages)
      .set({ read: true })
      .where(and(
        eq(smsMessages.conversationId, conversationId),
        eq(smsMessages.read, false)
      ));
  }

  // SMS Templates
  async getSmsTemplates(userId: string): Promise<SmsTemplate[]> {
    return await db.select().from(smsTemplates)
      .where(eq(smsTemplates.userId, userId))
      .orderBy(desc(smsTemplates.usageCount), asc(smsTemplates.name));
  }

  async getSmsTemplate(id: string, userId: string): Promise<SmsTemplate | undefined> {
    const result = await db.select().from(smsTemplates)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate> {
    const [result] = await db.insert(smsTemplates).values(data).returning();
    return result;
  }

  async updateSmsTemplate(id: string, userId: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate> {
    const [result] = await db.update(smsTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .returning();
    return result;
  }

  async deleteSmsTemplate(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(smsTemplates)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async incrementSmsTemplateUsage(id: string): Promise<void> {
    await db.update(smsTemplates)
      .set({ 
        usageCount: sql`${smsTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(smsTemplates.id, id));
  }

  // SMS Automation Rules
  async getSmsAutomationRules(userId: string): Promise<SmsAutomationRule[]> {
    return await db.select().from(smsAutomationRules)
      .where(eq(smsAutomationRules.userId, userId))
      .orderBy(desc(smsAutomationRules.createdAt));
  }

  async getSmsAutomationRule(id: string, userId: string): Promise<SmsAutomationRule | undefined> {
    const result = await db.select().from(smsAutomationRules)
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createSmsAutomationRule(data: InsertSmsAutomationRule): Promise<SmsAutomationRule> {
    const [result] = await db.insert(smsAutomationRules).values(data).returning();
    return result;
  }

  async updateSmsAutomationRule(id: string, userId: string, data: Partial<InsertSmsAutomationRule>): Promise<SmsAutomationRule> {
    const [result] = await db.update(smsAutomationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .returning();
    return result;
  }

  async deleteSmsAutomationRule(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(smsAutomationRules)
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSmsAutomationRulesByTrigger(userId: string, triggerType: string): Promise<SmsAutomationRule[]> {
    return await db.select().from(smsAutomationRules)
      .where(and(
        eq(smsAutomationRules.userId, userId),
        eq(smsAutomationRules.triggerType, triggerType),
        eq(smsAutomationRules.isActive, true)
      ))
      .orderBy(desc(smsAutomationRules.createdAt));
  }

  // SMS Automation Logs
  async createSmsAutomationLog(data: InsertSmsAutomationLog): Promise<SmsAutomationLog> {
    const [result] = await db.insert(smsAutomationLogs).values(data).returning();
    return result;
  }

  async getSmsAutomationLog(ruleId: string, entityType: string, entityId: string): Promise<SmsAutomationLog | undefined> {
    const result = await db.select().from(smsAutomationLogs)
      .where(and(
        eq(smsAutomationLogs.ruleId, ruleId),
        eq(smsAutomationLogs.entityType, entityType),
        eq(smsAutomationLogs.entityId, entityId)
      ))
      .limit(1);
    return result[0];
  }

  // SMS Booking Links
  async createSmsBookingLink(data: InsertSmsBookingLink): Promise<SmsBookingLink> {
    const [result] = await db.insert(smsBookingLinks).values(data).returning();
    return result;
  }

  async getSmsBookingLinkByToken(token: string): Promise<SmsBookingLink | undefined> {
    const result = await db.select().from(smsBookingLinks)
      .where(eq(smsBookingLinks.token, token))
      .limit(1);
    return result[0];
  }

  async updateSmsBookingLink(id: string, data: Partial<SmsBookingLink>): Promise<SmsBookingLink> {
    const [result] = await db.update(smsBookingLinks)
      .set(data)
      .where(eq(smsBookingLinks.id, id))
      .returning();
    return result;
  }

  // SMS Tracking Links (Live Arrival Tracking)
  async createSmsTrackingLink(data: InsertSmsTrackingLink): Promise<SmsTrackingLink> {
    const [result] = await db.insert(smsTrackingLinks).values(data).returning();
    return result;
  }

  async getSmsTrackingLinkByToken(token: string): Promise<SmsTrackingLink | undefined> {
    const result = await db.select().from(smsTrackingLinks)
      .where(eq(smsTrackingLinks.token, token))
      .limit(1);
    return result[0];
  }

  async getSmsTrackingLinkByJobId(jobId: string): Promise<SmsTrackingLink | undefined> {
    const result = await db.select().from(smsTrackingLinks)
      .where(and(
        eq(smsTrackingLinks.jobId, jobId),
        eq(smsTrackingLinks.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async updateSmsTrackingLink(id: string, data: Partial<SmsTrackingLink>): Promise<SmsTrackingLink> {
    const [result] = await db.update(smsTrackingLinks)
      .set(data)
      .where(eq(smsTrackingLinks.id, id))
      .returning();
    return result;
  }

  async incrementTrackingLinkViews(id: string): Promise<void> {
    await db.update(smsTrackingLinks)
      .set({ viewCount: sql`${smsTrackingLinks.viewCount} + 1` })
      .where(eq(smsTrackingLinks.id, id));
  }

  async deactivateSmsTrackingLink(id: string): Promise<void> {
    await db.update(smsTrackingLinks)
      .set({ isActive: false })
      .where(eq(smsTrackingLinks.id, id));
  }

  // Xero Integration
  async getXeroConnection(userId: string): Promise<XeroConnection | undefined> {
    const result = await db.select().from(xeroConnections)
      .where(eq(xeroConnections.userId, userId))
      .limit(1);
    return result[0];
  }

  async createXeroConnection(data: InsertXeroConnection): Promise<XeroConnection> {
    const [result] = await db.insert(xeroConnections).values(data).returning();
    return result;
  }

  async updateXeroConnection(id: string, data: Partial<XeroConnection>): Promise<XeroConnection | undefined> {
    const [result] = await db.update(xeroConnections)
      .set(data)
      .where(eq(xeroConnections.id, id))
      .returning();
    return result;
  }

  async deleteXeroConnection(userId: string): Promise<boolean> {
    const result = await db.delete(xeroConnections)
      .where(eq(xeroConnections.userId, userId))
      .returning();
    return result.length > 0;
  }
}

export const storage = new PostgresStorage();
