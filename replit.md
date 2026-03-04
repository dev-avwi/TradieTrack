### Overview
JobRunner is a mobile-first web application for Australian tradespeople, designed to accurately record job progress, agreements, and changes. It aims to prevent disputes and offers a centralized platform for job management, quoting, invoicing, and payment collection, including support for Australian GST and AUD. The platform emphasizes documenting the evolving reality of jobs rather than enforcing rigid processes, thereby enhancing efficiency and reducing conflict in the trades industry.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application utilizing shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and features like "Today's Schedule" and Smart Address Auto-fill. Mobile screens use theme-aware design tokens.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, secure password reset, duplicate account detection, and unified identity management.
*   **Onboarding**: A multi-step wizard for business details, logo upload, Stripe setup, team invites, client portal preview, and sample data seeding.
*   **AI Integration**: Leverages GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision powers AI Photo Analysis, AI Schedule Optimizer, and voice note transcription. A Role-Aware AI Assistant provides context-filtered actions.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs via Puppeteer. Proof Packs include 9 section toggles (Timeline, Worker Hours, GPS Verification, Materials, Variations, Photos, Invoice Summary, Compliance & Licensing, Subcontractor Coordination) and GPS Worker Presence Verification with geofence alert data. Photos include GPS location stamps when coordinates are captured at upload time.
*   **Analytics & Error Handling**: GA4 event tracking, global JS error capture via ErrorBoundary, and server-side structured error logging.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and confirmation emails.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, rate snapshots, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, and Quick Collect Payment.
*   **Subscription & Billing**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade functionality, granular team member access, and a 7-day free trial.
*   **Multi-Business Subcontractors**: Supports subcontractors working for multiple businesses with a business switching mechanism.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets for various chat types, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Operations & Dispatch**: Features a Team Operations Center, a Visual Dispatch Board (Schedule, Kanban, Map views), Ops Health Banner, schedule conflict detection, and assignment-based dispatch with live location tracking. The Dispatch Board includes a unified "Operations Centre" section with 6 panels: Unscheduled Jobs, Team Capacity, AI Scheduling, Live Status (jobs + equipment + materials counts), Equipment Deployed (equipment assigned to active/today's jobs), and Materials Needed (outstanding materials with needed/ordered/shipped status). Data aggregated via `/api/dispatch/resources` endpoint.
*   **Inventory & Equipment (Unified)**: Combined page at `/inventory` with two top-level section tabs: "Stock & Materials" (items, categories, low-stock, purchase orders) and "Equipment & Assets" (equipment list, maintenance, utilisation, job assignments). The `/equipment` route redirects to the equipment tab. Single sidebar entry replaces two separate entries.
*   **Visual Form Builder**: Custom form builder supporting 9 field types with conditional logic, drag-and-drop reorder, and CSV export.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, including a Subcontractor role.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with smart synchronization for major workflows and media.
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboard with KPIs, per-job profitability reporting, Profit Snapshot, enhanced profitability reports, Payroll & Pay Run System, Aged Receivables Report, and Team Utilisation Dashboard.
*   **Enterprise Features**: Saved Filters + Advanced Search, Dual-view Team Scheduler, Progress Payments, Profit Margin by Job Type dashboard, Auto-Suggest Technician Assignment, all with full mobile parity.
*   **Alerts & Summaries**: Job Aging Alerts, Daily Operations Summary, and Cashflow/Team Performance Dashboards.
*   **Customization**: Trade-Specific Customization System for 13 priority trades.
*   **Time Tracking**: Enhancements include break/pause, billable/non-billable toggles, job costing widget, categorizable entries, timesheet approvals, GPS signal logging, and server-side stale timer detection. GPS Proof of Presence captures clock-in/clock-out coordinates and addresses on time entries, surfaced in job detail view (Worker Attendance card), client portal (Worker Attendance section), and invoice PDFs (Worker Presence Verified table). Labour line items on invoices include GPS Verified tags. Business setting `includeLocationProofOnInvoices` controls whether GPS proof appears on PDFs.
*   **Compliance**: Compliance & Licensing Module for document management, status tracking, dashboard alerts, automated expiry notifications, and integration into Job Proof Pack (Section 7) showing all relevant trade licences, insurance, white cards, certifications, and vehicle registrations with status indicators.
*   **Production Hardening**: GPS coordinate validation, geofence event API idempotency, PDF generation concurrency limits, mobile ErrorBoundary, Express global error middleware, list virtualization for performance, admin endpoint auth guards (init-stripe-products, fix-team-price require isPlatformAdmin), worker request IDOR fix (ownership verification before status update), unified service worker registration (single sw.js path via registerServiceWorker.ts), and defensive API response caching (validates id before storing).
*   **Autopilot Enhancements**: "Technician On Their Way" auto-notification and batch invoicing.
*   **CRM & Client Management**: Client tags (text array), client type classification (residential/commercial/strata/insurance/government), referral source tracking, smart segment filtering with live counts (All, Residential, Commercial, VIP, Inactive 6mo+, Outstanding Balance), tag-based filtering, tag autocomplete, and tag badges on client cards/table rows. APIs: `GET /api/clients/tags`, `GET /api/clients/segments`.
*   **Deep-Link Navigation**: KPI widgets and action items deep-link to specific filtered views.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Photo Organiser**: Central photo library on the Files page (Photos tab) with stats strip (Total, This Week, Top Job, Storage), category filters (All/Before/During/After/Materials/General), job/client dropdowns, date-grouped grid with thumbnails, lightbox detail view, clickable job/client links for navigation, bulk actions (attach to job, recategorise, tag, delete), standalone upload modal with drag-and-drop/camera/gallery support, 25MB max file size, MIME type validation. Schema: `job_photos.tags text[]` column, `jobId` nullable for standalone photos. APIs: `GET /api/photos` (with filters/sort/join), `GET /api/photos/stats`, `GET /api/photos/tags`, `PATCH /api/photos/:id`, `PATCH /api/photos/bulk`, `POST /api/photos/upload-standalone`. Component: `client/src/components/PhotoLibraryTab.tsx`.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, including 81 seeded trade-specific templates.

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