### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to streamline business operations from job creation and management to quoting, invoicing, and payment collection. It includes Australian GST handling and AUD currency, aiming to provide a comprehensive, efficient, and user-friendly solution for solo tradies and small businesses. The project's ambition is to empower tradies with tools that simplify daily tasks, improve financial management, and enhance client communication, ultimately boosting productivity and profitability.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application, using shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for validation, storing data in PostgreSQL managed by Drizzle ORM.

Key architectural features include:
-   **Authentication**: Supports Email/password, Google OAuth 2.0, session management, and secure token-based password reset.
-   **AI Assistant**: Integrates GPT-4o-mini for business-aware suggestions and Australian English phrasing, including proactive notifications and quote generation. Also includes GPT-4o vision for AI Photo Analysis with streaming responses.
-   **AI Photo Analysis**: Streaming SSE endpoint at `/api/jobs/:jobId/photos/analyze` uses GPT-4o vision to analyse job photos and provide tradie-friendly summaries with photo references (e.g., "(Photo 1) Shows corroded pipe..."). UI component with "Analyse Photos" button, real-time streaming display, and "Add to Notes" functionality. Respects AI settings (aiEnabled, aiPhotoAnalysisEnabled) with 403 enforcement on backend.
-   **PDF Generation**: Server-side PDF generation via Puppeteer for quotes and invoices.
-   **Theming & Branding**: Comprehensive system for custom brand colors, typography, and appearance settings, persisting across sessions.
-   **UI/UX**: Mobile-first design with a native app feel, card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard. Includes features like Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
-   **Adaptive Solo/Team Mode**: Adjusts interface based on team size, featuring time tracking and GPS check-in (team mode).
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional job confirmation emails.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures. Web Share button uses navigator.share API with clipboard fallback.
-   **Stripe Payment Links**: Auto-generated checkout links stored on invoices (`stripePaymentLink`), included in emails, with webhook-triggered payment status sync and automatic receipt emails.
-   **Email Automation with PDF Attachments**: Invoice/quote emails automatically attach PDF copies via SendGrid. Welcome emails include 5-step quick-start guide.
-   **Customisable Email Templates**: Preview and edit email content with AI-powered suggestions and Automated Gmail with PDF Workflow.
-   **PWA Support**: Web manifest and service worker for offline capabilities.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access. Includes two-way SMS integration via Twilio with templates, MMS, and branded sender IDs.
-   **AI SMS-to-Job Workflow**: Incoming SMS messages are analyzed by AI to detect job/quote requests. Shows confidence levels (high/medium/low) and intent types (quote_request, job_request, enquiry). "Create Job from SMS" action with AI-suggested titles, descriptions, and automatic MMS photo attachments. Auto-creates clients from phone numbers if not found.
-   **Live360-Style Interactive Map**: (Owner/Manager only) Displays job pins and real-time location tracking for team members with activity status, speed, battery, and geofence alerts.
-   **Role-Based Access Control (RBAC)**: Granular permissions and role templates (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware. Job assignment follows hierarchy: Owner assigns to anyone, Manager/Admin assigns to workers only. Sensitive client data (email, phone, address) is masked for managers without READ_CLIENTS_SENSITIVE permission. Supports role normalization for common tradie titles (Technician, Tradesman, Apprentice, etc.).
-   **Team Management Hub** (`/team`): Comprehensive team management interface for owners/managers with: per-member location sharing toggles (allowLocationSharing, locationEnabledByOwner), job assignment from team page, permissions editing, member removal, role management, and invite functionality. Enhanced member cards display avatar, role badges, hourly rate, start date, and location status.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval, previews, and toggle controls, including next-action indicators and pre-fill APIs.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync (15-min intervals), conflict resolution UI, quote/invoice line items caching, max 10 retry attempts with exponential backoff, and permission-aware navigation. Uses EAS development build for native module support (expo-av for voice recording). Native email integration via Linking.openURL for quote/invoice sending (opens Gmail/Outlook directly so users can customize before sending). AI Photo Analysis with SSE streaming support—uses fetch with ReadableStream reader for real-time text display with typing cursor; includes "Add to Notes" and "Discard" actions, respects aiEnabled/aiPhotoAnalysisEnabled business settings.
-   **Media Sync (Mobile ↔ Web)**: Photos, videos, voice notes, and text notes sync between mobile and web apps via shared backend APIs. Media is visible for ALL job statuses (not just in_progress/done/invoiced) to support team collaboration from job creation. Voice notes require EAS development build for recording (not available in Expo Go).
-   **Photo Markup/Annotation**: WebView-based canvas editor with pen, arrow, text, and rectangle tools. Color picker, stroke width selector, undo/clear functionality. Integrated into job photo viewer with Markup button.
-   **Video Capture**: Record videos up to 60 seconds or select from gallery. Video player modal with HTML5 playback. Videos displayed alongside photos with play icon overlay.
-   **Route Optimization**: Haversine distance calculation with nearest-neighbor algorithm. "Optimize Route" button reorders daily jobs by proximity starting from GPS location. Per-job "Get Directions" and multi-stop "Start Route" navigation to native maps apps.
-   **Recurring Invoices**: Toggle in invoice creation with frequency picker (weekly, fortnightly, monthly, quarterly, yearly). Optional end date. Recurring filter in invoices list with badges and next generation date display. Stop Recurring control in invoice detail.
-   **Financial Management**: Unified financial dashboard (`/money-hub`) combining invoices, quotes, and payments with KPI cards and quick actions. Supports recording on-site payments and generating Stripe payment links.
-   **Automation**: Rule-based SMS automation for reminders and follow-ups.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for retrieving and reusing job photos, quote items, invoice items, and notes. Smart pre-fill suggestions for new jobs/quotes/invoices.
-   **Activity Feed with Navigation**: Dedicated activity_logs table storing meaningful lifecycle events (job created/status changes, quote created/sent, invoice created/sent/paid). Activities include entityType and entityId for clickable navigation to detail views. Both web (using wouter) and mobile (using expo-router) support navigation to jobs, quotes, and invoices from activity items.

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
-   **Maps**: Leaflet with react-leaflet (CartoDB dark tiles)

-   **Recurring Jobs**: Toggle in job creation with frequency picker (weekly, fortnightly, monthly, quarterly, yearly). "Duplicate Job" action in job detail. Recurring badges and next occurrence date display. "Stop Recurring" control and recurring filter in job list.
-   **Xero Integration**: Full OAuth 2.0 flow with contacts sync and invoices push. Auto-sync when invoices are sent. Duplicate prevention via xeroInvoiceId tracking. XeroSetupGuide component with step-by-step instructions and FAQ accordion.
-   **MYOB Integration**: Removed from UI (December 2024) - focusing on Xero. Backend code retained for future use.
-   **Safety Form Templates**: Australian-standard WHS compliance templates including SWMS (Safe Work Method Statement), JSA (Job Safety Analysis), Toolbox Talk Record, Site Safety Inspection, and Incident/Near Miss Report. API endpoints at `/api/safety-form-templates` for retrieving templates. Templates include digital signature requirements and field-specific validation.

### Platform Admin Dashboard

-   **Admin Account**: admin@avwebinnovation.com / Admin123! - Platform admin with `isPlatformAdmin=true` flag
-   **Dedicated Admin Interface**: Admin users see a completely different UI (AdminAppShell) with admin-focused navigation
-   **Admin Navigation**: Overview, Users, Platform Activity, System Health, Settings (no Jobs, Clients, Quotes, Invoices)
-   **Admin Views**:
    - `/admin` - Overview dashboard with platform KPIs, user growth chart, feature usage stats
    - `/admin/users` - Detailed user management table with search, tier filter, status filter
    - `/admin/activity` - Platform activity log showing signups, onboarding, upgrades
    - `/admin/health` - System health status (API, DB, Background Jobs, Storage)
    - `/admin/settings` - Coming soon placeholder
-   **Security**: Admin access enforced via `isPlatformAdmin` database flag only (no email fallbacks)
-   **Route Protection**: Non-admin users redirected away from /admin/* routes

### Demo Mode & Testing

-   **Demo Account**: demo@tradietrack.com.au / demo123456 - Pre-loaded with 15 clients, 20 jobs, "Mike's Plumbing Services"
-   **DemoModeBanner**: Visual indicator when logged into demo account with helpful guidance
-   **DemoPaymentSimulator**: Simulates Stripe payment flow for demos (shows fee breakdown, processing animation)
-   **Test Users**: mike@northqldplumbing.com.au, luke@harriselectrical.com.au, tom@northqldplumbing.com.au (all password: Test123!)
-   **StripeSetupGuide**: In-app Stripe Connect setup documentation on Integrations page
-   **XeroSetupGuide**: ServiceM8-style Xero connection guide with benefits, steps, and FAQ

### Documentation

-   **COMPREHENSIVE_APP_RATING.md**: Updated 9.0/10 app rating with ServiceM8 comparison (upgraded from 8.7/10)
-   Key Strengths: Modern UI (9.0), Job Management (9.5), AI Features (8.6), Offline Support (9.0), Integrations (8.5)
-   All Priority 1 & 2 features now complete: Xero integration (with auto-sync), photo markup, video capture, route optimization, recurring jobs/invoices