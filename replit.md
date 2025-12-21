### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, from job creation and management to quoting, invoicing, and payment collection, including Australian GST and AUD currency handling. The project aims to provide an efficient and user-friendly solution for solo tradies and small businesses, enhancing productivity, financial management, and client communication.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack uses an event-driven architecture with TypeScript, featuring a mobile-first React 18 frontend with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API with Zod validation, using PostgreSQL and Drizzle ORM.

Key architectural decisions and features include:
-   **Authentication**: Supports Email/password, Google OAuth, and secure password reset.
-   **AI Assistant**: Integrates GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision is used for AI Photo Analysis with streaming responses.
-   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer.
-   **Theming & Branding**: Customizable brand colors and typography.
-   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard. Includes Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
-   **Adaptive Solo/Team Mode**: Adjusts UI based on team size, enabling time tracking and GPS check-in for team mode.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Stripe Payment Links**: Auto-generated links for invoices with webhook-triggered payment status sync.
-   **Email Automation**: SendGrid integration for invoice/quote emails with PDF attachments and customisable templates with AI suggestions.
-   **PWA Support**: Offline capabilities via web manifest and service worker.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access. Includes two-way SMS integration via Twilio with AI analysis for job/quote requests.
-   **Live360-Style Interactive Map**: (Owner/Manager only) Displays job pins and real-time location tracking for team members with activity status and geofence alerts.
-   **Role-Based Access Control (RBAC)**: Granular permissions (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware.
-   **Team Management Hub**: Comprehensive interface for owners/managers to manage team members, including location sharing toggles, job assignment, and permissions editing.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync, and permission-aware navigation. Supports native email integration and AI Photo Analysis with streaming. Team Management and Integrations screens mirror web functionality.
-   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web apps.
-   **Photo Markup/Annotation**: WebView-based canvas editor with various tools integrated into the job photo viewer.
-   **Video Capture**: Record or select videos up to 60 seconds.
-   **Route Optimization**: Haversine distance calculation with nearest-neighbor algorithm for daily jobs.
-   **Recurring Invoices & Jobs**: Toggle for recurring invoices/jobs with frequency picker and optional end dates.
-   **Financial Management**: Unified dashboard with KPIs for invoices, quotes, and payments.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
-   **Activity Feed**: `activity_logs` table for lifecycle events with clickable navigation to detail views.
-   **Unified Dashboard API**: Single endpoint (`/api/dashboard/unified`) for consistent web/mobile experience, aggregating dashboard data.
-   **Role-Based Quick Actions**: Dashboard quick actions contextualized by user role.
-   **Platform Admin Dashboard**: Dedicated interface for platform administrators (`isPlatformAdmin=true`) with views for Overview, Users, Platform Activity, System Health, and Settings.
-   **Xero Integration**: Full OAuth 2.0 flow for contacts sync and invoices push, with duplicate prevention.
-   **Safety Form Templates**: Australian-standard WHS compliance templates (SWMS, JSA, etc.) with digital signature support.

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
-   **Accounting Integration**: Xero