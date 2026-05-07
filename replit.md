### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to streamline job management, quoting, invoicing, and payment collection, ensuring accurate documentation to minimize disputes and boost efficiency. The platform aims to enhance communication, provide AI-powered business suggestions, manage compliance, and optimize financial operations, all while fully supporting Australian GST and AUD. The project's ambition is to centralize and simplify all aspects of a tradesperson's business.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner uses an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL, and Drizzle ORM. A dedicated React Native/Expo mobile application integrates with the API, employing Zustand and SQLite for offline capabilities.

Core architectural and design decisions include:

*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, and dynamic layouts. Features like "Today's Schedule" and Smart Address Auto-fill enhance mobile usability.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invitations.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **AI Receptionist**: A voice-based assistant (Vapi.ai + ElevenLabs) for automated SMS follow-ups, push notifications, call recording, and caller sentiment analysis.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, including GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: A four-tier pricing model with Apple In-App Purchase and Stripe integration, including server-side receipt verification.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, multi-worker time tracking, and real-time availability.
*   **Financial System**: A live quote/invoice editor with real-time preview, catalog integration, digital signatures, invoice locking, and audit trails. Supports various payment methods including Stripe Payment Links, "Tap to Pay Request Flow," and an AI-powered Smart Payment Chaser.
*   **Number Porting (BYOD)**: Allows porting existing phone numbers to the platform with admin-managed workflow and automated AI receptionist activation.
*   **Communication**: Features customizable email automation via SendGrid, PWA support, real-time WebSocket communication, two-way Twilio SMS integration with a unified Chat Hub, and Google Review request automation.
*   **Real-time Updates**: Implemented for job status, timer events, document status, payments, notifications, chat messages, and team presence, with TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, worker sign-off, AI Safety Scan, and a comprehensive WHS Safety module.
*   **Operations & Dispatch**: Features a Team Operations Center, Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking, and a Smart Operational Action Center.
*   **Multi-Business Workspace Switching**: Enables subcontractors to switch between different business workspaces with data isolation.
*   **Unified Team & Magic-Link Subcontractor Flow**: Centralized team management with magic-link invitations, secure session validation, and account upgrade paths for subcontractors.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, client data sanitization, and navigation elements gated by user roles and subscription levels.
*   **Sentry Filtering**: Mobile Sentry init filters events from sideloaded builds, emulators, and known Android OS-level crashes.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, and optimistic UI rollback.
*   **Smart GPS Features**: Provides real ETA in "On My Way" SMS, a Smart Job Dashboard with distance and drive time, and Photo MMS via Twilio. Includes background tracking, geofence notifications, and running late detection.
*   **Track My Arrival**: Public job portal displaying assigned workers with profile images and polished SMS templates for status updates.
*   **Website Addon Interactive Features**: Toggleable features for business websites including Click-to-Call, an AI Chat Widget, and a Booking Form.
*   **Aggregate API Endpoints**: Heavy pages use single aggregate endpoints to avoid request waterfalls, fetching multiple related data sets in parallel with per-section resilience.
*   **Team Seat Enforcement**: Hard server-side seat count enforcement for team member additions based on subscription tier and purchased extra seats.
*   **Founding Member System**: Manual assignment of founding member status provides full business-tier access.
*   **Server-Side Onboarding Guard**: Middleware enforces `onboardingCompleted` for business owners before accessing most API routes.
*   **Stripe Sync Persistence**: Persists live Stripe subscription status and tier to the database to prevent stale data.
*   **Verified Webhook Surfaces**: All inbound webhooks reject unsigned or wrong-signature requests with HTTP 401 before any side effect, and emit structured JSON logs.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
*   **Email Service**: SendGrid Platform, User SMTP, Gmail Connector, Outlook/Microsoft 365
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
*   **Calendar Integration**: Google Calendar, Outlook/Microsoft 365
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK
*   **AI Receptionist (Voice)**: Vapi.ai (enhanced with ElevenLabs)
*   **Error Tracking**: Sentry

### Mobile Bottom Sheet Migration (May 2026)
*   **@gorhom/bottom-sheet@^5.2.13**: Installed in `mobile/`. `GestureHandlerRootView` + `BottomSheetModalProvider` mounted at app root in `mobile/app/_layout.tsx`.
*   **`AppBottomSheet`** (`mobile/src/components/ui/AppBottomSheet.tsx`): Themed wrapper around `BottomSheetModal` with rounded top corners, themed handle/backdrop, `BottomSheetScrollView`, `keyboardBehavior="interactive"`. Exposes both an imperative API (via `useAppBottomSheet()` hook + ref) and a declarative `visible` prop (drives present/dismiss via `useEffect`) so legacy `<Modal visible={x}>` call-sites swap with minimal change. Props: `snapPoints`, `enableDynamicSizing` (default true), `enablePanDownToClose`, `onDismiss`, `title`, `showCloseButton`, `scrollable` (default true), `contentPadding` (default `spacing.lg`), `visible`.
*   **Round-9 Migration**: All `<Modal animationType="slide">` instances across the 20 target files converted to `AppBottomSheet` (98 modals total). `<Modal animationType="fade">` centered dialogs and full-screen photo/video viewers are intentionally retained as native modals. Files: `app/more/create-job.tsx`, `whs-hub.tsx`, `team-management.tsx`, `inventory.tsx`, `equipment.tsx`, `expenses.tsx`, `team-groups.tsx`, `time-tracking.tsx`, `service-reminders.tsx`, `collect-payment.tsx`, `invoice/[id].tsx`, `quote/new.tsx`, `quote/[id].tsx`, `invoice/new.tsx`, `app/job/[id].tsx`, and components `SubcontractorDashboard`, `CustomFormBuilder`, `FormRenderer`, `PhotoLibrary`, `AIPhotoAnalysis`.

### Round 10 Android Production Hardening (May 2026)
*   **Config (`mobile/app.json`)**: Pinned `jsEngine: "hermes"`, enabled edge-to-edge (`edgeToEdgeEnabled: true`), `predictiveBackGestureEnabled: true`, `softwareKeyboardLayoutMode: "resize"`, added `monochromeImage` for adaptive icon, removed legacy `READ/WRITE_EXTERNAL_STORAGE` permissions, bumped `versionCode` to 30, enabled `enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`, and inline `extraProguardRules` (mirrored in `mobile/android-proguard-rules.pro` for reference). Configured `expo-splash-screen` plugin with dark mode background.
*   **Assets**: `mobile/assets/adaptive-icon-monochrome.png` (432x432 white-on-transparent for Android 13+ themed icons), regenerated `mobile/assets/notification-icon.png` (256x256 white-on-transparent). Build script: `mobile/scripts/build-monochrome-icon.mjs`.
*   **Material Ripple**: Added `ripple` color token to `mobile/src/lib/theme.tsx` (light/dark). Extracted `triggerHaptic` helper to `mobile/src/lib/haptics.ts` (with `HapticType`). New primitive `mobile/src/components/ui/PressableRow.tsx` (Android: `android_ripple` foreground; iOS: scale + opacity animation; haptic on press; matches PressableCard ergonomics). Updated `PressableCard.tsx` for Android ripple + `overflow:hidden`. Both re-exported from `mobile/src/components/ui/index.ts`.
*   **Migration**: List-row `TouchableOpacity` → `PressableRow` across 16 high-traffic files: `app/(tabs)/index.tsx`, `jobs.tsx`, `map.tsx`, `app/job/[id].tsx`, `app/more/{settings,templates,team-management,inventory,whs-hub,time-tracking,ai-receptionist,collect-payment,form-builder}.tsx`, `app/more/quote/[id].tsx`, `app/more/invoice/[id].tsx`, `src/components/SubcontractorDashboard.tsx`. Toggles, header buttons, modal close buttons, and full-bleed photo/video viewers intentionally retained as `TouchableOpacity`.

### Production Hardening (May 2026)
*   **Database Pool**: Reduced max connections from 30 to 15 for Neon serverless compatibility, added min:2, 20s idle timeout, pool error event handler, and 30s per-connection statement_timeout via `pool.on('connect')`.
*   **Error Alert Fix**: Logger alert emails now correctly import `sendEmail` from `emailService.ts` (was importing non-existent `sendEmailViaIntegration` — the cascading "sendEmailViaIntegration2 is not a function" error in production).
*   **Request Timeout**: 30s timeout middleware on all `/api` routes returns 504 if handler doesn't respond in time.
*   **Scheduler Staggering**: Background schedulers (reminders, retry, lifecycle, stale timer, overtime nudge, demo refresh) start with 2-3s staggered delays to prevent connection pool stampede on startup.
*   **Health Check**: `GET /api/health` returns DB connectivity, latency, pool stats (total/idle/waiting), uptime, and service version.
*   **Graceful Shutdown**: Properly closes the database pool with logging on SIGTERM/SIGINT.
*   **Scaling for 100 Concurrent Users (Task #79, May 2026)**: Single Reserved VM is sized for ~100 concurrent users. The backbone now ships with:
    *   **Hot-read LRU+TTL cache** (`server/cache.ts`, dependency-free): namespaces `businessSettings` (60s), `teamRoster` (30s), `lineItemCatalog` (60s), `rateCards` (60s), `user` (30s), `aggregateDashboard` (15s). `getOrLoad` integrated into the highest-frequency `storage.ts` reads (business settings + team members). All write paths call the matching `invalidate*()` helper.
    *   **Bounded concurrency queues with backpressure** (`server/concurrency.ts`): `pdfQueue` (3 active / 12 queued), `aiQueue` (8/24), `visionQueue` (4/12). Overflow throws `BackpressureError` → `backpressureErrorHandler` returns `HTTP 429` + `Retry-After` (in seconds, computed from queue depth, capped at 60s). Heavy AI calls in `server/ai.ts` (`chatWithAI`, `generateAISuggestions`, `generateQuoteFromMedia`, `detectHazards`, `analyzeReceipt`, `categorizePhoto`) and the Puppeteer slot acquisition in `pdfService.ts` go through the queues.
    *   **Per-user rate limiters** for heavy endpoints (added in `routes/middleware.ts`, applied in `routes.ts`): `pdfPerUserLimiter` (20/min), `aiPerUserLimiter` (30/min), `visionPerUserLimiter` (15/min), `photoUploadPerUserLimiter` (60/min), `transcribePerUserLimiter` (20/min). Authenticated users keyed by user id; unauthenticated fall back to IPv6-safe `ipKeyGenerator`.
    *   **`GET /api/metrics`** + enriched **`GET /api/health`**: in-memory `metricsMiddleware` (`server/metrics.ts`) tracks per-route p50/p95/p99 with a 200-sample reservoir, plus 429/504 counters. Both endpoints are exempt from `generalApiLimiter` so ops/load-test scripts can poll freely.
    *   **Mobile graceful 429 handling** (`mobile/src/lib/api.ts`): `request()` reads `Retry-After`, transparently retries idempotent GETs once with jitter, and surfaces `BACKPRESSURE` (with `retryAfterSec`) for mutations so callers can show a friendly "Server busy — try again" message. 504 yields a clean "Request took too long" message.
    *   **Load-test harness** (`scripts/load-test.mjs`): standalone Node script (`fetch`-based, no extra deps) hits a weighted mix of `/api/health`, `/api/metrics`, `/api/jobs`, `/api/quotes`, `/api/invoices`, `/api/rate-cards`, `GET /api/ai/suggestions`, and `POST /api/ai/chat` with configurable `CONCURRENCY` and `DURATION_SEC`, prints per-endpoint p50/p95/p99 + 429/504 counts, then reads the server's own `/api/metrics` snapshot. Result on dev VM at the 100-concurrent target: **100 workers / 15s = ~399 rps, p95 352ms / p99 432ms, 0 x 429, 0 x 504, 0 x 5xx, 0 network errors, pool.waiting=0**.
    *   **Runbook**: under sustained overload, `GET /api/metrics` is the source of truth — watch `queues[].queued/totalRejected`, `pool.waiting`, `routes[].p99`, and `totals.status429`. If `pdf` queue rejects spike, lower per-user PDF limit before raising queue size; if `ai`/`vision` reject, OpenAI is the bottleneck (raising concurrency just shifts pain). DB pool is hard-capped at 15 (Neon serverless limit) — sustained `pool.waiting > 5` means a slow query, not a missing connection. Out of scope for Task #79: multi-instance WS fanout, distributed locks, hard Redis dependency, mobile UX redesign.

*   **Routes Modularization (Phase 1)**: Extracted shared middleware and helpers from the monolithic `server/routes.ts` (originally 52,662 lines, now ~51,773) into:
    *   `server/routes/middleware.ts` — `requireAuth`, `requireProSubscription`, `requirePaidTierForSms`, `requireDevelopment`, `setupOnboardingGuard`, and rate limiters (`authLimiter`, `loginLimiter`, `passwordResetLimiter`, `registrationLimiter`, `smsLimiter`).
    *   `server/routes/helpers.ts` — Reusable utility functions: `dbCheckRateLimit`, `checkIdempotency`/`setIdempotency`, `logActivity`, `normalizeAuPhone`, `resolveAssigneeUserId`, `autoUpdateWorkerState`, `gatherAIContext`, `verifyInvoiceCalculation`, `validateAustralianCoords`, `formatCurrency`, `getNextJobNumber`, `getNextInvoiceNumber`, `getNextQuoteNumber`.
    *   Both modules are imported at the top of `routes.ts` and used throughout. Inline middleware definitions and helper functions that were duplicated inside `registerRoutes` have been removed.