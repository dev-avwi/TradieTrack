### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, offering features for job management, quoting, invoicing, and payment collection with specific support for Australian GST and AUD currency. The project aims to enhance productivity, financial management, and client communication for solo tradespeople and small businesses through advanced features like AI-driven scheduling optimization and multi-option quote generation.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack employs an event-driven architecture using TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile devices. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for the database, and Drizzle ORM. A React Native/Expo mobile application integrates with the API, featuring Zustand for state management and an SQLite-based offline mode.

Key architectural and design decisions include:
*   **UI/UX**: Mobile-first design principles are applied, incorporating card-based layouts, touch-optimized components, and customizable theming. Features such as a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation enhance user experience.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset mechanisms, ensuring cross-platform session token security.
*   **AI Integration**: GPT-4o-mini is utilized for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision powers AI Photo Analysis, complemented by an AI Schedule Optimizer and AI-powered voice note transcription.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices is handled by Puppeteer, supporting customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow is implemented, featuring visual indicators, professional confirmation emails, and rollback capabilities.
*   **Live Quote/Invoice Editor**: Provides real-time preview, catalog item management, deposit settings, quote-to-invoice conversion, Stripe Elements for deposits, and digital signature capabilities.
*   **Payment Collection**: Integrates Stripe Payment Links, supports a "Tap to Pay Request Flow" for in-person payments, QR code generation, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: A three-tier pricing model (Free, Pro, Team) with smooth upgrade/downgrade flows and team member access control, including seat semantics for managing additional members.
*   **Email Automation**: Utilizes SendGrid for customizable email delivery, enhanced with AI suggestions.
*   **PWA Support**: Offers offline capabilities through web manifest and service worker implementation.
*   **Real-time Communication**: Features Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration, including AI analysis. A Microsoft Teams-style Chat Hub unifies all conversations.
*   **Team Operations Center**: A unified hub for managing live operations, administration, scheduling, team skills/certifications, and performance monitoring.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking, including route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions are enforced via middleware.
*   **Comprehensive Offline Mode**: Supports offline-first workflows with smart synchronization across web and mobile platforms. Offline mutations are queued in IndexedDB and synced upon regaining connectivity, with ID reconciliation post-sync.
*   **Media Sync**: Ensures photos, videos, voice notes, and text notes, including photo markups, sync seamlessly between mobile and web.
*   **Recurring Invoices & Jobs**: Functionality for setting up and managing recurring invoices and jobs using templates.
*   **Financial Management**: A unified dashboard provides key performance indicators (KPIs).
*   **Documents Hub**: A consolidated view of quotes, invoices, and receipts, featuring KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints facilitate the reuse of job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced two-way Xero integration (including payment marking, chart of accounts, tax rates, bulk sync), MYOB AccountRight, and Google Calendar integrations.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signature support.
*   **Templates Hub**: Centralized management for customizable content with live preview.
*   **Communications Hub**: A unified view of all sent emails and SMS messages, with statistics and filtering capabilities.
*   **Automation Settings**: Configurable reminders for jobs, quotes, and invoices, along with photo requirements and GPS auto check-in/out.
*   **Defect Tracking**: Manages warranty work and defects, including severity levels and photo attachments.
*   **Timesheet Approvals**: Provides a workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: A Kanban-style lead tracking system with functionality to convert leads to clients.
*   **Immersive Onboarding**: A full-screen onboarding experience includes a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour to highlight UI elements.
*   **Demo Data Persistence**: Demo data (clients, jobs, quotes, invoices, receipts) is preserved across server restarts for consistent IDs.
*   **Unified Notifications**: Both web and mobile platforms utilize a single `/api/notifications/unified` endpoint to combine system, SMS, and chat notifications.
*   **Permission System**: Two parallel permission systems (`WORKER_PERMISSIONS` and `ActionPermissions`) with a translation layer ensure parity between web and mobile, including offline SQLite caching for mobile.
*   **Document Template System**: 35 default templates (quote, invoice, job) are pre-seeded for new users, adhering to Australian standards (GST, industry rates, payment terms). Templates are categorized, and team members access the owner's templates.
*   **Trade-Specific Customization System**: A comprehensive trade catalog (`shared/tradeCatalog.ts`) supports 13 priority trades, each with:
    *   Trade-specific terminology
    *   Custom job stages
    *   Trade-specific custom fields
    *   Default materials catalog with industry-standard pricing
    *   Trade-specific rate cards
    *   Safety checklists
    *   Quote categories
    *   A `useTradeContext` hook provides frontend access to all trade-specific configuration.
*   **iOS 26 "Liquid Glass" Design System**: Authentic Apple Liquid Glass aesthetic - light translucent materials that let content peek through. Navigation floats as a distinct functional layer above content.
    - **Glass tokens** (`GLASS_NAV`, `GLASS_CARD`, `GLASS_BUTTON`) with light overlays (8-18% opacity), subtle gradient sheens, and minimal borders
    - **Layered effects**: BlurView (moderate intensity 30-50) + light tint overlay + top highlight gradient for glass reflection
    - **Key principle**: Let the blur material do the work - minimal custom backgrounds per Apple guidance
    - **Haptic feedback** (`expo-haptics`) on tab presses, FAB, and quick actions
    - Android unchanged with solid backgrounds - all iOS styling gated behind `useGlassEffects()`

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