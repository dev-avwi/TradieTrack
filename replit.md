### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to accurately record job progress, agreements, and changes to prevent disputes, offering a centralized platform for job management, quoting, invoicing, and payment collection. The platform supports Australian GST and AUD and includes features like Job Scope Checklists, comprehensive change tracking with rich media, and flexible workflows for various job types. The core vision is to document the evolving reality of jobs rather than enforcing rigid processes, aiming to enhance efficiency and reduce conflict in the trades industry.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts for iPads, and features like "Today's Schedule" and Smart Address Auto-fill.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and secure password reset. It includes enterprise-grade duplicate account detection with smart merge/link prompts and unified identity management.
*   **Onboarding**: A multi-step wizard collects business details, facilitates logo upload, Stripe payments setup, team member invites, client portal preview, and sample data seeding, with an adaptive flow based on subscription tier.
*   **AI Integration**: Leverages GPT-4o-mini for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision powers AI Photo Analysis, an AI Schedule Optimizer, and voice note transcription. A Role-Aware AI Assistant provides context-filtered actions.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs (containing timeline, hours, materials, photos, and invoice summary) using Puppeteer.
*   **Analytics & Error Handling**: GA4 event tracking for core business events, signup funnels, global JS error capture via ErrorBoundary with user-friendly fallbacks, and server-side structured error logging.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
*   **Financial System**: Features a live quote/invoice editor with real-time preview, catalog integration, deposit settings, and digital signatures. It includes a financial-grade invoice system with rate snapshots, invoice locking, audit trails, and calculation verification.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, and Quick Collect Payment.
*   **Subscription & Billing**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade functionality and granular team member access.
*   **Communication**: Customizable email automation via SendGrid, PWA support for offline capabilities, and real-time communication via WebSockets for Job Chat, Team Chat, Direct Messages, and two-way Twilio SMS integration with a unified Chat Hub. A Shared Number Smart SMS Routing system provides intelligent inbound/outbound SMS handling. All chat types (team, job, direct, portal) broadcast via WebSocket for instant delivery with 30s fallback polling. WebSocket connections use exponential backoff reconnection (1s-30s), ping/pong heartbeat, and page visibility-based reconnection. Chat endpoints enforce tenant isolation and rate limiting (30 msg/min per user).
*   **Operations & Dispatch**: Features a Team Operations Center, a Visual Dispatch Board with Schedule, Kanban, and Map views, an Ops Health Banner for alerts, and schedule conflict detection. Assignment-based dispatch supports subcontractor workflows and status progression with live location tracking during travel.
*   **Materials & Equipment Management**: Tracks per-job material lists with quantities, costs, suppliers, and receipts. Includes equipment management with CRUD operations, maintenance logs, job assignments, and utilization reporting.
*   **Access Control**: Role-Based Access Control (RBAC) enforces granular permissions with middleware and offline caching.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support for major workflows with smart synchronization (IndexedDB and SQLite), including time tracking and payment drafts. Photos, videos, voice notes, and text notes sync between mobile and web.
*   **Financial Reporting**: Recurring invoices and jobs, a unified dashboard with KPIs, per-job profitability reporting, a Profit Snapshot, and enhanced profitability reports (By Job, Client, Worker). Includes a Payroll & Pay Run System, Aged Receivables Report, and Team Utilisation Dashboard.
*   **Alerts & Summaries**: Job Aging Alerts for jobs stuck in status, a Daily Operations Summary, and Cashflow/Team Performance Dashboards.
*   **Customization**: Trade-Specific Customization System for 13 priority trades, allowing custom terminology, job stages, fields, material catalogs, and safety checklists.
*   **Time Tracking**: Enhancements include break/pause, billable/non-billable toggles, job costing widget, categorizable entries, timesheet approvals, and GPS signal logging with geofence notifications. Server-side stale timer detection auto-stops orphaned timers after 12 hours (capped at 8-hour duration) via a 30-minute scheduled sweep (`server/staleTimerService.ts`).
*   **Compliance**: A Compliance & Licensing Module manages documents with status tracking, dashboard alerts, Compliance Pack PDF export, and automated daily expiry notifications (30-day/7-day/expired tiers).
*   **Production Hardening**: GPS coordinate validation across 8 location endpoints (Australian bounds, null island rejection, 500m accuracy threshold). Geofence event API includes 60-second idempotency dedupe, 1-minute minimum timer before auto-clock-out, and structured JSON logging. PDF generation has concurrency limits (max 3), 30-second timeouts, and browser close safety. Mobile app has a top-level ErrorBoundary wrapping the root layout with crash recovery and device debug info. Express server has global error middleware with structured JSON logging, request ID correlation, and process-level uncaughtException/unhandledRejection handlers. Main mobile lists (jobs, clients, invoices, quotes) use FlatList virtualization for performance. API endpoints for jobs/clients/invoices support optional `limit`/`offset` pagination with `X-Total-Count` headers. Support screen includes a Debug Info section showing app version, device, sync status, and a "Copy Debug Info" button for support tickets.
*   **Deep-Link Navigation**: KPI widgets and action items deep-link to specific filtered views within the application.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Templates Hub**: Focuses on Document Styles with live preview for quotes, invoices, and jobs, including 81 seeded trade-specific templates.

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