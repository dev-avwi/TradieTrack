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
-   **Adaptive Solo/Team Mode**: Adjusts UI based on team size, enabling time tracking and GPS check-in for team mode. Onboarding wizard starts with "How many people work in your business?" question - solo users skip team invitation step.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Stripe Payment Links**: Auto-generated links for invoices with webhook-triggered payment status sync.
-   **Tap to Pay Payment Collection**: Complete mobile payment system with:
    - Simulation mode detection with demo banner on collect screen
    - PDF receipt generation with business branding, GST breakdown, and "PAID" watermark via `generatePaymentReceiptPDF()` in pdfService.ts
    - Receipt delivery via email (SendGrid with PDF attachment) and SMS (Twilio)
    - QR code payment support using qrserver.com API with scannable codes
    - Payment link generation via `/api/payment-requests` endpoint
    - Invoice pre-selection from job detail page via "Collect Payment" smart action
    - Mobile collect screen with QR modal, Payment Link modal, and clipboard/share functionality (expo-clipboard)
-   **Subscription & Billing System**: Three-tier pricing (Free, Pro $39/month, Team $59/month + $29/seat) with 14-day free trials. Stripe checkout with upfront card collection, automated billing reminders (email/SMS 3 and 1 days before billing), cross-platform subscription sync via REST API. Subscription page with pricing cards and trial information.
-   **Email Automation**: SendGrid integration for invoice/quote emails with PDF attachments and customisable templates with AI suggestions.
-   **PWA Support**: Offline capabilities via web manifest and service worker.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access. Includes two-way SMS integration via Twilio with AI analysis for job/quote requests. Enhanced SMS Hub features:
    - Auto-creation of conversations for inbound SMS from unknown numbers (no messages lost)
    - Client phone matching with Australian number normalization (+61, 04xx formats)
    - "New SMS" dialog for initiating conversations with client search or manual phone entry
    - Delete/archive SMS conversations with confirmation
    - Unified notification dropdown showing SMS, chat, and system notifications
    - Sidebar notification badges with unread counts (refreshes every 30s)
    - "Create Client" option for unknown phone numbers directly from SMS view
-   **Live360-Style Interactive Map**: (Owner/Manager only) Displays job pins and real-time location tracking for team members with activity status and geofence alerts.
-   **Role-Based Access Control (RBAC)**: Granular permissions (OWNER, ADMIN, MANAGER, SUPERVISOR, STAFF) enforced by middleware.
-   **Team Management Hub**: Comprehensive interface for owners/managers to manage team members, including location sharing toggles, job assignment, and permissions editing.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync, and permission-aware navigation. Supports native email integration and AI Photo Analysis with streaming. Team Management and Integrations screens mirror web functionality.
    - **iOS Liquid Glass UI**: Native Apple-style translucent navigation using expo-blur BlurView (intensity 80) for both header and bottom tab bar. Content scrolls underneath for authentic iOS frosted glass effect. Android maintains solid Material Design backgrounds for platform consistency. HEADER_HEIGHT (56px) centralized in design-tokens.ts with platform-aware pageShell padding.
-   **Comprehensive Offline Mode**: Full offline-first support for all major workflows:
    - **Job Management**: Create, edit, status updates (pending→scheduled→in_progress→done→invoiced), notes editing, geofence settings (enabled, radius, auto clock in/out)
    - **Time Tracking**: Start/stop timer entries offline with local timestamps
    - **Dashboard Actions**: Quick status changes, job assignment/unassignment, "On My Way" notifications (queued as special action type)
    - **Invoice Management**: Create, edit, status updates
    - **Quote Management**: Create, edit with line items
    - **Client Management**: Create, edit with conflict detection
    - **Smart Sync**: Field-level change tracking to prevent null overwrites, exponential backoff retry (30s→2m→5m→15m→30m), max 10 retries, _previousValues for conflict detection, server-wins with local backup
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
-   **Xero Integration**: Full OAuth 2.0 flow for contacts sync and invoices push, with duplicate prevention. Mobile API methods for status check, contacts sync, and invoice push. Secure mobile OAuth with randomized state tokens (format: `mobile_{userId}_{timestamp}_{randomBytes}`) stored in memory with 10-minute expiry and automatic cleanup.
-   **Google Calendar Integration**: Per-user OAuth flow where each tradie connects their own Google Calendar account. Tokens stored in businessSettings (access_token, refresh_token, expiry, email). Jobs auto-sync to calendar when created/updated/scheduled (non-blocking). Events include comprehensive tradie workflow data: client contact info, address for navigation, job notes, status tracking with color-coded events (pending=yellow, scheduled=blue, in_progress=orange, done=green, invoiced=light green, cancelled=grey). Automatic 60min and 15min reminders configured per event. Mobile OAuth uses same secure state pattern as Xero with deep link callbacks (`tradietrack://google-calendar-callback`).
-   **Unified Integrations Status API**: Single endpoint (`/api/integrations/status`) returns status for Google Calendar, Xero, Stripe, and Twilio integrations. Used by mobile app for consistent cross-platform integration status display.
-   **Safety Form Templates**: Australian-standard WHS compliance templates (SWMS, JSA, etc.) with digital signature support.
-   **UX Polish (Dec 2024)**: Production-ready polishing across key features:
    - **ChatHub**: Skeleton loaders, offline banners ("You're offline — messages will send when reconnected"), tradie-focused empty states, job context cards for SMS, "last seen" indicators
    - **Reports**: Executive summary with Australian vernacular ("You've banked $X"), GST/BAS readiness badges (Q3 FY 2024-25), "Last refreshed" timestamp, actionable insights ("Chase overdue invoices"), skeleton loaders, export toasts
    - **Integrations/Email**: Verified status badge, "Send Test Email" CTA, Australian compliance tips (ABN, GST, ATO requirements), setup checklist with visual checkmarks
-   **ServiceM8-Style Chat Enhancements (Dec 2024)**: Enhanced SMS chat experience with:
    - **Client Insights Panel**: Responsive side panel showing client details, outstanding invoices, recent jobs. Opens via Info button in SMS header, uses Sheet on mobile (slide-over) and fixed panel on desktop. API endpoint: `GET /api/sms/conversations/:id/client-insights`
    - **Quick Actions Bar**: Horizontal scrollable row above input with Call, Create Job, and Create Quote buttons. Links to relevant pages with client/phone pre-filled
    - **Quick Reply Templates**: Australian-friendly pre-written messages ("On my way!", "Running late", "Job done", "Thanks", "Confirm", "Quote sent") that populate the input field with one tap
    - **Floating AI Chat**: Now hidden on `/chat` pages to prevent overlap with chat composer

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