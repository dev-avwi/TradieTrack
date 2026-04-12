### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize job management, quoting, invoicing, and payment collection, with an emphasis on accurate documentation to prevent disputes and improve efficiency. The platform supports Australian GST and AUD, offering features like AI-powered business suggestions, comprehensive compliance management, and streamlined financial operations. It aims to enhance communication and overall business management for trades businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Key features include "Today's Schedule," Smart Address Auto-fill, and enhanced mobile job details with variations, linked jobs, site updates, job documents, and Proof Pack section toggles.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth for robust user authentication.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for features like business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, incorporating GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: A four-tier pricing model: Starter (free), Pro ($49/month), Team ($99/month, up to 5 workers), Business ($199/month, up to 15 workers). iOS uses Apple In-App Purchase (`react-native-iap`) for subscriptions; Android/web uses Stripe. Server-side Apple receipt verification at `POST /api/subscription/verify-apple-receipt` and restore at `POST /api/subscription/restore-apple`. IAP product IDs: `com.jobrunner.pro.monthly`, `com.jobrunner.team.monthly`, `com.jobrunner.business.monthly`. IAP service at `mobile/src/lib/iap.ts`. Freemium limits enforced server-side with usage tracking. The upgrade flow includes: `FeatureGate` component (web) and `useUserRole` hook (mobile) for tier gating, subscription page with upgrade cards showing prices and one-tap IAP purchase buttons, "Restore Purchases" button (iOS, Apple requirement). Pages gated by tier: Reports/Insights/Autopilot/AI Receptionist (Pro), Team Operations/Team Chat/Dispatch Board/Job Map (Team). Worker role-based permissions (`ProtectedRoute`/`RouteGuard`) remain separate from subscription tier gating. Support email: admin@avwebinnovation.com.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and automated material transfer from quotes to jobs. Multi-worker time tracking allows multiple team members to track time simultaneously on the same job, with per-worker live timer visibility ("Team on Job" card), break/pause status, individual hourly rates, and per-worker labour line items on invoices via `labourService.ts`.
*   **Time Tracking Earnings**: Live earnings display on timer (dollars ticking in real-time using job/user hourly rate), daily earnings totals on sheet tab, weekly earnings card on stats tab. Rate priority: entry hourlyRate > job hourlyRate > user defaultHourlyRate > $100 fallback. Inline editing of completed entries via edit modal (PATCH `/api/time-entries/:id`). CSV export with headers: Date, Start, End, Duration, Job, Type, Billable, Rate, Amount, Notes — available as daily export from sheet and weekly export from stats.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails. Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording. An AI-powered Smart Payment Chaser prioritizes collections.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub. Google Review request automation is also included.
*   **Real-time Updates (WebSocket)**: Implemented for critical system events such as job status changes, timer events, document status changes, payment receipts, notifications, chat messages, and team presence changes, with automatic TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan. A comprehensive WHS Safety module includes Incident Reports, Hazard Reports, PPE Checklists, Training Records, Site Emergency Plans, JSA Builder, Hazardous Environment tracking, Safety Signage management, and WHS Role assignment.
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking.
*   **Multi-Business Workspace Switching**: Allows subcontractors to switch between different business workspaces, with data isolation and conflict detection.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, enforcing client data sanitization and site photo filtering.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, idempotent record creation, optimistic UI rollback, field-level conflict merging, background sync failure notification, jittered exponential backoff (30s→2m→5m→15m→30m + 30% jitter), and failed sync item preservation with manual retry via Settings > App Settings > "Retry Failed" button.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio. Mobile GPS & Geofencing features include registration, auto-sync, background tracking, geofence notifications, and running late detection with SMS. **GPS Privacy Mode**: Location permissions are lazy (no iOS prompts on app launch). Users can opt out of all GPS tracking via Settings > Account > "Location & Privacy" toggle. Opt-out stops tracking, clears geofences, and blocks running-late checks. `location-tracking.ts` uses `checkPermissions()` (silent) vs `requestForegroundPermission()` / `requestBackgroundPermission()` (explicit prompts). `location-store.ts` persists `gpsOptOut` preference. **Location Resilience**: Failed server pings are buffered in-memory (up to 20 entries) with payload captured at send time (preserving correct jobId context); buffered entries are flushed on next successful send. **Battery Optimization**: When device is stationary (speed < 0.5 m/s), server pings are throttled to every 3rd update. Running-late check uses cached background location when available (falls back to fresh GPS only if cached location is >10 minutes old).

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
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
*   **Calendar Integration**: Google Calendar, Outlook/Microsoft 365
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK
*   **AI Receptionist (Voice)**: Vapi.ai
*   **Error Tracking**: Sentry

### Mobile App Conventions
*   **Avatar System**: All avatars (team members, clients, users) use the unified `TeamAvatar` component (`mobile/src/components/TeamAvatar.tsx`) which uses stable color hashing via `getAvatarColor` from `mobile/src/lib/avatar-colors.ts`. Color is determined by `userId` (preferred, most stable) or name. Profile images are shown when `profileImageUrl` is available. Always use `<TeamAvatar>` instead of ad-hoc `View`+`Text` avatar rendering.
*   **Alerts**: Uses native `Alert.alert()` for all alerts — no custom alert providers. This ensures proper native iOS UIAlertController appearance.
*   **In-App Purchases**: `mobile/src/lib/iap.ts` handles IAP initialization, subscription fetching, purchasing, and restore. Subscription page at `mobile/app/more/subscription.tsx` wires IAP to upgrade buttons.
*   **Header Button Fix**: All navigation layouts set `headerRightContainerStyle`/`headerLeftContainerStyle` with `backgroundColor: 'transparent'` and `headerPressColor: 'transparent'` to prevent iOS native colored circles behind header buttons in production builds.