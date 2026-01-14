### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to centralize and streamline business operations. It handles job management, quoting, invoicing, and payment collection, with specific support for Australian GST and AUD currency. The platform aims to boost productivity, financial management, and client communication for solo tradies and small businesses through features like AI-driven scheduling optimization and multi-option quote generation.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack uses an event-driven architecture with TypeScript. The frontend is React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile. The backend is an Express.js and TypeScript REST API with Zod, PostgreSQL, and Drizzle ORM. A React Native/Expo mobile application integrates with the API, using Zustand for state management and SQLite-based offline mode.

Key architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and customizable theming. Features include a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
*   **AI Integration**: GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision for AI Photo Analysis. AI Schedule Optimizer and AI-powered voice note transcription.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer, with customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, and rollback capabilities.
*   **Live Quote/Invoice Editor**: Real-time preview, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Payment Collection**: Features Stripe Payment Links, "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with smooth upgrade/downgrade flows and team member access control. Seat semantics: seats=0 means owner only, seats=N means owner + N additional members.
*   **Email Automation**: SendGrid integration for customizable emails with AI suggestions.
*   **PWA Support**: Offline capabilities via web manifest and service worker.
*   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration with AI analysis. A Microsoft Teams-style Chat Hub unifies conversations.
*   **Team Operations Center**: Unified hub for live operations, administration, scheduling, skills/certifications, and performance.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions enforced by middleware.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart sync across web and mobile. Offline mutations are queued in IndexedDB and synced when online. IDs are reconciled post-sync.
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
*   **Immersive ServiceM8-Style Onboarding**: Full-screen onboarding with a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour highlighting UI elements.
*   **Demo Data Persistence**: Demo data (clients, jobs, quotes, invoices, receipts) is preserved across server restarts for consistent IDs.
*   **Unified Notifications**: Both web and mobile use the `/api/notifications/unified` endpoint, combining system, SMS, and chat notifications into a single feed.
*   **Permission System**: Two parallel permission systems (`WORKER_PERMISSIONS` and `ActionPermissions`) with a translation layer for web and mobile parity, including offline SQLite caching for mobile.
*   **Document Template System**: 35 default templates (quote, invoice, job) seeded for new users, adhering to Australian standards (GST, industry rates, payment terms). Templates are categorized by type, familyKey, and tradeType. Team members access owner's templates.
*   **Trade-Specific Customization System**: Comprehensive trade catalog (`shared/tradeCatalog.ts`) with 13 priority trades, each featuring:
    - Trade-specific terminology (e.g., "Work Order" and "Zone" for grounds maintenance, "Project" for builders)
    - Custom job stages per trade (e.g., "Design Phase" → "Installation" for landscaping)
    - Trade-specific custom fields (e.g., circuit types for electricians, pipe sizes for plumbers, area in hectares for grounds crew)
    - Default materials catalog with industry-standard pricing
    - Trade-specific rate cards (hourly rates, callout fees, after-hours multipliers)
    - Safety checklists tailored to each trade's requirements
    - Quote categories specific to each industry
    - The `useTradeContext` hook provides frontend access to all trade-specific configuration

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

### Recent Changes (January 2026)
*   **Trade-Specific Custom Fields Integration**: Integrated the `TradeCustomFieldsForm` component into `JobForm.tsx` and `LiveQuoteEditor.tsx`. When creating jobs or quotes, users now see trade-specific fields dynamically rendered based on their selected trade type (e.g., electricians see circuit types, plumbers see pipe sizes, grounds crew sees area in hectares). Custom field values are stored in the `customFields` JSONB column on jobs, quotes, and invoices tables. Fixed field property mapping (uses `field.name` for labels, `checkbox` type for toggles) and corrected `useTradeContext` hook to query `/api/auth/me`.
*   **Enhanced Trade Onboarding Preview**: The BusinessProfileStep now shows detailed "What's Included" benefits when selecting a trade category, including custom field names, materials catalog count, rate card details, safety checklists, quote categories, and typical job types as badges.
*   **Fixed Email Sending Bug**: Resolved undefined `baseUrl` variable in quote/invoice email handlers that caused custom/tone-adjusted emails to fail. Both `handleQuoteEmailWithPDF` and `handleInvoiceEmailWithPDF` now properly call `getProductionBaseUrl(req)`.
*   **Fixed Quote-to-Job Document Linking**: The `/api/jobs/:id/linked-documents` endpoint now checks both directions for document relationships - forward (quote.jobId → job) and reverse (job.quoteId → quote). This ensures jobs created from quotes properly show their linked quote in the Documents tab.
*   **Automatic Bidirectional Linking**: When creating a job from a quote, the quote's `jobId` is now automatically updated to point back to the new job, ensuring complete bidirectional linking.
*   **Subscription Flow Updates**: Added Pro→Team upgrade (7-day trial), Team→Pro downgrade, and team member suspension logic with proper grace periods for past_due status.
*   **Chat Hub Redesign**: Redesigned Chat Hub to be job-focused with "Job Communications" header. Added SMS conversation support with Twilio integration status checking (`/api/sms/status` returns `{ enabled, phoneNumber }`). Added clear Twilio setup guidance banners when not connected. Filter options: All, Team, Customers (SMS), Jobs.
*   **Job Assignment Request System**: Team members with `REQUEST_JOB_ASSIGNMENT` permission can view available unassigned jobs and request to be assigned. Privacy-protected: only minimal info shown (title, suburb, scheduled date, duration - no client name, phone, email, or full address). Owner receives requests and can approve/reject. Database table: `job_assignment_requests`. API: GET `/api/jobs/available`, POST `/api/jobs/:id/request-assignment`, GET `/api/job-assignment-requests`, POST `/api/job-assignment-requests/:id/respond`. UI in StaffTradieDashboard "Available Jobs" section.