### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to centralize and streamline business operations. It handles job management, quoting, invoicing, and payment collection, with specific support for Australian GST and AUD currency. The platform aims to boost productivity, financial management, and client communication for solo tradies and small businesses through features like AI-driven scheduling optimization and multi-option quote generation.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM.

Key architectural and design decisions include:
-   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, Contextual Quote/Invoice Creation, and customizable theming.
-   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
-   **AI Integration**: Employs GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation, and GPT-4o vision for AI Photo Analysis. Includes an AI Schedule Optimizer.
-   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer, with customizable templates.
-   **Adaptive Solo/Team Mode**: Features adjust based on business team size.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, and rollback capabilities.
-   **Live Quote/Invoice Editor**: Real-time preview, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Payment Collection**: Features Stripe Payment Links, a "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment directly from accepted quotes.
-   **Quote Acceptance Flow**: Automates job status updates and allows conversion of accepted quotes into jobs.
-   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with trials, Stripe checkout, and automated reminders.
-   **Email Automation**: SendGrid integration for customizable invoice/quote emails with AI suggestions.
-   **PWA Support**: Offline capabilities via web manifest and service worker.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration with AI analysis.
-   **Team Operations Center**: Unified hub for live operations, administration, scheduling, skills/certifications, and performance.
-   **Microsoft Teams-Style Chat Hub**: Unified conversation inbox for various communication channels.
-   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking.
-   **Role-Based Access Control (RBAC)**: Granular permissions (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync, and permission-aware navigation.
-   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart sync.
-   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
-   **Route Optimization**: Haversine distance calculation with a nearest-neighbor algorithm for daily jobs.
-   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs.
-   **Financial Management**: Unified dashboard with KPIs.
-   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
-   **Integrations**: Enhanced Xero integration (two-way sync, payment marking, chart of accounts, tax rates, bulk sync), MYOB AccountRight, and Google Calendar integrations.
-   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
-   **Templates Hub**: Central management for customizable content with live preview.
-   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
-   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
-   **Job Photo Requirements**: Enforce photo uploads at specific job stages.
-   **Defect Tracking**: Management of warranty work and defects with severity levels and photo attachments.
-   **Timesheet Approvals**: Workflow for crew timesheet approval.

### External Dependencies
-   **Database**: PostgreSQL (via Neon serverless)
-   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
-   **Payment Processing**: Stripe (Stripe Connect Express)
-   **PDF Generation**: Puppeteer
-   **UI Components**: Radix UI (via shadcn/ui)
-   **Styling**: TailwindCSS
-   **Fonts**: Google Fonts (Inter)
-   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
-   **SMS Notifications**: Twilio
-   **Object Storage**: Google Cloud Storage (GCS)
-   **Maps**: Leaflet with react-leaflet
-   **Accounting Integration**: Xero, MYOB AccountRight
-   **Calendar Integration**: Google Calendar

### Production Status (January 2026)
**Version**: 1.0.0 - Ready for publishing

**All Integrations Verified**:
- ✅ PostgreSQL (Neon serverless) - Connected
- ✅ Stripe payments - Initialized and syncing
- ✅ SendGrid email - Initialized
- ✅ Twilio SMS - Connected via Replit managed connector
- ✅ Google OAuth - Production mode with real credentials
- ✅ OpenAI (GPT-4o) - API key configured
- ✅ Object Storage (GCS) - Bucket configured

**Mobile App**:
- React Native/Expo app with 80 screens
- Tap to Pay on iPhone - Apple entitlement APPROVED (January 2026)
- Ready for App Store submission

**Pre-publish Cleanup Completed**:
- Removed dead mock data files
- Updated browserslist database
- Fixed SMS WebSocket reconnection loop (added exponential backoff)

**Known Limitations**:
- Stripe Connect requires user to complete onboarding to enable payments
- Tap to Pay requires Apple entitlement approval before availability

### Mobile App Development
**API URL Configuration** (Automatic Detection):
- Development mode (`__DEV__`): Automatically uses Replit dev server URL
- Production builds: Automatically uses `https://tradietrack.com`
- Override: Set `EXPO_PUBLIC_API_URL` to force a specific URL
- Console log shows: `[API] Mode: Development/Production, URL: ...`

### Recent Updates (January 2026)
- **Mobile API Auto-Detection**: Mobile app now automatically uses Replit dev server in development mode and production URL in App Store builds - no manual configuration needed
- **Mobile Map Team Locations Fix**: Fixed bug where mobile map was ignoring `activityStatus` from API response - now correctly displays team member status
- **Route Permissions Fix**: Fixed critical bug where /leads and /recurring-jobs pages were redirecting to dashboard - added missing routes to PAGE_PERMISSIONS in client/src/lib/permissions.ts
- **RecurringJobs EmptyState Fix**: Fixed React render error in RecurringJobs.tsx by passing icon as component reference instead of JSX element
- **SMS Delivery for Documents**: Quotes, invoices, and receipts can now be sent via SMS in addition to email, with a unified SendDocumentModal component
- **Context-Aware Quick Actions**: Job detail view shows "Running Late" vs "On My Way" button based on whether the job's scheduled time has passed
- **Voice Note Transcription**: AI-powered voice transcription with "Add to Notes", "Copy", and "Edit" buttons for quick workflow integration
- **Authentication Improvements**: All API calls now properly include auth headers for Safari/iOS token-based authentication
- **Quick Actions from Dashboard**: All dashboard types now include quick action buttons for Log Hours, Photo Receipt, and Request Payment navigation
- **First-Time User Video Walkthrough**: 6-step interactive intro walkthrough for new users with localStorage tracking and replay option in Settings
- **Recurring Job Templates**: Full CRUD for weekly/monthly maintenance contracts with RecurringJobs.tsx management page
- **Before/After Photo Comparison**: Side-by-side, slider, and overlay viewing modes for comparing job photos (integrated into JobPhotoGallery)
- **Simple CRM / Lead Pipeline**: Kanban-style lead tracking from enquiry to won/lost with convert-to-client functionality (/leads page)
- **End-of-Day Summary Email**: Daily digest email with jobs completed, invoices, quotes, payments, and action items (configurable in Automations)
- **Dashboard Pipeline Integration**: Added "Pipeline & Recurring" section to both OwnerManagerDashboard and TeamOwnerDashboard showing active leads count (hot/new) and recurring jobs due this week with direct navigation links
- **Data Consistency Fixes**: Fixed three data synchronization issues:
  - Job Map now geocodes addresses on-the-fly with Australian suburb fallback (shows 40 jobs correctly)
  - Team Operations uses tradieStatus table (same as map) for consistent Working/Online status display
  - Revenue Export falls back to createdAt when paidAt is missing, matching dashboard totals
- **Mobile Quote/Invoice Email with PDF**: Fixed "Open Email App" option to now download PDF and use native share sheet - PDF is automatically attached when shared to any email app. User picks their preferred email app from share sheet
- **Production Security Hardening**: Added rate limiting to auth/payment endpoints, idempotency keys to Stripe Terminal to prevent double-charges, demo data seeding gated to development mode only
- **Mobile UI Polish**: Removed redundant Quick Actions section from dashboard (FAB handles this), improved map page z-index hierarchy to eliminate overlapping elements (header z30, legend/banner z25, FAB z20, route panel z18, team chips z15)
- **Email Sending Error Message Improvement**: Updated quote and invoice email error messages when Gmail isn't connected in manual mode - now suggests switching to 'Automatic' mode as an alternative to connecting Gmail
- **Team Member Map UX Overhaul**: Fixed "gimmicky" team chips at bottom of map - chips now actually do something when tapped: fly to team member location, open their popup with full details, and provide quick message action button. Fixed race condition when rapidly tapping multiple chips.
- **Mobile Map Life360 Polish**: Reduced team markers from 46px to 36px (selected 42px), activity dots from 14px to 11px, and name labels from 11pt to 10pt for cleaner proportions. Lowered team chips bar closer to bottom nav. Fixed Cancel button on assign mode banner with inline handler and hitSlop for better iOS touch handling. Improved overall shadow weights and visual hierarchy.