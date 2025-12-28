### Overview
TradieTrack is a mobile-first web application for Australian tradespeople. It centralizes and streamlines business operations, covering job management, quoting, invoicing, and payment collection, including Australian GST and AUD currency handling. The project aims to boost productivity, financial management, and client communication for solo tradies and small businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile. The backend is an Express.js and TypeScript REST API with Zod validation, backed by PostgreSQL and Drizzle ORM.

Key architectural decisions and features include:
-   **Authentication**: Supports Email/password, Google OAuth, and secure password reset.
-   **AI Assistant**: Integrates GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision is used for AI Photo Analysis.
-   **PDF Generation**: Server-side PDF generation for quotes and invoices using Puppeteer. Invoice PDFs (download, preview, email, public) consistently use Templates Hub terms & warranty templates with fallback chain: custom template → business.invoiceTerms → default terms.
-   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard. Includes Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation. Customizable theming and branding.
-   **Adaptive Solo/Team Mode**: Adjusts UI and features (e.g., time tracking, GPS check-in) based on team size.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, stage timestamps, and rollback capability.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Payment Collection**: Includes Stripe Payment Links, Tap to Pay (with simulation mode, PDF receipt generation, email/SMS delivery, QR code support), and a comprehensive receipt system with unique numbering and activity logging.
-   **Quote Acceptance Flow**: Automatically updates job status upon client acceptance.
-   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with 14-day free trials, Stripe checkout, automated billing reminders, and cross-platform sync.
-   **Email Automation**: SendGrid integration for customizable invoice/quote emails with PDF attachments and AI suggestions.
-   **PWA Support**: Offline capabilities via web manifest and service worker.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access. Includes two-way Twilio SMS integration with AI analysis, auto-creation of conversations for unknown numbers, and quick reply templates.
-   **Life360-Style Team Hub** (`/team-dashboard`): Interconnected team experience with 3-panel layout showing Team Status Board (presence dots, member status), Activity Feed timeline (job/quote/invoice events), and Team Map (live locations). Includes status selector (Online/Busy/On Job/Break/Offline) and 30-second heartbeat for real-time presence tracking.
-   **Microsoft Teams-Style Chat Hub** (`/chat`): Unified conversation inbox combining Team Chat, Customer SMS, Job Threads, and Direct Messages. Features 3-column layout with filter tabs (All/Team/Customers/Jobs), type-specific icons/colors, and context panel for customer/job details.
-   **Live360-Style Interactive Map**: Displays job pins and real-time location tracking for team members with geofence alerts (Owner/Manager only).
-   **Role-Based Access Control (RBAC)**: Granular permissions (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware.
-   **Team Management Hub**: Interface for owners/managers to manage team members, assignments, and permissions.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync, and permission-aware navigation. Features iOS Liquid Glass UI and iPad Sidebar Layout.
-   **Comprehensive Offline Mode**: Full offline-first support for major workflows including job, time, invoice, quote, and client management, with smart sync for conflict detection.
-   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web. Includes photo markup/annotation.
-   **Route Optimization**: Haversine distance calculation with nearest-neighbor algorithm for daily jobs.
-   **Recurring Invoices & Jobs**: Toggle for recurring invoices/jobs with frequency and end date options.
-   **Financial Management**: Unified dashboard with KPIs.
-   **Documents Hub** (`/documents`): Consolidated view of quotes, invoices, and receipts with KPI header (Total Quotes, Outstanding Invoices, Total Received). Features status-based card borders, colored tab indicators (blue/amber/green), and document relationship links showing Quote → Invoice → Receipt workflow. Complete demo data chain available for testing.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
-   **Activity Feed**: Tracks lifecycle events.
-   **Unified Dashboard API**: Single endpoint for consistent web/mobile dashboard experience.
-   **Platform Admin Dashboard**: Dedicated interface for platform administrators.
-   **Integrations**: Xero, MYOB AccountRight, and Google Calendar integrations with OAuth 2.0 for contacts sync, invoice push, and calendar event management. A unified API provides integration status across platforms.
-   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signature support.
-   **Templates Hub**: Central management for all customizable content including Terms & Conditions, Warranty, Email/SMS templates, Safety Forms, Checklists, and Payment Notices. Features two-column live preview editor with merge field replacement, category-based navigation (Communications, Financial, Jobs & Safety), and automatic display on quotes/invoices. API at `/api/business-templates` with template families: terms_conditions, warranty, email, sms, safety_form, checklist, payment_notice. Full mobile parity via `mobile/app/more/business-templates.tsx` with hooks (`useBusinessTemplates`, `useIntegrationHealth`), native email client fallback (Gmail/Outlook/Apple Mail via Expo Linking), trigger badges showing purpose per template, and integration status warnings with quick-action buttons.
-   **Communications Hub** (`/communications`): Unified view of all sent emails and SMS messages. Features statistics cards (Total Sent, Emails, SMS, Delivered), filter tabs (All/Email/SMS), status filtering (Sent/Delivered/Pending/Failed), search by recipient/content, and clickable entity links to view related quotes/invoices/jobs. Aggregates data from activity logs and SMS conversations. Owner/Manager access only.

### External Dependencies
-   **Database**: PostgreSQL (via Neon serverless)
-   **Email Service**: User SMTP, Gmail Connector, SendGrid Platform
-   **Payment Processing**: Stripe (Stripe Connect Express)
-   **PDF Generation**: Puppeteer
-   **UI Components**: Radix UI (via shadcn/ui)
-   **Styling**: TailwindCSS
-   **Fonts**: Google Fonts (Inter)
-   **AI Integration**: Replit AI Integrations (GPT-4o-mini)
-   **SMS Notifications**: Twilio
-   **Object Storage**: Google Cloud Storage (GCS)
-   **Maps**: Leaflet with react-leaflet
-   **Accounting Integration**: Xero, MYOB AccountRight