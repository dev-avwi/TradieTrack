### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to centralize and streamline business operations. It handles job management, quoting, invoicing, and payment collection, with specific support for Australian GST and AUD currency. The platform aims to boost productivity, financial management, and client communication for solo tradies and small businesses through features like AI-driven scheduling optimization and multi-option quote generation.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile application is fully integrated with the API, featuring Zustand for state management and SQLite-based offline mode.

Key architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and customizable theming. Features include a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
*   **AI Integration**: Employs GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision is used for AI Photo Analysis, and there's an AI Schedule Optimizer and AI-powered voice note transcription.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer, with customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, and rollback capabilities.
*   **Live Quote/Invoice Editor**: Real-time preview, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Payment Collection**: Features Stripe Payment Links, a "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with trials, Stripe checkout, and automated reminders.
*   **Email Automation**: SendGrid integration for customizable emails with AI suggestions.
*   **PWA Support**: Offline capabilities via web manifest and service worker.
*   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration with AI analysis. A Microsoft Teams-style Chat Hub unifies conversations.
*   **Team Operations Center**: Unified hub for live operations, administration, scheduling, skills/certifications, and performance.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions enforced by middleware.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart sync across web and mobile.
*   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
*   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs, including templates.
*   **Financial Management**: Unified dashboard with KPIs.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced Xero integration (two-way sync, payment marking, chart of accounts, tax rates, bulk sync), MYOB AccountRight, and Google Calendar integrations.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
*   **Templates Hub**: Central management for customizable content with live preview.
*   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
*   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
*   **Defect Tracking**: Management of warranty work and defects with severity levels and photo attachments.
*   **Timesheet Approvals**: Workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: Kanban-style lead tracking with convert-to-client functionality.
*   **Immersive ServiceM8-Style Onboarding**: Full-screen onboarding experience with 2 phases - Welcome screen with "G'day" greeting followed by 7-step "Life of a Job" walkthrough explaining the core workflow. After completion, a GuidedTour automatically starts with 18 step-by-step tooltips highlighting actual UI elements across the app (dashboard, clients, jobs, quotes, invoices, settings). Server-side tracking via `hasSeenWalkthrough` field in business_settings table prevents localStorage issues when accounts are re-created. Tour can be replayed from Settings.

### External Dependencies
*   **Database**: PostgreSQL (via Neon serverless)
*   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
*   **Payment Processing**: Stripe (Stripe Connect Express)
*   **PDF Generation**: Puppeteer
*   **UI Components**: Radix UI (via shadcn/ui)
*   **Styling**: TailwindCSS
*   **Fonts**: Google Fonts (Inter)
*   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
*   **SMS Notifications**: Twilio
*   **Object Storage**: Google Cloud Storage (GCS)
*   **Maps**: Leaflet with react-leaflet
*   **Accounting Integration**: Xero, MYOB AccountRight
*   **Calendar Integration**: Google Calendar

### Mobile App Development Patterns

**React Native/Expo Initialization Guards** (Critical):
When async initialization functions are called in components that may remount (e.g., due to `isLoading` state toggling), always add guards to prevent infinite loops:

```typescript
// In Zustand stores - guard async functions like checkAuth
checkAuth: async () => {
  const state = get();
  if (state.isLoading) return; // Guard: prevent simultaneous calls
  if (state.isInitialized && state.isAuthenticated) return; // Guard: skip if done
  set({ isLoading: true });
  // ... auth logic
}

// In services - guard initialization with flags
class NotificationService {
  private isInitializing = false;
  private isInitialized = false;
  
  async initialize() {
    if (this.isInitialized) return this.pushToken;
    if (this.isInitializing) return null;
    this.isInitializing = true;
    // ... init logic
  }
}
```

**Single Auth Check Entry Point**: Call `checkAuth()` only in `_layout.tsx` (RootLayoutContent), never duplicate in `index.tsx` or other screens - this prevents race conditions.

**Team Member Colors**: 12-color palette auto-assigned and persisted to `users.themeColor` on first view for consistency across map and team views.

**iOS Map Markers**: Use 100% static marker appearance to prevent markers flashing at (0,0) when view content changes. Life360-style live movement uses 10-second polling interval.

**Team Member List Sorting**: Active/on-duty team members are always prioritized at the front of lists across the app. Priority order: on_job > working > driving > online > idle > offline. This applies to Maps page team chips, Team Operations status board, and similar team member lists.

**Tap to Pay on iPhone**: When using the real Stripe Terminal SDK (native builds via EAS), the SDK's `collectPaymentMethod()` function automatically presents Apple's native dark "Hold Here to Pay" interface. The custom React Native modal is only shown in simulation mode (Expo Go) as a fallback. Check `terminal.isSimulation` and `terminal.isSDKAvailable` to determine which path to use. Requirements: iOS 16.4+, iPhone XS or later, Stripe Terminal enabled, Apple Tap to Pay entitlement.

**Unified Notifications (Web + Mobile Parity)**: Both web and mobile now use the `/api/notifications/unified` endpoint which combines system notifications, SMS notifications, and chat notifications into a single feed. Mobile uses `useNotificationsStore` with 30-second polling for real-time updates. Notification types include `notificationType: 'system' | 'sms' | 'chat'` for proper routing and icon display. SMS notifications show emerald phone icon, chat notifications show indigo message-circle icon, with type badges displayed next to titles.

**Permission System (Web-Mobile Parity)**:
- Two parallel permission systems exist: `WORKER_PERMISSIONS` (17 backend operational toggles) and `ActionPermissions` (24 UI action flags)
- The translation layer in `client/src/lib/permission-map.ts` maps 10 ActionPermissions to their WORKER_PERMISSIONS equivalents:
  - Clients: canCreateClients → CREATE_CLIENTS, canEditClients → EDIT_CLIENTS
  - Quotes: canCreateQuotes → CREATE_QUOTES, canEditQuotes → EDIT_DOCUMENTS, canSendQuotes → SEND_QUOTES
  - Invoices: canCreateInvoices → CREATE_INVOICES, canEditInvoices → EDIT_DOCUMENTS, canSendInvoices → SEND_INVOICES
  - Jobs: canViewAllJobs → VIEW_ALL_JOBS, canEditJobs → EDIT_JOBS
- When `useCustomPermissions` is true for a team member, their custom permission toggles override role-based defaults via `mergeWithCustomPermissions()`
- Known limitations: Job create/delete remain role-based (no WORKER_PERMISSIONS equivalents); EDIT_DOCUMENTS is shared across quotes/invoices
- Mobile uses the same WORKER_PERMISSIONS via `hasPermission()` checks with offline SQLite caching

**Demo Data Persistence (Web-Mobile Parity)**:
- Demo data (clients, jobs, quotes, invoices, receipts) is now preserved across server restarts to maintain consistent IDs between web and mobile apps
- Previously, demo data was deleted and recreated on every server restart, causing "Invoice not found" errors on mobile when cached IDs became stale
- The 5-minute refresh scheduler only updates team member locations/activity status, not data entities
- To force reset demo data when needed: `POST /api/admin/reset-demo-data` (requires demo user authentication)
- After reset, mobile users must pull-to-refresh on list screens to get new IDs
- This ensures a realistic tradie experience where invoices, quotes, and jobs persist like real business data

**Integration Setup Guides (Web-Mobile Parity)**:
- Three polished setup guide components: `XeroSetupGuide.tsx`, `StripeSetupGuide.tsx`, `GoogleCalendarSetupGuide.tsx`
- All guides use identical flat structure (no Card wrappers) to prevent nested Card violations when placed inside parent CardContent
- Comprehensive data-testid coverage for mobile testing: `button-*-connect`, `accordion-*-faq`, `badge-*-status`, `list-*-features`
- Each guide includes: styled header with progress badge, benefits banner, progress steps, FAQ accordion, security notes, support links
- Integrations page (`/integrations`) renders setup guides inside existing integration Cards' CardContent

**Web Offline Support (PWA)**:
- **IndexedDB Storage** (`client/src/lib/offlineStorage.ts`): Local database with stores for clients, jobs, quotes, invoices, receipts, and sync queue
- **Service Worker** (`public/service-worker.js`): Caches static assets and API responses; network-first strategy for API requests with offline fallback
- **Sync Queue**: Offline mutations (create/update/delete) are queued in IndexedDB and synced when back online
- **Network Context** (`client/src/contexts/NetworkContext.tsx`): Tracks online/offline state, manages sync, shows OfflineIndicator UI
- **Offline-Aware Mutations**: Create hooks for clients, jobs, quotes, invoices use `offlineAwareApiRequest` which:
  - Generates temporary offline IDs (prefixed with `offline_`)
  - Saves to IndexedDB and adds to sync queue
  - Updates React Query cache optimistically for immediate UI feedback
- **ID Reconciliation**: After sync, offline IDs are mapped to server IDs via `syncService.ts` ID mapping system
- **safeInvalidateQueries**: Wrapper that skips query invalidation while offline to preserve optimistic cache state
- Key files: `offlineStorage.ts`, `syncService.ts`, `registerServiceWorker.ts`, `useOfflineData.ts`, `NetworkContext.tsx`, `OfflineIndicator.tsx`