### Overview
JobRunner is a mobile-first web application for Australian tradespeople, designed to centralize job management, quoting, invoicing, and payment collection. Its core purpose is to accurately document job progress, agreements, and changes to prevent disputes and enhance efficiency within the trades industry. The platform supports Australian GST and AUD, aiming to streamline operations, improve financial management, and foster better communication for trades businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application employing shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, "Today's Schedule," and Smart Address Auto-fill. Full mobile parity is a key principle.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and secure password management.
*   **Onboarding**: A multi-step wizard for business setup, including logo upload, Stripe integration, team invites, and sample data.
*   **AI Integration**: Leverages GPT-4o-mini and GPT-4o vision for functionalities like business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs via Puppeteer, incorporating GPS Worker Presence Verification and photo GPS location stamps.
*   **Analytics & Error Handling**: GA4 event tracking and comprehensive server-side error logging.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators and automated email confirmations. Quote-to-Job flow automates material transfer.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, rate snapshots, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording.
*   **Smart Payment Chaser**: An AI-powered payment collection system with prioritized chase queues, one-tap reminders, and KPI dashboards.
*   **Subscription & Billing**: Three-tier pricing with upgrade/downgrade functionality, granular team member access, and a 7-day free trial.
*   **Multi-Business Subcontractors**: Functionality for subcontractors to manage jobs across multiple businesses.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and assignment-based dispatch with live location tracking.
*   **Inventory & Equipment**: Unified management of stock, materials, and equipment.
*   **Visual Form Builder**: Custom form builder with 9 field types, conditional logic, and CSV export.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions and preset roles.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization.
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboards with KPIs, per-job profitability, payroll system, and various financial reports.
*   **Enterprise Features**: Advanced search and filtering, dual-view scheduler, progress payments, and profit margin analysis.
*   **Time Tracking**: Includes break/pause functionality, billable/non-billable toggles, job costing, timesheet approvals, and GPS Proof of Presence.
*   **Compliance**: Compliance & Licensing Module for document management, status tracking, and automated expiry notifications.
*   **SWMS (Safe Work Method Statements)**: Full Australian WHS-compliant SWMS system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan.
*   **Production Hardening**: Includes GPS coordinate validation, geofence event API idempotency, PDF generation concurrency limits, and robust error handling.
*   **Autopilot Enhancements**: Automated "Technician On Their Way" notifications and batch invoicing.
*   **CRM & Client Management**: Client tags, type classification, referral tracking, and smart segment filtering.
*   **Deep-Link Navigation**: KPI widgets and action items deep-link to specific filtered views.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Client Portal Enhancement**: Enhanced Job Portal with visual progress timelines and custom messages.
*   **Voice-to-Action Detection**: AI analysis of voice notes to detect and log action items.
*   **Photo Auto-Tagging**: AI categorization of uploaded photos (before/after/progress/materials/general).
*   **Expenses Page**: Standalone page for tracking business expenses with a receipt scanner.
*   **Photo Organiser**: Central photo library with categorization, filters, and bulk actions.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, and Safety Form Templates for inspections.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS using OSRM, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio.
*   **Mobile GPS & Geofencing**: Geofence registration, auto-sync on startup, background tracking, geofence notifications, smart running late detection, and running late SMS with real ETA. Full push notification system with tap routing for various event types.

### Mobile Production Readiness
*   **Production domain**: All API URLs and links use `jobrunner.com.au` (previously `jobrunner.com`). Updated in `api.ts`, `app.json`, `eas.json`, `branding.tsx`, `support.tsx`, `LogoPicker.tsx`, and `APP_STORE_SUBMISSION.md`.
*   **Console log guards**: All `console.log`, `console.warn`, and `console.error` calls across mobile app screens (`mobile/app/`) and source files (`mobile/src/`) are wrapped in `if (__DEV__)` guards so they don't execute in production builds.
*   **Config consolidation**: `app.config.ts` now simply passes through `app.json` values and only overrides `extra.apiUrl` from `EXPO_PUBLIC_API_URL` env var. `app.json` is the single source of truth for all static config.
*   **iOS microphone permission**: Added `NSMicrophoneUsageDescription` to `app.json` for voice note recording functionality.
*   **API request timeouts**: All API requests in `api.ts` use `AbortController` with 15s timeout (default) and 60s for file uploads. Timeout errors return user-friendly messages.
*   **EAS build env vars**: All EAS profiles (development, preview, production) now include `EXPO_PUBLIC_API_URL` pointing to `https://jobrunner.com.au`.
*   **expo-build-properties**: Installed as a dependency (was referenced in plugins but not installed).
*   **Theme-aware ConflictResolutionPanel**: Replaced all hardcoded hex colors with theme tokens (`colors.destructive`, `colors.card`, `colors.foreground`, etc.) so the conflict resolution UI works correctly in both light and dark modes.

### Mobile Bug Fixes
*   **Photo Annotation Multi-Color**: Fixed WebView HTML template to use stable refs instead of React state for color/stroke values. Color changes now go through `injectJavaScript` without regenerating the WebView, preserving existing annotations.
*   **SWMS PDF Download**: Fixed "Authentication required" error by using authenticated `fetch` with Bearer token instead of `Linking.openURL`. PDF is saved to cache and opened via `expo-sharing`.
*   **Modal safe area**: Expense and inventory form modals now use `useSafeAreaInsets()` to prevent Cancel/Save buttons from overlapping the phone status bar.
*   **Beta/team gating**: `use-user-role.ts` now treats `'beta'` tier as having team and pro access. Team Operations page no longer shows "Upgrade to Team Plan" banner for beta users.
*   **Files page counts**: Stats now show actual document counts and jobs with photos, not raw job counts. "JOBS" label changed to "WITH PHOTOS".
*   **Settings Brand tab removed**: Removed redundant Brand tab from Settings page; standalone branding page at `mobile/app/more/branding.tsx` remains.
*   **Autopilot tab padding**: Increased horizontal padding and gap between tabs and badges for better visual spacing.
*   **Job view workflow consolidation**: Merged ScheduleNotificationCard, SmsContactCard, and NextActionCard into a single consolidated workflow card. Shows one primary action with urgency info and secondary "Text On My Way" option.
*   **Payment Hub Smart Chaser declutter**: Hidden global KPI cards when on Smart Chaser tab (avoids 8 KPI cards), simplified chase queue buttons to icon-only for View/Call, removed verbose recommendation text.
*   **Team member display**: Team member assignment on create-job now shows name/email instead of just role. Uses fallback chain: `name || email.split('@')[0] || username || 'Team Member'`.
*   **Time picker**: Time picker on create-job is now always enabled (was incorrectly disabled on initial load).
*   **Invoice KPI stats**: KPI cards on invoices page now display whole dollar amounts without decimals using `formatCurrency(amount, false)`.
*   **Quote link generation**: Quote copy-link now generates acceptance token on demand via `/api/quotes/:id/generate-token` instead of requiring quote to be sent first.
*   **Quote/invoice PATCH line items**: PATCH endpoints for quotes and invoices now sync line items (delete+recreate) when `lineItems` array is provided in request body. Computes `total` field from quantity*unitPrice.
*   **Quote PDF signature**: PDF generation now falls back to `acceptanceSignatureData` field on quote record when no digital signature record exists. Added `?hideSignature=true` query param support.
*   **Voice recorder error handling**: Improved error handling to distinguish permission errors, "already recording" state, and generic failures. Uses `error.name === 'AbortError'` instead of DOMException.

### Auto-Receipt Sending
*   **Automatic receipt dispatch**: After any payment is collected (Tap to Pay, Payment Link/QR code, manual recording), the system now automatically sends a receipt via email (with PDF attachment) and SMS (with public receipt link) to the client. This is handled by the `autoSendReceiptAfterPayment` helper in `server/routes.ts`. The helper creates a receipt record if one doesn't exist, sends email via SendGrid with PDF, and sends SMS via Twilio with a public receipt URL. Runs asynchronously so it doesn't block the payment response. Wired into: `/api/terminal/payment-success`, `/api/public/payment-request/:token/confirm-payment`, and the `handleRecordPayment` handler.
*   **SWMS Signature Pad**: Sign SWMS modal now includes a WebView-based canvas for drawing signatures, in addition to the name field. Signature data captured as PNG base64.
*   **Smart Actions Tap-to-Execute**: Replaced toggle switches + "Run X Actions" button with simple tap-to-execute action items. Each action is a tappable row that immediately executes on press.

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
*   **Routing/ETA**: OSRM (Open Source Routing Machine) for real driving time calculation, Haversine fallback