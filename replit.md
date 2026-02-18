### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople, aiming to accurately record job progress, agreements, and changes to prevent disputes. It centralizes job management, quoting, invoicing, and payment collection with full Australian GST and AUD support. Key features include Job Scope Checklists, comprehensive change tracking with rich media, and flexible workflows for both referral-based and direct customer jobs. The platform focuses on documenting the evolving reality of jobs rather than enforcing rigid processes.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application leveraging shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, "Today's Schedule" dashboard, Quick Add Client, Smart Address Auto-fill, and iPad-specific dynamic layouts.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In (web redirect flow with CSRF state + claim validation), and secure password reset with cross-platform session tokens. Enterprise-grade duplicate account detection with smart merge/link prompts (amber-themed security-focused UI with Shield icon, offering Sign In, Google, and Reset options). Unified identity management with automatic account linking for OAuth providers. Trust footer with security compliance indicators.
*   **Onboarding**: Multi-step wizard collecting trade category, business details (name, phone, email, address, ABN, GST, hourly rate), logo upload with preview, Stripe payments setup, team member email invites (for team plans), client portal preview, and sample data seeding. Adaptive flow based on subscription tier with auto-save between steps.
*   **AI Integration**: Utilizes GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision powers AI Photo Analysis. Includes an AI Schedule Optimizer and voice note transcription. A Role-Aware AI Assistant provides context-filtered, permission-gated actions.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs using Puppeteer. Job Proof Pack is a one-click export containing job timeline, hours per worker, materials/receipts, before/after photos, and invoice summary for dispute protection.
*   **Analytics Tracking**: GA4 event tracking for core business events: job_created, quote_sent, quote_accepted, invoice_sent, invoice_paid, payment_received, client_created, onboarding_completed, and landing page CTA clicks. Signup funnel tracking (signup_started, login_completed, onboarding_step_viewed). Global JS error capture and crash reporting via ErrorBoundary.
*   **Error Handling**: React ErrorBoundary with user-friendly fallback UI, global unhandled error/promise rejection capture with analytics, server-side structured error logging middleware with request context and slow-request warnings.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
*   **Live Quote/Invoice Editor**: Real-time preview, catalog item integration, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Financial-Grade Invoice System**: Rate snapshot system on line items (sourceType/sourceId/rateSnapshot), invoice locking after payment (lockedAt/lockedReason), invoice edit audit trail (invoiceEdits table), calculation hash verification before sending, minimum callout hours enforcement, and time entry validation on job completion (open timers, overlaps, negative durations blocked).
*   **Payment Collection**: Stripe Payment Links, "Tap to Pay Request Flow," QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade functionality and granular team member access.
*   **Email Automation**: Customizable emails with AI suggestions via SendGrid.
*   **PWA Support**: Offline capabilities via web manifest and service worker.
*   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments, two-way Twilio SMS integration, and a unified Chat Hub. WebSocket updates provide real-time synchronization for job status, timers, documents, payments, and notifications.
*   **Shared Number Smart SMS Routing**: Single Twilio number serves all businesses with smart routing state machine. Inbound SMS auto-routes by client phone → business match. Multi-business disambiguation (reply menu), multi-job selection, 24-hour auto-routing window, rate-limited re-prompts. Outbound SMS branded as "{BusinessName} via JobRunner:". Notification fan-out to business owner + job manager + assigned workers. Cross-tenant isolation enforced (unknown callers not assigned to arbitrary businesses). Future: dedicated per-business numbers for Pro/Team tiers.
*   **Team Operations Center**: Centralized hub for live operations, administration, scheduling, and performance monitoring.
*   **Visual Dispatch Board**: Three views — Schedule (timeline/calendar), Kanban Board (5-column status board), and Map View (Leaflet with job/worker pins). Uses `/api/dispatch/board` for unified data.
*   **Assignment-Based Dispatch**: All worker actions use assignment_id. Supports subcontractor accept/decline flow, "On My Way" with ETA calculation, status progression (assigned → en_route → arrived → working → done), and anti-spam SMS controls.
*   **Live Location Tracking**: LocationPing table stores GPS pings during travel. Portal and dispatch board show real-time worker location on map during EN_ROUTE status.
*   **Job Materials Tracking**: Per-job material lists with quantities, costs, suppliers, markup, receipts, and status workflow.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions enforced through middleware and a dual-permission system with offline caching.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart synchronization (IndexedDB and SQLite), including time tracking and payment drafts.
*   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
*   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs.
*   **Financial Management**: Unified dashboard with key performance indicators, per-job profitability reporting, and Profit Snapshot on owner dashboard (revenue, labour/material costs, gross profit, margin %).
*   **Profitability Reports**: Enhanced reporting with By Job, By Client, and By Worker tabs, date range filters, and margin analysis.
*   **Office Admin Role**: Dedicated role preset for office staff with permissions for quotes, invoices, clients, and communications (no time tracking/GPS).
*   **Simple Mode**: Toggle to hide team-heavy features for solo operators; auto-detects based on team members.
*   **Equipment Management**: Full CRUD for equipment registry, categories, and maintenance logs with status tracking. Job-equipment assignments via `job_equipment` join table with wrench indicators on Schedule cards and "Assigned to Jobs" in equipment detail sheets.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
*   **Xero Integration**: Comprehensive bidirectional sync including contacts, invoices, payments (two-way), invoice status, credit notes, and inventory items. OAuth 2.0 authentication with token refresh and multi-tenant support.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
*   **Templates Hub**: Focuses on Document Styles with integrated live preview for quotes, invoices, and jobs, and includes 81 seeded trade-specific templates.
*   **Communications Hub**: Unified view of all sent emails and SMS messages.
*   **Comprehensive Notification System**: Event-driven notifications for quote sent/accepted/declined, invoice sent/paid/overdue, job assignments, team invites, SMS received, timesheet submissions. Owner SMS alerts via Twilio for critical events (payments, quote responses, job completions). In-app notification center with unified feed (system + SMS + chat).
*   **Cashflow Insight Dashboard**: Owner dashboard widget showing weekly collection bar chart, this month vs last month comparison, due this week summary, and overdue invoice breakdown with days overdue badges.
*   **Team Performance Dashboard**: Per-worker performance metrics (hours tracked, jobs completed, revenue generated) with 30-day summary on owner dashboard.
*   **Automation Settings**: Configurable job reminders, quote follow-ups (with deduped scheduler), invoice overdue reminders (DB + push + SMS), photo requirements, and GPS auto check-in/out.
*   **Job Materials Tracking**: Per-job material lists with quantities, costs, suppliers, and shipping tracking, including a status workflow.
*   **Job Brief**: Quote line items automatically display as a work scope checklist in job detail view.
*   **Trade-Specific Customization System**: Supports 13 priority trades with trade-specific terminology, custom job stages, custom fields, material catalogs, rate cards, safety checklists, and quote categories.
*   **Time Tracking Enhancements**: Includes break/pause functionality, billable/non-billable toggles with visual indicators, job costing widget, and categorizable time entries. Features timesheet approvals, an audit trail, and weekly export.
*   **GPS Signal Logging & Geofence Notifications**: Logs GPS signal loss and provides geofence exit notifications to business owners, especially when timers are running.

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
*   **Accounting Integration**: Xero, MYOB AccountRight, QuickBooks Online
*   **Calendar Integration**: Google Calendar
*   **Weather API**: Open-Meteo