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

### Subscription Pricing Update (May 2026)
*   **New AUD pricing**: Pro $39.99/mo (was $49), Team $89.99/mo flat (was $99), Business $129.99/mo flat (was $199). Source of truth: `PRICING` in `shared/schema.ts` (cents: 3999 / 8999 / 12999).
*   **Stripe lookup keys bumped to `_v2`** in `server/billingService.ts` (`jobrunner_pro_monthly_v2`, `jobrunner_team_flat_monthly_v2`, `jobrunner_business_flat_monthly_v2`) so the get-or-create helpers don't reuse the legacy $49/$99/$199 prices already in the Stripe account. **Action required after deploy**: hit the admin `init-stripe-products` endpoint to materialize the new prices. Existing subscribers stay on their current Stripe price (grandfathered); new checkouts use the new amounts.
*   **`formatPrice` helper** in `client/src/components/Settings.tsx` now renders `.99` correctly (`Number.isInteger` check + `toFixed(2)`) so dynamic price strings show `$39.99` instead of `$39`.
*   **All user-visible prices updated** across `LandingPage`, `SubscriptionPage`, `Team`, `AdminDashboard`, `TermsOfService`, `FeatureGate`, `UpgradeToTeamCard`, `ServiceReadinessWidget`, and `mobile/app/more/subscription.tsx` (display strings + `defaultPrices` fallback for IAP).

### AI Receptionist Conversational Tuning (May 2026)
*   **Anti-interruption turn-taking** (`server/vapiService.ts`): After observing the AI cut a caller off mid-spelling ("Aiden. a-y-d-e-n" → "Thanks, Ida."), turn-taking was rebalanced from latency-aggressive to conversational-safe across `createAssistant`, `updateAssistant`, and `updateReceptionistConfigById`:
    *   `numWordsToInterruptAssistant`: 3 → 5
    *   `startSpeakingPlan.waitSeconds`: 0.4 → 0.8
    *   Added `transcriptionEndpointingPlan` { onPunctuationSeconds: 0.2, onNoPunctuationSeconds: 1.6, onNumberSeconds: 0.8 } — gives extra silence allowance when callers spell letters or read digits
    *   `stopSpeakingPlan`: numWords 3→5, voiceSeconds 0.2→0.4 — back-channels like "yeah", "uh-huh" no longer kill the assistant mid-sentence
*   **System prompt**: explicit "NEVER interrupt mid-spelling, wait 2s after caller stops" + "do not acknowledge name until full first AND last name received" + "spell name back letter-by-letter to confirm".
*   **Latency estimator** (`estimateAssistantLatency`): base 230ms → 630ms (includes 800ms intentional wait); thresholds shifted from <600ms/<700ms to <1000ms/<1200ms (optimal/amber/warn). UI toast messages and the "Test Response Time" button label updated to reflect the new realistic targets. The status enum (optimal/amber/warn) is unchanged so the DB schema stays compatible.

### Mobile Bottom Sheet Migration (May 2026)
*   **@gorhom/bottom-sheet@^5.2.13**: Installed in `mobile/`. `GestureHandlerRootView` + `BottomSheetModalProvider` mounted at app root in `mobile/app/_layout.tsx`.
*   **`AppBottomSheet`** (`mobile/src/components/ui/AppBottomSheet.tsx`): Themed wrapper around `BottomSheetModal` with rounded top corners, themed handle/backdrop, `BottomSheetScrollView`, `keyboardBehavior="interactive"`. Exposes both an imperative API (via `useAppBottomSheet()` hook + ref) and a declarative `visible` prop (drives present/dismiss via `useEffect`) so legacy `<Modal visible={x}>` call-sites swap with minimal change. Props: `snapPoints`, `enableDynamicSizing` (default true), `enablePanDownToClose`, `onDismiss`, `title`, `showCloseButton`, `scrollable` (default true), `contentPadding` (default `spacing.lg`), `visible`.
*   **Round-9 Migration**: All `<Modal animationType="slide">` instances across the 20 target files converted to `AppBottomSheet` (98 modals total). `<Modal animationType="fade">` centered dialogs and full-screen photo/video viewers are intentionally retained as native modals. Files: `app/more/create-job.tsx`, `whs-hub.tsx`, `team-management.tsx`, `inventory.tsx`, `equipment.tsx`, `expenses.tsx`, `team-groups.tsx`, `time-tracking.tsx`, `service-reminders.tsx`, `collect-payment.tsx`, `invoice/[id].tsx`, `quote/new.tsx`, `quote/[id].tsx`, `invoice/new.tsx`, `app/job/[id].tsx`, and components `SubcontractorDashboard`, `CustomFormBuilder`, `FormRenderer`, `PhotoLibrary`, `AIPhotoAnalysis`.

### Mobile Polish Audit (May 2026, Task #95)
Consolidated audit of 14 small mobile-polish drafts (#50, #52, #53, #56, #59, #60, #61, #69, #72, #73, #74, #76, #77, #78) that were drafted before Round 9 / Round 10 / iOS readiness landed. Most were already shipped by those larger rounds. Audit table:
*   **#50 — Profile tab safe-area bottom padding**: ✅ already done. `mobile/app/(tabs)/profile.tsx` uses `useBottomInset(40)` and applies it via `responsiveContentStyle.paddingBottom`.
*   **#52 — Spacing-consistent design tokens across mobile**: ✅ shipped earlier. Every reviewed screen imports `spacing`, `radius`, `typography`, `iconSizes`, `sizes`, `usePageShell` from `mobile/src/lib/design-tokens` — no remaining ad-hoc magic numbers in the audited surface area.
*   **#53 — Audit hardcoded white text colors**: ✅ no regressions. Remaining `colors.white` references (jobs, quote/[id], invoice/[id], map, SubcontractorDashboard) are all icon/label foregrounds rendered on `colors.primary`/`colors.success`/`colors.info`/`colors.destructive` button backgrounds — that's the intended high-contrast pairing, not a contrast bug.
*   **#56 — WHS hub dark-mode contrast**: ✅ already themed. `mobile/app/more/whs-hub.tsx` runs every color through `useTheme()` (`severities`, `riskColor`, `statusColor`, `trainingStatusColor`, etc. in `buildWhsConfig(colors)`); the only literal in the file (`stepCard` background) is gated by `isDark` and uses translucent overlays that pass contrast in both modes.
*   **#59 — Shared button style**: ✅ adopted on the highest-traffic screens (`(tabs)/index`, `(tabs)/jobs`, `job/[id]`, `more/quote/[id]`, `more/invoice/[id]`, `more/collect-payment`, `more/tap-to-pay-setup`, auth screens). Remaining bespoke pressables on settings/inventory/equipment screens are intentional list-row primitives (`PressableRow`/`PressableCard`), not button look-alikes.
*   **#60 — Replace info-style alerts with toast**: ✅ adopted via `showToast` in dashboard, jobs, job/[id], settings, integrations, expenses, collect-payment, invoice/[id], quote/[id], quote/new, team-management, phone-numbers. Remaining `Alert.alert` calls in the codebase are blocking confirms (delete/destructive) or auth flows — those correctly stay as native `Alert` per UX intent.
*   **#61 — Mobile job/dashboard type errors**: ⏭ deferred to Task #84 by design. No new type errors introduced by this sweep; only the screens edited below were touched.
*   **#69 — Themed modal close buttons**: ✅ shipped via `AppBottomSheet` (`showCloseButton` renders a themed `X` in a circle). Round 9 migrated 98 modals onto `AppBottomSheet`. Remaining native `Modal` close buttons live on full-screen photo/video viewers and centered fade dialogs that intentionally stay native (per Round 9 carve-out).
*   **#72 — Replace native Alert with themed action sheet / confirm dialog**: ✅ adopted via `useConfirmDialog`/`useActionSheet` in ai-receptionist, inventory, whs-hub, time-tracking, payment-hub, chat-hub, autopilot, receipt/[id], invoice/new, job/[id]. Remaining `Alert.alert` are destructive confirms or system-level prompts (location/permissions) — correctly native.
*   **#73 — Bottom inset coverage on sticky-bottom screens**: ✅ now complete. Survivors fixed in this task: `more/communications.tsx` (list `paddingBottom` now adds `insets.bottom`), `more/form-builder.tsx` (templates ScrollView), `more/team-operations.tsx` (Assign-Job modal bottom padding now `24 + insets.bottom`). `more/sms-conversation.tsx` is correctly handled by its outer `KeyboardAvoidingView` + sticky composer and doesn't need extra inset.
*   **#74 — Themed AppText wrapper sweep**: ⚠ obviated by `mobile/src/lib/global-text-defaults.ts`, which already patches every `<Text>` and `<TextInput>` at the React Native level to use the weight-mapped Inter font + Android `includeFontPadding:false` / `textAlignVertical:'center'`. A blanket swap to `<AppText>` would be churn for zero rendered difference; `AppText` stays available for new code that wants the typed variant API.
*   **#76 — Consistent bottom-nav padding on More screens**: ✅ covered by the same `useBottomInset` rollout. Every screen under `mobile/app/more/*` reviewed either imports `useBottomInset`/`getBottomNavHeight` or has its sticky CTA wrapped in `BottomInsetSpacer`/safe-area aware layout. The four survivors above were the last gaps.
*   **#77 — Replace ad-hoc card-styled Views with shared `Card`**: ⚠ partial / intentional. Several "card-shaped Views" use `backgroundColor: colors.card` with rounded corners but are gesture targets (drag handles, swipeable rows, animated map markers) — switching to `<Card>` would lose the press primitives. The shared `Card` is used where the surface is purely presentational (7 screens). No regression risk; future cards should keep using `Card` per existing pattern.
*   **#78 — Tablet bottom padding edge cases**: ✅ already handled by `usePageShell()` (responsive horizontal padding) + `useBottomInset(extra)` (vertical). On large tablets `useBottomInset` adds the device safe-area on top of the bottom-nav height; on phones it falls back to the nav height alone. No screen in the audit failed the tablet preview.

**Survivor fixes shipped in this task** (single-line edits, no new primitives):
1. `mobile/app/more/team-operations.tsx` — Assign-Job sticky modal: removed hardcoded `paddingBottom: 40` from the `assignModalContainer` style and overrode it inline with `24 + insets.bottom` so the action area clears the gesture nav bar on Android edge-to-edge devices.
2. `mobile/app/more/communications.tsx` — list ScrollView: `contentContainerStyle` now spreads `[styles.listContent, { paddingBottom: spacing.xl + insets.bottom }]` so the last row clears the bottom nav.
3. `mobile/app/more/form-builder.tsx` — Templates tab ScrollView: `paddingBottom: spacing.lg + insets.bottom` (was `spacing.lg`) so the last template card isn't hidden by the bottom nav on devices with a soft home bar.

**Drafts safe to archive after this task lands**: #50, #52, #53, #56, #59, #60, #69, #72, #73, #74, #76, #77, #78. **Keep open**: #61 (broader mobile TS pass — Task #84 owns it).

### Round 10 Android Production Hardening (May 2026)
*   **Config (`mobile/app.json`)**: Pinned `jsEngine: "hermes"`, enabled edge-to-edge (`edgeToEdgeEnabled: true`), `predictiveBackGestureEnabled: true`, `softwareKeyboardLayoutMode: "resize"`, added `monochromeImage` for adaptive icon, removed legacy `READ/WRITE_EXTERNAL_STORAGE` permissions, bumped `versionCode` to 30, enabled `enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`, and inline `extraProguardRules` (mirrored in `mobile/android-proguard-rules.pro` for reference). Configured `expo-splash-screen` plugin with dark mode background.
*   **Assets**: `mobile/assets/adaptive-icon-monochrome.png` (432x432 white-on-transparent for Android 13+ themed icons), regenerated `mobile/assets/notification-icon.png` (256x256 white-on-transparent). Build script: `mobile/scripts/build-monochrome-icon.mjs`.
*   **Material Ripple**: Added `ripple` color token to `mobile/src/lib/theme.tsx` (light/dark). Extracted `triggerHaptic` helper to `mobile/src/lib/haptics.ts` (with `HapticType`). New primitive `mobile/src/components/ui/PressableRow.tsx` (Android: `android_ripple` foreground; iOS: scale + opacity animation; haptic on press; matches PressableCard ergonomics). Updated `PressableCard.tsx` for Android ripple + `overflow:hidden`. Both re-exported from `mobile/src/components/ui/index.ts`.
*   **Migration**: List-row `TouchableOpacity` → `PressableRow` across 16 high-traffic files: `app/(tabs)/index.tsx`, `jobs.tsx`, `map.tsx`, `app/job/[id].tsx`, `app/more/{settings,templates,team-management,inventory,whs-hub,time-tracking,ai-receptionist,collect-payment,form-builder}.tsx`, `app/more/quote/[id].tsx`, `app/more/invoice/[id].tsx`, `src/components/SubcontractorDashboard.tsx`. Toggles, header buttons, modal close buttons, and full-bleed photo/video viewers intentionally retained as `TouchableOpacity`.

### Integrations Health Pass (May 2026, Task #86)
*   **Stripe constants extracted** to `server/config/stripe.ts` (`STRIPE_CONFIG`): `platformFeePercent` (2.5), `platformFeeMinCents` (50), `minimumAmountCents` (500), `country` (`AU`), `currency` (`aud`), `mcc` (`1711`). All env-overridable (`STRIPE_PLATFORM_FEE_PERCENT`, `STRIPE_PLATFORM_FEE_MIN_CENTS`, `STRIPE_MINIMUM_AMOUNT_CENTS`, `STRIPE_CONNECT_COUNTRY`, `STRIPE_CURRENCY`, `STRIPE_CONNECT_MCC`). `server/stripeConnect.ts` now sources every previously-hardcoded value (country, MCC, currency on PaymentIntent + checkout session + balance filter, $5 minimum, 50¢ fee floor) from this module. Error messages derived from config so changing the minimum updates the user-facing string too.
*   **Stripe mock fallback gated to dev**: `server/stripeClient.ts` now logs `🛑 Stripe credentials NOT available in production deployment...` (error level) when `REPLIT_DEPLOYMENT=1` or `NODE_ENV=production` and creds are missing — clarifies that the mock fallback is dev-only and downstream callers will return 503. Dev-mode message is informational only.
*   **QuickBooks ItemRef de-hardcoded**: New `businessSettings.quickbooksDefaultItemRef` (json `{value, name}`). `resolveQbItemRef(userId)` helper in `server/quickbooksService.ts` reads it and falls back to legacy `{value:"1", name:"Services"}` with a `console.warn` so missing config is greppable. Wired into all 3 ItemRef sites: `syncInvoicesToQuickbooks`, `syncSingleInvoiceToQuickbooks`, `syncQuotesToQuickbooks`.
*   **Google Calendar timezone de-hardcoded**: New `businessSettings.timezone` (default `Australia/Sydney`). `syncJobToCalendar` in `server/googleCalendarClient.ts` reads it and uses it for both `start.timeZone` and `end.timeZone` (was hardcoded `Australia/Sydney`). Falls back to `Australia/Sydney` with a warn if settings load fails.
*   **Void semantics fixed for MYOB & QBO**: Both `voidInvoiceInMyob` (`server/myobService.ts`) and `voidInvoiceInQuickbooks` (`server/quickbooksService.ts`) now return `{success, voidMethod: 'void' | 'credit_note' | 'unsupported', message, error?}` — explicit about what actually happened upstream.
    *   MYOB returns `voidMethod: 'unsupported'` because MYOB AccountRight has no API void; the caller must raise a credit note. The route handler at `POST /api/integrations/myob/void-invoice/:invoiceId` now returns HTTP 422 + the structured payload so the UI can render the credit-note workaround instead of a misleading "voided" toast.
    *   QBO returns `voidMethod: 'void'` and uses the real `?operation=void` endpoint; the route handler returns 400 on upstream failure with the structured `{voidMethod, message}`.
*   **Live "Test Connection" endpoints**: New `POST /api/integrations/<provider>/test` for `xero`, `quickbooks`, `myob`, `google-calendar`, `stripe`. Each performs a real read against the upstream (Xero `getTenants`, QBO `CompanyInfo`, MYOB connection probe, Google `calendarList.list`, Stripe `accounts.retrieve`) and returns `{success, message, detail?, error?}`. Surfaces tenant/company name when available so the tradie can confirm they connected the right account. Frontend `TestConnectionButton` (in `client/src/pages/Integrations.tsx`) is rendered on all 5 provider cards next to the Disconnect/Dashboard buttons, with toast feedback.
*   **Mock data isolation verified**: `POST /api/dev/seed-mock-data` and `POST /api/dev/clear-data` already gated by `requireAuth + requireDevelopment` and per-`userId` — no production leakage path. No changes required.
*   **Runbook**:
    *   To change the QuickBooks line item used when pushing invoices/quotes, set `businessSettings.quickbooksDefaultItemRef` to `{"value": "<qbItemId>", "name": "<displayName>"}` (e.g. fetched from QBO `Item` query). Until set, the legacy `{value:"1", name:"Services"}` is used and a one-line warn is emitted per sync.
    *   To change the timezone used for Google Calendar events, set `businessSettings.timezone` to any IANA tz string (e.g. `Australia/Brisbane`).
    *   Use the Test Connection button on the Integrations page to confirm credentials are valid right now (independent of stored token state). It's the fastest way to diagnose a "why isn't sync working" report — the toast either confirms the upstream tenant name or shows the upstream error verbatim.
*   **Required env vars per provider** (the test endpoint returns a clear "not configured" message when any of these are missing — that's the first thing to check when a Test Connection toast says "not configured"):
    *   **Xero**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` (defaults to `${APP_DOMAIN}/api/auth/xero/callback`), `XERO_WEBHOOK_KEY` (signed webhooks). Without these, `/api/integrations/xero/test` returns 503.
    *   **QuickBooks Online**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` (`sandbox` or `production`).
    *   **MYOB AccountRight**: `MYOB_CLIENT_ID`, `MYOB_CLIENT_SECRET`. Per-user company-file credentials are stored encrypted in `myob_connections.cf_username`/`cf_password` (set via the MYOB integration card, not env). The test endpoint will fail with "MYOB_CLIENT_ID not configured" if missing.
    *   **Google Calendar**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Test endpoint calls `calendarList.list` and reports the primary calendar name.
    *   **Stripe**: provided via the Replit Stripe connector (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`). When the connector is unavailable in production, `stripeClient.ts` logs an error and downstream endpoints return 503; in dev it logs informationally and falls back. Tunable: `STRIPE_PLATFORM_FEE_PERCENT`, `STRIPE_PLATFORM_FEE_MIN_CENTS`, `STRIPE_MINIMUM_AMOUNT_CENTS`, `STRIPE_CONNECT_COUNTRY`, `STRIPE_CURRENCY`, `STRIPE_CONNECT_MCC` (all in `server/config/stripe.ts`).
*   **Health-state interpretation** (the fields the integration cards/`/api/integrations/health` returns and what they mean):
    *   `configured: false` → server is missing env vars; user can't even start the OAuth flow. Fix env, redeploy.
    *   `configured: true, connected: false` → env is present but no user token stored yet. User needs to click Connect.
    *   `connected: true, needsReconnect: true` → token expired/revoked upstream (e.g. password reset, app revoked in provider dashboard). User needs to click Reconnect.
    *   `connected: true, needsReconnect: false` + Test Connection failing → upstream API outage or scopes changed; check the Test Connection toast for the verbatim provider error.

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