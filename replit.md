### Overview
TradieTrack is a mobile-first web application for Australian tradespeople. The core positioning is: **"Built for how jobs actually run — not how paperwork pretends they do."** 

TradieTrack keeps a clear record of what was known, done, and agreed — so tradies don't wear someone else's mistake. It centralizes job management, quoting, invoicing, and payment collection with full Australian GST and AUD support. Key capabilities include Job Scope Checklists (to catch commonly missed quote items), comprehensive change tracking with photos and notes tied to timeline, and flexible workflows that support both architect/builder referrals AND direct customer calls.

**Product Truth**: TradieTrack doesn't try to control the job — it records it clearly as it changes.

**Positioning Strategy** (avoid "smart/AI-powered" marketing):
- Focus on "documenting reality as jobs change" rather than "intelligent automation"
- Address tradie skepticism with practical record-keeping benefits
- Emphasize: Photos tied to jobs, notes tied to moments, changes tracked as they happen, clear history of what was agreed

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and customizable theming, including a "Today's Schedule" dashboard, Quick Add Client, and Smart Address Auto-fill. iPad support includes orientation-aware navigation with dynamic layouts.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
*   **AI Integration**: GPT-4o-mini is used for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision enables AI Photo Analysis, and the system includes an AI Schedule Optimizer and AI-powered voice note transcription. A Role-Aware AI Assistant adapts to user roles with filtered context and permission-gated actions.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices via Puppeteer, with customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
*   **Live Quote/Invoice Editor**: Real-time preview, catalog item integration, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Payment Collection**: Stripe Payment Links, "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade flows and granular team member access control.
*   **Email Automation**: SendGrid integration for customizable emails with AI suggestions.
*   **PWA Support**: Offline capabilities via web manifest and service worker.
*   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration, unified in a Microsoft Teams-style Chat Hub. Real-time WebSocket updates synchronize UI for job status, timers, documents, payments, and notifications.
*   **Team Operations Center**: Centralized hub for live operations, administration, scheduling, and performance monitoring.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization and job search.
*   **Role-Based Access Control (RBAC)**: Granular permissions enforced through middleware and a dual-permission system with offline caching.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart synchronization across web and mobile (IndexedDB and SQLite), including time tracking and payment drafts.
*   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
*   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs.
*   **Financial Management**: Unified dashboard with key performance indicators.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced two-way Xero, MYOB AccountRight, and Google Calendar integrations.
*   **Xero Integration (ServiceM8/Tradify Feature Parity)**: Comprehensive bidirectional Xero sync including:
    - OAuth 2.0 authentication with token refresh and multi-tenant support
    - Two-way contact sync (TradieTrack ↔ Xero)
    - Invoice sync TO Xero (with duplicate prevention)
    - Payment sync TO Xero (when invoice marked paid)
    - **Payment sync FROM Xero** (mark invoices paid when Xero shows payment received) - uses batch retrieval (50 invoices/batch) with If-Modified-Since for efficient incremental polling
    - **Invoice status sync FROM Xero** (detect voided/cancelled invoices) - incremental sync only checks recently modified invoices
    - **Credit notes sync FROM Xero** (apply credits to invoices)
    - **Inventory items sync FROM Xero** (sync to catalog)
    - Quote sync TO Xero (as draft invoice)
    - Chart of accounts, bank accounts, and tax rates mapping
    - Full bidirectional sync endpoint for polling (every 5-30 minutes)
    - Proper error handling for 304 Not Modified and 404 responses
    - API routes: `/api/integrations/xero/full-sync`, `/api/integrations/xero/sync-payments-from-xero`, `/api/integrations/xero/sync-invoice-status`, `/api/integrations/xero/sync-credit-notes`, `/api/integrations/xero/sync-inventory`, `/api/integrations/xero/void-invoice/:invoiceId`, `/api/integrations/xero/detailed-status`
    - **Future Enhancements**: Persistent Xero payment ID tracking for partial payment reconciliation, response paging for very large datasets
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
*   **Templates Hub**: Focuses on Document Styles with integrated live preview for quotes, invoices, and jobs.
*   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
*   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
*   **Feature Implementation Roadmap**: 11-feature roadmap in `docs/FEATURE_IMPLEMENTATION_PLAN.md` covering all competitor gaps (Weather Widget, Service Reminders, Billable Time, Trade Calculators, Team Groups, Rebate Tracking, QuickBooks, Site Photos, Activity Feed, Invite Links, AI Visualization).
*   **Defect Tracking**: Management of warranty work and defects with severity levels and photo attachments.
*   **Timesheet Approvals**: Workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: Kanban-style lead tracking with convert-to-client functionality.
*   **Immersive Onboarding**: Full-screen onboarding with a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour.
*   **Demo Data Management**: Demo data is preserved across server restarts and includes safe deletion mechanisms.
*   **Unified Notifications**: Single endpoint for system, SMS, and chat notifications across web and mobile.
*   **Document Template System**: 81 balanced templates (9 trades × 9 templates each) are seeded for new users, adhering to Australian standards, with trade filtering and general fallback templates.
*   **Trade-Specific Customization System**: Supports 13 priority trades with trade-specific terminology, custom job stages, custom fields, material catalogs, rate cards, safety checklists, and quote categories.
*   **Job Scope Checklist System**: Comprehensive job templates with detailed checklists to prevent missing items in quotes. Features:
    - 15+ job scope templates covering plumbing (hot water, toilet, tap, blocked drain, gas appliance), electrical (powerpoint, downlights, switchboard, ceiling fan, smoke alarms), HVAC (split system, service), building (deck construction), roofing (gutter replacement), and tiling (bathroom floor)
    - Each template includes categorized items: labour, materials, compliance, safety, and disposal
    - "Commonly Missed" warnings highlight items tradies often forget (compliance certificates, disposal costs, safety isolation)
    - Searchable checklist with category filtering
    - AI-powered missing item detection analyzes current quote items and suggests forgotten items
    - API routes: `/api/job-scope-templates`, `/api/job-scope-templates/:templateId`, `/api/catalog/search`, `/api/catalog/categories/:tradeId`, `/api/quotes/check-missing-items`
    - Integrated into LiveQuoteEditor for seamless quote creation workflow
*   **QuickCreateFAB Component**: Replaces full-width bottom sheet with a centered floating widget popup for quick actions.
*   **Mobile Collect Payment Redesign**: Overhauled mobile payment flow to include "Record Payment" and QR code generation, with receipt generation and optional linking.
*   **Job Assignment Request System**: Team members can request assignment to available unassigned jobs, with owner approval/rejection.
*   **Time Tracking Enhancements**: Includes break/pause functionality, separate tracking for work vs. break time, auto job status updates, job costing widget, and billable/non-billable time toggle with visual indicators (green $ for billable, grey clock for non-billable). Time entries can be categorized: work, travel, admin, training, meeting, materials.
*   **Trade-Type Aware Templates**: Business templates are filterable by trade type with a fallback hierarchy.
*   **Trade-Specific Safety Forms System**: 18 Australian WHS-compliant safety checklists are auto-seeded, including pre-work and post-work forms with trade-specific items and digital signatures.
*   **Unified Communication Components**: Features for graceful SMS fallback, unified send modals for documents, before-photo prompts, and client contact cards with automatic Twilio/manual fallback detection.
*   **Unified Chat Hub with Job-Centric Design**: Jobs are primary navigation items in the conversation list, with filtering options for team, jobs, and unassigned enquiries. Site photos are displayed as thumbnails in job conversation list and chat headers via `/api/jobs/site-photos` endpoint.
*   **Today Widget**: Dashboard combines weather forecast (via Open-Meteo API with 30-minute caching), today's job schedule, and quick stats including job counts by status, outstanding invoice total, and weekly revenue.

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