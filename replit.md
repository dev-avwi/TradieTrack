### Overview
JobRunner is a mobile-first web application for Australian tradespeople. Its primary purpose is to centralize job management, quoting, invoicing, and payment collection, focusing on accurate documentation to prevent disputes and enhance efficiency. The platform supports Australian GST and AUD, aiming to streamline operations, improve financial management, and foster better communication within trades businesses. It includes capabilities for AI-powered business suggestions, quote generation, payment chasing, and comprehensive compliance management.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application built with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design emphasizing card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Key features include "Today's Schedule" and Smart Address Auto-fill. Mobile job detail now includes: Variations (create/send/approve/reject with signature), Linked Jobs (previous client jobs), Site Update (quick notes + photos), Job Documents (upload/preview/delete), and Proof Pack section toggles. Mobile feature parity screens: Leads (`mobile/app/more/leads.tsx`), Automations with Settings tab (`mobile/app/more/automations.tsx`), AI Visualization gallery (`mobile/app/more/ai-visualization.tsx`).
*   **Authentication**: Supports Email/password, Google OAuth, and Apple Sign-In.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for functionalities like business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs (with section toggle support on both web and mobile), incorporating GPS Worker Presence Verification and photo GPS location stamps. Proof Packs respect business document template styles (Professional/Modern/Minimal).
*   **Analytics & Error Handling**: GA4 event tracking and comprehensive server-side error logging.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators and automated email confirmations, and automated material transfer from quotes to jobs.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording, with automatic receipt dispatch.
*   **Smart Payment Chaser**: An AI-powered system for prioritized payment collection.
*   **Subscription & Billing**: Three-tier pricing with granular team member access and a 7-day free trial. Comprehensive AI feature gating via `requiresProPlan` flag on nav items (web + mobile) and `canUseAIFeatures` / `useFeatureAccess` hooks. Frontend-gated: FloatingAIChat, AIPhotoAnalysis, AIScheduleOptimizer, Autopilot, Automations, AI Visualization (nav + route redirect), AI Quote Generator button, AI Multi-Option Quote card, AI quote suggestions, AI email suggestions (EmailComposeModal, SendDocumentModal), Paste Job (AI parser), and mobile FloatingAIWidget. Backend-gated: All `/api/ai/*` endpoints enforce `requireProSubscription` middleware (returns 403 for free-tier users). Stripe webhook handler updates `subscriptionTier` on subscription lifecycle events. **Payment enforcement**: `getEffectiveTier()` in `subscriptionService.ts` immediately downgrades `past_due`/`canceled`/`unpaid` businesses to free-tier limits (restricts job/invoice/quote creation and blocks AI features). **Overdue reminders**: Daily scheduler sends escalating reminders at 1, 3, 7, 14, 21 days overdue via SMS (using "JobRunner" alphanumeric sender ID) and email with urgency tiers (reminder/urgent/final notice). Push notifications also sent. Frontend `PaymentOverdueBanner` component (in `App.tsx`) shows persistent red banner with "Update Payment" link when `subscriptionStatus === 'past_due'`. Mobile `useUserRole` hook checks `subscriptionStatus` and disables pro/team features when overdue.
*   **Multi-Business Subcontractors**: Functionality for subcontractors to manage jobs across multiple businesses.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Legal Entity**: All legal pages use "LinkUp2Care Pty Ltd (ABN 34 692 409 448) trading as JobRunner". Jurisdiction: Queensland, Australia. Terms of Service, Privacy Policy available on web (`/terms`, `/privacy`) and mobile (`more/terms-of-service`, `more/privacy-policy`).
*   **Subscription Pause**: Users can pause (`POST /api/subscription/pause`) and unpause (`POST /api/subscription/unpause`) their subscription via Stripe's `pause_collection` API. Paused subscriptions drop to free-tier limits with full data retained. Webhook handler derives paused state from `subscription.pause_collection != null`.
*   **Data Retention**: On cancellation, `subscriptionCanceledAt` and `dataRetentionExpiresAt` (12 months later) are set in `business_settings`. Financial records retained 5-7 years per Australian tax law. SMS logs retained 24 months. Location data 12 months. Audit trails retained account duration + 7 years (Fair Work Act).
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking.
*   **Inventory & Equipment**: Unified management of stock, materials, and equipment.
*   **Visual Form Builder**: Custom form builder with various field types and conditional logic.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions. Client data sanitization enforced on detail endpoints. Site photos filtered by job assignment for workers.
*   **Rate Limiting**: Database-backed rate limiting (PostgreSQL `rate_limits` table) with in-memory fallback for chat and portal endpoints.
*   **Twilio Webhook Security**: Incoming SMS webhook (`/api/sms/webhook/incoming`) validates `X-Twilio-Signature` header using `twilio.validateRequest()`. Fail-closed in production (rejects if no auth token configured). Dev mode allows passthrough for testing.
*   **Idempotency**: Database-backed idempotency cache (`idempotency_keys` table) for offline sync dedup. Keys scoped by entity type + user ID + client-generated ID to prevent cross-tenant data leaks. In-memory cache as fast path, DB as durable fallback surviving server restarts.
*   **Input Validation**: All API routes use Zod schemas for request body validation, including coordinates, geofence settings, invoice milestones, photo metadata, and voice note titles. Sub-resource update routes (photos, voice-notes, notes) enforce `WRITE_JOBS` RBAC permission.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue (prevents lost edits on rapid updates), idempotent record creation (prevents duplicates after crash), optimistic UI rollback on permanent failure, field-level conflict merging, and background sync failure notification.
*   **Bulk Actions**: Bulk delete clients/quotes and bulk status update jobs via dedicated API endpoints (`/api/clients/bulk-delete`, `/api/quotes/bulk-delete`, `/api/jobs/bulk-status`).
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboards with KPIs, per-job profitability, payroll system, and various financial reports.
*   **Time Tracking**: Includes break/pause functionality, billable/non-billable toggles, job costing, timesheet approvals, and GPS Proof of Presence.
*   **Compliance**: Compliance & Licensing Module for document management and automated expiry notifications.
*   **SWMS (Safe Work Method Statements)**: Australian WHS-compliant system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan.
*   **WHS Safety**: Comprehensive Work Health & Safety module based on White Card training (CPCCWHS1001). Features a visual dashboard overview with stat cards, action-required alerts, and recent document previews. Uses pill-based section navigation (Overview, Incidents, Hazard Reports, SWMS, JSA, PPE Checklists, Training, Emergency Plans, Environments, Signage, WHS Roles). Includes Incident Reports (6 types, 4 severities with witness/action tracking), Hazard Reports (proactive hazard reporting with risk levels, location, recommended actions, supervisor reporting), PPE Checklists (daily check-in with 9 PPE items — hard hat, hi-vis, safety boots, safety glasses, hearing protection, gloves, sunscreen, respirator, safety harness — per White Card PPE fitting assessment), Training Records (track qualifications/licences/certifications with RTO, expiry dates, certificate numbers; pre-loaded common courses like CPCCWHS1001, HLTAID011, RIIWHS204E etc.), Site Emergency Plans, JSA Builder, Hazardous Environment tracking, Safety Signage management, and WHS Role assignment. All forms (Incidents, Hazards, PPE, Training) include a live preview panel showing document format as you fill in the form. PDF generation available for Incident Reports, Hazard Reports, and PPE Checklists via `/api/whs/*/pdf` routes (with HTML sanitization and proper browser lifecycle management). SWMS documents are integrated from the existing SWMS system and shown in the WHS Safety hub. DB tables: `incident_reports`, `hazard_reports`, `ppe_checklists`, `training_records`, `site_emergency_info`, `jsa_documents`, `jsa_steps`, `site_hazardous_environments`, `site_safety_signage`. API routes: `/api/whs/*`. Web: `/whs` route (11 pill sections). Mobile: `/more/whs-hub` (8 tabs).
*   **Autopilot Enhancements**: Automated "Technician On Their Way" notifications and batch invoicing.
*   **CRM & Client Management**: Client tags, type classification, referral tracking, and smart segment filtering.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Client Portal Enhancement**: Enhanced Job Portal with visual progress timelines and custom messages, maintaining consistent branding.
*   **Voice-to-Action Detection**: AI analysis of voice notes to detect and log action items. Standalone `/api/voice-notes/transcribe` endpoint for AI Quote Generator voice input (SSRF-hardened with URL allowlist and size limits).
*   **Photo Auto-Tagging**: AI categorization of uploaded photos.
*   **Expenses Page**: Standalone page for tracking business expenses with a receipt scanner.
*   **Photo Organiser**: Central photo library with categorization, filters, and bulk actions.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, and Safety Form Templates.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS using OSRM, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio.
*   **Mobile GPS & Geofencing**: Geofence registration, auto-sync on startup, background tracking, geofence notifications, smart running late detection, and running late SMS with real ETA. Full push notification system with tap routing.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
*   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
*   **Payment Processing**: Stripe (Stripe Connect Express)
*   **Mobile Build**: iOS buildNumber `29` (bumped from 24; last submitted was #28). EAS slug: `tradietrack`. Bluetooth permission added for Stripe Terminal.
*   **PDF Generation**: Puppeteer
*   **UI Components**: Radix UI (via shadcn/ui)
*   **Styling**: TailwindCSS
*   **Fonts**: Google Fonts (Inter)
*   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
*   **SMS Notifications**: Twilio (two-tier SMS system: standard businesses use shared two-way platform number with quote acceptance detection; AI Receptionist businesses get a dedicated per-business Twilio number with full AI intent detection. SMS mode and dedicated numbers are admin-configured via `/api/admin/sms-config`. Schema fields: `business_settings.smsMode` ('standard'|'ai_receptionist'), `business_settings.dedicatedPhoneNumber`. Inbound routing checks dedicated numbers first for direct business routing, then falls back to shared number's smart multi-business disambiguation.)
*   **Object Storage**: Google Cloud Storage (GCS)
*   **Maps**: Leaflet with react-leaflet
*   **Accounting Integration**: Xero, MYOB AccountRight, QuickBooks Online
*   **Calendar Integration**: Google Calendar
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK (for iOS 17.6+). SDK loading disabled via `TAP_TO_PAY_ENABLED = false` in `useServices.ts` pending Apple Tap to Pay approval (Case-ID 18817353). Voice transcription uses `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit AI integration), not `OPENAI_API_KEY`.

### Production Reliability
*   **Graceful Shutdown**: Server handles SIGTERM/SIGINT by stopping new connections, closing the HTTP server, then cleanly closing the database pool. Force-exits after 10s timeout.
*   **API Error Contract (Mobile)**: The custom API client (`mobile/src/lib/api.ts`) returns `{ data?, error? }` — it does NOT throw for HTTP errors. All mobile screens check `response.error` before using `response.data`. The `catch` block only handles network failures/timeouts.
*   **Data Isolation**: All API routes scope queries to the authenticated user's business via `userId`/`effectiveUserId`. Admin routes are separately gated by `isPlatformAdmin`.
*   **Rate Limiting**: Applied to auth, password reset, payments, chat, and portal endpoints.
*   **Error Handling**: All mobile screens show user-visible error alerts on failure. No silent `catch {}` blocks remain.