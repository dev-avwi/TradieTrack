### Overview
JobRunner is a mobile-first web application for Australian tradespeople. Its primary purpose is to accurately record job progress, agreements, and changes to prevent disputes. It serves as a centralized platform for job management, quoting, invoicing, and payment collection, including support for Australian GST and AUD. The platform focuses on documenting the evolving reality of jobs to enhance efficiency and reduce conflict in the trades industry.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application built with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and features like "Today's Schedule" and Smart Address Auto-fill.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, secure password reset, and unified identity management.
*   **Onboarding**: A multi-step wizard for business details, logo upload, Stripe setup, team invites, client portal preview, and sample data seeding.
*   **AI Integration**: Leverages GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, quote generation, voice note transcription, photo auto-categorization, receipt scanning, and SWMS hazard detection. GPT-4o vision powers AI Photo Analysis, AI Schedule Optimizer, and Voice-to-Action detection. A Role-Aware AI Assistant provides context-filtered actions.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs via Puppeteer, including GPS Worker Presence Verification, photo GPS location stamps, and a unified "Safety & SWMS" section that combines SWMS documents with safety inspection form submissions.
*   **Analytics & Error Handling**: GA4 event tracking, global JS error capture, and server-side structured error logging.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and confirmation emails. Quote-to-Job flow automatically copies accepted quote line items as job materials (name, quantity, cost, price, status="needed") when creating a job from an accepted quote.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, rate snapshots, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording (bank transfer, cash, cheque) without requiring Stripe.
*   **Smart Payment Chaser**: Integrated into the Payment Hub as a dedicated tab. Provides AI-powered payment collection advice, prioritised chase queue with urgency levels (Friendly/Firm/Final Notice/Critical), chase history tracking, one-tap reminder sending with tone selection (friendly/professional/firm), and client contact shortcuts (call/email). KPI dashboard shows total overdue, clients to chase, average days overdue, and collection rate.
*   **Subscription & Billing**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade functionality, granular team member access, and a 7-day free trial.
*   **Multi-Business Subcontractors**: Supports subcontractors working for multiple businesses with a business switching mechanism.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Operations & Dispatch**: Features a Team Operations Center, a Visual Dispatch Board (Schedule, Kanban, Map views), Ops Health Banner, schedule conflict detection, and assignment-based dispatch with live location tracking. The Operations Centre includes panels for Unscheduled Jobs, Team Capacity, AI Scheduling, Live Status, Equipment Deployed, and Materials Needed. Team Schedule Board has week navigation (prev/next/Today), enhanced job cards showing client/suburb/status in grid cells, quick-assign dialog (click empty cell to assign unassigned jobs), clickable cells that navigate to Dispatch Board for that day (with ?date= param), weekly job counts per member, daily totals summary row, and unassigned jobs split into Urgent/Overdue vs Ready to Assign groups with estimated hours. Dispatch Board has quick-assign popup for unscheduled jobs (pick team member + time), cross-navigation link to Team Schedule Board, and enhanced Kanban board with drag-and-drop between columns (status updates), expandable cards with full details (address, phone, notes, date, status, time elapsed), priority badges (Urgent/High/Low), time-elapsed indicators for active jobs, team member filtering, column hour totals, and scrollable columns.
*   **Inventory & Equipment (Unified)**: Combined page at `/inventory` with sections for "Stock & Materials" and "Equipment & Assets".
*   **Visual Form Builder**: Custom form builder supporting 9 field types with conditional logic, drag-and-drop reorder, and CSV export.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, including a Subcontractor role. Team Admin shows role descriptions in invite dialog, permission breakdowns in Manage Roles dialog, permission summary badges and "What can they do?" expandable sections on member cards. Permission presets (Field Worker, Senior Tradie, Office Staff, Full Access) for one-tap setup. Workers can access Expenses and Safety/Templates pages.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with smart synchronization for major workflows and media.
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboard with KPIs, per-job profitability reporting, Payroll & Pay Run System, Aged Receivables Report, Team Utilisation Dashboard, and Worker Performance Cards.
*   **Enterprise Features**: Saved Filters + Advanced Search, Dual-view Team Scheduler, Progress Payments, Profit Margin by Job Type dashboard, Auto-Suggest Technician Assignment, all with full mobile parity.
*   **Mobile Parity (React Native/Expo)**: Full feature parity including: Material status tracking (needed/ordered/shipped/received/installed) with cost prompt, Smart Payment Chaser tab, Chat Hub SMS scoping fix with quick actions, Job Proof Pack generation & sharing, Client Portal link management, detailed Job Profitability card (revenue/costs/margin breakdown), status rollback, Weather Widget on dashboard, "To Invoice" KPI, Action Centre quick link, Expense tracking with AI receipt scanner (GPT-4o vision), Dispatch Board Map view (react-native-maps with job/team markers), SVG chart visualisations in Reports (bar + donut), Stripe payout listing, Progress Payments with full milestone management, safety check enforcement before starting jobs (WHS compliance warnings), and photo auto-tagging with materials category.
*   **Alerts & Summaries**: Job Aging Alerts, Daily Operations Summary, and Cashflow/Team Performance Dashboards.
*   **Customization**: Trade-Specific Customization System for 13 priority trades.
*   **Time Tracking**: Enhancements include break/pause, billable/non-billable toggles, job costing widget, categorizable entries, timesheet approvals, GPS signal logging, server-side stale timer detection, and GPS Proof of Presence.
*   **Compliance**: Compliance & Licensing Module for document management, status tracking, dashboard alerts, automated expiry notifications, and integration into Job Proof Pack.
*   **SWMS (Safe Work Method Statements)**: Full Australian WHS-compliant SWMS system with pre-built templates, risk matrix, PPE categories, worker sign-off with GPS capture, PDF generation, and AI Safety Scan for hazard detection from photos. Templates Hub includes SWMS template customization (creates editable copies) and "My SWMS Documents" section with edit/delete for user-saved documents.
*   **Production Hardening**: Includes GPS coordinate validation, geofence event API idempotency, PDF generation concurrency limits, mobile ErrorBoundary, Express global error middleware, list virtualization, admin endpoint auth guards, worker request IDOR fix, unified service worker registration, and defensive API response caching.
*   **Twilio SMS Integration**: Auto-initializes on startup with webhook auto-configuration (sets phone number's incoming SMS URL to `/api/sms/webhook/incoming`). Two-way SMS with AI intent detection, quote auto-acceptance, smart routing, and MMS support. Chat Hub provides unified messaging across Team Chat, Direct Messages, Job SMS, and Enquiries with real-time WebSocket updates, connection status indicators, retry for failed messages, and Twilio health warnings.
*   **Autopilot Enhancements**: "Technician On Their Way" auto-notification and batch invoicing.
*   **CRM & Client Management**: Client tags, client type classification, referral source tracking, smart segment filtering, and tag-based filtering.
*   **Deep-Link Navigation**: KPI widgets and action items deep-link to specific filtered views.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Client Portal Enhancement**: Job Portal enhanced with visual progress timeline, checklist progress summary, filtered activity feed, and custom tradie-to-client messages, with owner visibility controls.
*   **Voice-to-Action Detection**: GPT-4o-mini analyzes voice note text to detect action items (reminders, follow-ups, material needs, quote requests), stored as `detectedActions`.
*   **Photo Auto-Tagging**: GPT-4o vision auto-categorizes uploaded photos (before/after/progress/materials/general) asynchronously.
*   **Expenses Page**: Standalone `/expenses` page in sidebar (between Payment Hub and Schedule) for tracking all business expenses across jobs, scanning receipts, managing expense categories, and filtering by category/job. Includes receipt scanner and full CRUD.
*   **Receipt Scanner**: GPT-4o vision reads receipt photos to extract vendor, date, line items, subtotal, GST, and total for pre-filling expense forms.
*   **Photo Organiser**: Central photo library on the Files page with stats strip, category filters, job/client dropdowns, date-grouped grid, lightbox detail view, bulk actions, and standalone upload modal. Mobile parity includes native photo library features.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, including 81 seeded trade-specific templates. Safety Form Templates include 9 inspection form templates (Site Safety, Pre-Start Equipment, Scaffold, Electrical, Roof Safety, Confined Space, Vehicle Pre-Start, Fire Safety, Quality Assurance), plus safety, compliance, and SWMS categories with "use template" to create editable copies.

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