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