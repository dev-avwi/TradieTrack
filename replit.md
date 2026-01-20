### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, including job management, quoting, invoicing, and payment collection. The platform offers specific support for Australian GST and AUD currency, aiming to enhance productivity, financial management, and client communication for solo tradespeople and small businesses. Key capabilities include AI-driven scheduling optimization, multi-option quote generation, and comprehensive financial tracking.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack employs an event-driven architecture built with TypeScript. The frontend leverages React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile responsiveness. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A companion React Native/Expo mobile application integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:

*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and customizable theming. Key features include a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
*   **AI Integration**: GPT-4o-mini is used for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision enables AI Photo Analysis, and the system includes an AI Schedule Optimizer and AI-powered voice note transcription.
*   **Role-Aware AI Assistant**: The AI assistant adapts to user roles with filtered context and permission-gated actions:
    *   **Context Filtering**: Workers see only their assigned jobs (no financial data), managers see team workload, owners see full business including financials.
    *   **Role-Specific Prompts**: Workers get suggestions for job status, photos, and time tracking; managers for team scheduling; owners for financial insights.
    *   **Permission-Gated Actions**: ACTION_PERMISSIONS map in `/api/ai/execute-action` uses default-deny with `every()` check. Workers cannot execute owner-level actions like invoicing, quoting, or payments.
    *   **Rich Content**: AI responses include tappable entity links (jobs, quotes, invoices, clients) with status badges and amounts.
    *   **Action Confirmations**: Sensitive actions require user confirmation before execution.
    *   **Web-Mobile Parity**: Full feature parity with personalized greetings, animated thinking indicators, and suggested follow-ups on both platforms.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices is handled via Puppeteer, supporting customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators, professional confirmation emails, and rollback capabilities.
*   **Live Quote/Invoice Editor**: Provides real-time preview, catalog item integration, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Payment Collection**: Features Stripe Payment Links, "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: A three-tier pricing model (Free, Pro, Team) with smooth upgrade/downgrade flows and granular team member access control.
*   **Email Automation**: SendGrid integration for customizable emails with AI suggestions.
*   **PWA Support**: Offline capabilities are provided via web manifest and service worker.
*   **Real-time Communication**: Includes Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration with AI analysis, unified in a Microsoft Teams-style Chat Hub.
*   **Real-time WebSocket Updates**: The `useRealtimeUpdates` hook in App.tsx connects to `/ws/location?businessId={id}` for live UI synchronization. Broadcasts include job status changes, timer events, document updates (quotes/invoices), payment records, and notifications. React Query caches auto-invalidate on WebSocket messages, eliminating manual refreshes across views.
*   **Team Operations Center**: A centralized hub for live operations, administration, scheduling, skills/certifications, and performance monitoring.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions are enforced through middleware.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart synchronization across web and mobile. Key features include:
    *   **Web IndexedDB Storage**: Stores jobs, clients, quotes, invoices, time entries, payments, templates, and subscription cache with sync queue.
    *   **Sync Manager**: Centralized sync orchestration with exponential backoff retry, conflict detection (server-wins strategy with local backup), and ID reconciliation.
    *   **Offline Time Tracking**: Timer operations with heartbeat mechanism saving state every 30 seconds for crash recovery.
    *   **Offline Payment Drafts**: Record cash/EFTPOS/bank transfer payments offline with automatic sync on reconnect.
    *   **Sync Status UI**: Header indicator showing offline status, pending sync count, sync progress, and conflicts.
    *   **Subscription Caching**: TTL-based caching (24 hours) of plan/entitlement data for offline feature gating.
    *   **Mobile SQLite**: Comprehensive SQLite-based offline storage with subscription_cache table and sync queue.
*   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
*   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs, including templates.
*   **Financial Management**: A unified dashboard with key performance indicators.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced two-way Xero integration (payment marking, chart of accounts, tax rates, bulk sync), MYOB AccountRight, and Google Calendar integrations.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
*   **Templates Hub**: Centralized management for customizable content with live preview.
*   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
*   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
*   **Defect Tracking**: Management of warranty work and defects with severity levels and photo attachments.
*   **Timesheet Approvals**: Workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: Kanban-style lead tracking with convert-to-client functionality.
*   **Immersive Onboarding**: Full-screen onboarding with a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour highlighting UI elements.
*   **Demo Data Persistence**: Demo data is preserved across server restarts for consistent IDs.
*   **Safe Demo Data Deletion**: Demo record IDs are stored in `user.demoDataIds` (JSONB) during seeding. Clearing demo data only deletes records with tracked IDs, never touching user-created data.
*   **Unified Notifications**: A single endpoint `/api/notifications/unified` combines system, SMS, and chat notifications for both web and mobile.
*   **Permission System**: Two parallel permission systems (`WORKER_PERMISSIONS` and `ActionPermissions`) with a translation layer ensuring web and mobile parity, including offline SQLite caching for mobile.
*   **Document Template System**: 35 default templates (quote, invoice, job) are seeded for new users, adhering to Australian standards (GST, industry rates, payment terms).
*   **Trade-Specific Customization System**: A comprehensive trade catalog (`shared/tradeCatalog.ts`) supports 13 priority trades, each with:
    *   Trade-specific terminology and custom job stages.
    *   Trade-specific custom fields (e.g., circuit types for electricians, pipe sizes for plumbers).
    *   Default materials catalog with industry-standard pricing and trade-specific rate cards.
    *   Safety checklists tailored to each trade's requirements and specific quote categories.
    *   The `useTradeContext` hook provides frontend access to all trade-specific configurations.
*   **QuickCreateFAB Component**: Replaces the full-width bottom sheet with a centered floating widget popup for quick actions like New Job, New Quote, New Invoice, New Client, AI Assistant, and Collect Payment.
*   **Mobile Collect Payment Redesign**: Overhauled mobile payment flow to include "Record Payment" (for cash/EFTPOS/bank transfer) and QR code generation for Stripe payment requests, with receipt generation and optional linking to clients/invoices.
*   **Job Assignment Request System**: Team members can request assignment to available unassigned jobs, with privacy-protected job details. Owners receive and approve/reject these requests.
*   **Time Tracking Enhancements**: 
    *   Break/pause functionality with "Take Break" and "Resume Work" buttons
    *   Separate tracking for work time vs break time with visual display
    *   Auto job status updates: starting a timer on a "scheduled" job automatically changes status to "in_progress"
    *   Job costing widget calculates actual hours from time entries with variance display (estimated vs actual)
*   **Trade-Type Aware Templates**: Business templates (quote, invoice, job) are filterable by trade type with fallback hierarchy: specific tradeType → 'general' → all templates. Database column `trade_type` added to `business_templates` table with default 'general'.
*   **Mobile Payment Collection UI Improvements**:
    *   Reordered payment methods: Tap to Pay, QR Code, Payment Link, then Record Payment
    *   Ongoing payments are clickable with alert details
    *   Streamlined UI without amount input section
*   **Unified Communication Components**:
    *   **ManualSmsComposer**: Graceful SMS fallback when Twilio not configured - copies message to clipboard and opens native SMS app with phone number pre-filled
    *   **UnifiedSendModal**: Email/SMS tabs side-by-side for sending documents (jobs, quotes, invoices) to customers with template support
    *   **BeforePhotoPrompt**: Modal prompting users to capture "before photos" when starting job timer, with skip option and camera integration
    *   **Contact Client Card**: Email/SMS buttons on job detail view with automatic Twilio/manual fallback detection
    *   Mobile Chat Hub uses native Linking API for SMS/Email fallback when Twilio not connected
*   **Unified Chat Hub with Job-Centric Design**:
    *   Jobs are primary navigation items in the conversation list with briefcase icons and status badges
    *   ConversationItem types: 'team'|'direct'|'job'|'unassigned' - jobs are first-class conversation items
    *   "New" section shows unassigned SMS enquiries (messages not linked to any job) with orange icons
    *   Filter options: 'all'|'team'|'jobs'|'unassigned' for job-centric navigation
    *   ClientInsightsPanel accepts activeJobContext and onJobContextChange props for switching job context
    *   Visual separators between conversation items and section headers
    *   Empty state for jobs without SMS shows "No client messages" with prompt to add client phone
    *   Backend authorization uses `resolveAssigneeUserId` helper for proper assignedTo resolution
    *   SMS authorization checks on `/api/sms/send` and `/api/sms/quick-action` verify owner OR assigned member
    *   Quick action buttons (On My Way) visible to owner and assigned team members when Twilio connected

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