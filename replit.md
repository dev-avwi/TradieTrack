### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, encompassing job management, quoting, invoicing, and payment collection. The platform specifically handles Australian GST and AUD currency. TradieTrack aims to enhance productivity, financial management, and client communication for solo tradies and small businesses, offering features like AI-driven scheduling optimization and multi-option quote generation to boost efficiency and customer choice.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack employs an event-driven architecture with TypeScript. The frontend is built using React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile devices. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM.

Key architectural and design decisions include:
-   **UI/UX**: Mobile-first design featuring card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard. Includes Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, Contextual Quote/Invoice Creation, and customizable theming.
-   **Authentication**: Supports Email/password, Google OAuth, and secure password reset, with cross-platform compatibility for session tokens.
-   **AI Integration**: Utilizes GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision is used for AI Photo Analysis. Includes an AI Schedule Optimizer using a nearest-neighbor algorithm.
-   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer, incorporating customizable templates.
-   **Adaptive Solo/Team Mode**: Features adjust (e.g., time tracking, GPS check-in) based on the business's team size.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, and rollback capabilities.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Payment Collection**: Features Stripe Payment Links, a dedicated "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, "Record Payment" button, and **Quick Collect Payment** for on-site collection directly from accepted quotes.
-   **Quote Acceptance Flow**: Automates job status updates upon client acceptance, with a "Create Job" button to convert accepted quotes into jobs.
-   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with trials, Stripe checkout, and automated reminders.
-   **Email Automation**: SendGrid integration for customizable invoice/quote emails with AI suggestions.
-   **PWA Support**: Offline capabilities via web manifest and service worker.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments. Includes two-way Twilio SMS integration with AI analysis.
-   **Team Operations Center**: A unified, advanced team management hub with Live Ops, Team Admin, Scheduling, Skills & Certifications, and Performance tabs, replacing legacy team management pages.
-   **Microsoft Teams-Style Chat Hub**: A unified conversation inbox for Team Chat, Customer SMS, Job Threads, and Direct Messages.
-   **Live360-Style Interactive Map**: Displays job pins and real-time location tracking for team members.
-   **Role-Based Access Control (RBAC)**: Granular permissions (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware, with specific worker permission configurations.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync, and permission-aware navigation.
-   **Comprehensive Offline Mode**: Offline-first support for major workflows (job, time, invoice, quote, client management) with smart sync.
-   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
-   **Route Optimization**: Haversine distance calculation with a nearest-neighbor algorithm for daily jobs.
-   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs.
-   **Financial Management**: Unified dashboard with KPIs.
-   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
-   **Integrations**: Enhanced Xero integration (two-way contact/quote/invoice sync, payment marking, chart of accounts, tax rates, bulk sync, summary dashboard), MYOB AccountRight, and Google Calendar integrations.
-   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
-   **Templates Hub**: Central management for customizable content (Terms & Conditions, Warranty, Email/SMS templates, Safety Forms, Checklists, Payment Notices) with live preview.
-   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
-   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
-   **Job Photo Requirements**: Enforce photo uploads at specific job stages (before_start, during, after_completion) with mobile parity features.
-   **Defect Tracking**: Management of warranty work and defects with severity levels, status workflow, and photo attachments.
-   **Timesheet Approvals**: Workflow for crew timesheet approval with status states and reviewer notes.

### Demo Accounts
**Business Owner:**
- Email: demo@tradietrack.com.au
- Password: demo123456
- Role: Business Owner with demo team (6 members: 4 accepted, 2 pending invites)

**Team Worker:**
- Email: worker@tradietrack.com.au
- Password: worker123456
- Role: Worker on Mike's Plumbing team (Jake Morrison)

**Demo Data:**
- 10 clients (realistic Cairns QLD area addresses with GPS coordinates)
- 40 jobs (5 pending, 8 scheduled, 6 in_progress, 8 done, 8 invoiced, 5 cancelled)
- 9 quotes (2 draft, 3 sent, 2 accepted, 2 rejected) - includes 2 Xero-imported quotes
- 11 invoices (2 draft, 3 sent, 2 overdue, 4 paid) - includes 2 Xero-imported invoices
- 3 receipts (for paid invoices)
- 3-4 Xero-sourced items marked with isXeroImport flags for integration visibility testing

### Complete Tradie Workflow Guide

This section documents the complete business workflow from initial customer contact to final payment and follow-up.

#### Phase 1: Customer Inquiry (Entry Points)
- **Inbound SMS**: Customer texts business number → auto-creates SMS conversation → AI analysis suggests response
- **Phone Call**: Tradie manually creates client → adds inquiry notes
- **Website/Referral**: Create client with contact details

#### Phase 2: Quote Creation
**Quote Statuses: draft → sent → accepted/rejected**

1. **Create Quote** - Select client, add line items (from catalog or manual), set validity period, add terms & conditions
2. **Send Quote** - Email with PDF, SMS notification, client receives online viewer
3. **Client Decision** - Accepted: auto-creates/links job | Rejected: enables follow-up workflow

#### Phase 3: Job Lifecycle
**Job Statuses: pending → scheduled → in_progress → done → invoiced**

1. **Pending** - Job created, awaiting scheduling
2. **Scheduled** - Date/time set, GPS for route optimization, automated reminders sent
3. **In Progress** - GPS check-in, time tracking starts, upload photos
4. **Done** - GPS check-out, time tracking stops, ready for invoicing
5. **Invoiced** - Invoice created and sent, payment collection enabled

**Alternative Paths:**
- Job Cancelled, Job On Hold, Defect Reported

#### Phase 4: Invoice & Payment
**Invoice Statuses: draft → sent → paid (with overdue tracking)**

1. **Create Invoice** - Auto-fills from job/quote, add line items, set due date
2. **Send Invoice** - Email with PDF, SMS with payment link
3. **Payment Collection** (from job detail or `/collect-payment`):
   - **Tap to Pay** (Mobile only): NFC contactless via Stripe Terminal
   - **QR Code**: Customer scans and pays via phone
   - **Send Link**: Email/SMS payment link
   - **Record Cash/Bank Transfer**: Manual entry
4. **Payment Received** - Invoice marked paid, auto-generates receipt

#### Phase 5: Receipt & Follow-up
- Receipt generated with unique number
- PDF available for download/email
- Optional: Thank-you email, review request, maintenance reminders

#### Status Transition Matrix

| From | To | Trigger |
|------|-----|---------|
| Quote draft | Quote sent | Send button |
| Quote sent | Quote accepted | Client accepts |
| Quote accepted | Job pending | Auto-creates job |
| Job pending | Job scheduled | Date/time set |
| Job scheduled | Job in_progress | Start Job |
| Job in_progress | Job done | Complete Job |
| Job done | Job invoiced | Invoice sent |
| Invoice sent | Invoice paid | Payment received |

#### Payment Methods

| Method | Availability | Best For |
|--------|--------------|----------|
| Quick Collect | Web & Mobile | Fast on-site collection from accepted quotes (no invoice required) |
| Tap to Pay (NFC) | Mobile only (iPhone XS+) | In-person after job |
| QR Code | Web & Mobile | In-person, customer has phone |
| Payment Link | Web & Mobile | Remote payment via SMS/email |
| Record Cash | Web & Mobile | Cash payments |
| Bank Transfer | Web & Mobile | Direct deposits |

### Recent Updates (January 2026)

**Xero Integration Visibility Badges**: Visual badges on job, quote, and invoice cards to distinguish Xero-imported items from TradieTrack-created items:
- Web: XeroRibbon component with corner badge (client/src/components/XeroRibbon.tsx)
- Mobile: XeroBadge component (mobile/src/components/ui/XeroBadge.tsx)
- Integrated on QuoteCard, InvoiceCard, JobCard, TodayJobCard, DocumentsHub
- Xero blue (#13B5EA) branding consistent with Xero's design system

**Quick Collect Payment Feature**: New on-site payment collection directly from accepted quotes without requiring a separate invoice step. Available on both web and mobile:
- Shows on jobs with status 'done' or 'in_progress' that have an accepted quote but no invoice
- Supports cash, card, and bank transfer payment methods
- Auto-creates paid invoice and receipt in one step
- Backend API: `/api/jobs/:id/quick-collect`
- Mobile parity: Full implementation in mobile/app/job/[id].tsx with native UI

**SMS Notifications**: Full Twilio integration enabled via twilioClient.ts - notificationService now uses real SMS instead of stub.

**AI Photo Analysis**: Limit increased from 5 to 15 photos for larger jobs using GPT-4o vision with low detail mode.

**Xero Account Codes**: Now configurable per business via businessSettings:
- `xeroSalesAccountCode` (default: "200") - Sales revenue account
- `xeroBankAccountCode` (default: "090") - Bank account for payments  
- `xeroExpenseAccountCode` (default: "400") - Expense account
- `xeroTaxType` (default: "OUTPUT") - GST on sales

**Google Calendar Integration**: Improved token handling with:
- Proactive refresh (10 min before expiry vs 5 min)
- Retry logic (3 attempts with exponential backoff)
- Better error messages directing to Settings → Integrations

**Outlook/Microsoft 365 Email**: New integration via Microsoft Graph API:
- Per-user OAuth tokens stored in businessSettings
- Full email sending support with attachments
- API routes: `/api/integrations/outlook/connect`, `/callback`, `/disconnect`, `/status`
- Environment vars: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

### External Dependencies
-   **Database**: PostgreSQL (via Neon serverless)
-   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
-   **Payment Processing**: Stripe (Stripe Connect Express)
-   **PDF Generation**: Puppeteer
-   **UI Components**: Radix UI (via shadcn/ui)
-   **Styling**: TailwindCSS
-   **Fonts**: Google Fonts (Inter)
-   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
-   **SMS Notifications**: Twilio (fully enabled)
-   **Object Storage**: Google Cloud Storage (GCS)
-   **Maps**: Leaflet with react-leaflet
-   **Accounting Integration**: Xero (with configurable account codes), MYOB AccountRight
-   **Calendar Integration**: Google Calendar (with proactive token refresh)