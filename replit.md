### Overview
JobRunner is a mobile-first web application for Australian tradespeople, centralizing job management, quoting, invoicing, and payment collection. It emphasizes accurate documentation to prevent disputes and improve efficiency, while enhancing communication and overall business management. Key features include AI-powered business suggestions, comprehensive compliance management, and streamlined financial operations, all while supporting Australian GST and AUD.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application using shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API with Zod for validation, PostgreSQL, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Includes "Today's Schedule," Smart Address Auto-fill, and enhanced mobile job details.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth with consistent password policies.
*   **Onboarding**: Multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **AI Receptionist**: Voice-based assistant (Vapi.ai + ElevenLabs) with automated SMS follow-ups (Auto-Reply), push notifications for tradies, call recording playback, and caller sentiment analysis/scoring. Supports multi-number (up to 5 dedicated numbers per business), each with independent AI config (voice, greeting, mode, knowledge bank, label). Call logs and analytics support per-number filtering via `phoneNumberId`. Admin dashboard shows all numbers per business.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, incorporating GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: Four-tier pricing model (Starter, Pro, Team, Business) with Apple In-App Purchase for iOS and Stripe for Android/web. Includes server-side receipt verification and add-ons managed via Stripe.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and material transfer. Supports multi-worker time tracking, multi-worker assignment with real-time availability, manager nudges, and worker acknowledgment.
*   **Time Tracking Earnings**: Live earnings display, daily/weekly totals, and inline editing of entries. CSV export available.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails. Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code, Quick Collect Payment, and manual payment recording. Features an AI-powered Smart Payment Chaser.
*   **Number Porting (BYOD)**: Tradies can port their existing phone numbers to the platform via `POST /api/port-requests`. Admin queue management at `/admin/porting` with status workflow (submitted → processing → completed → failed). Automated post-port activation sets `dedicatedPhoneNumber` and enables AI receptionist on completion. Mobile UI in `phone-numbers.tsx` with port request form and status tracker.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, two-way Twilio SMS integration with a unified Chat Hub, and Google Review request automation.
*   **Real-time Updates (WebSocket)**: Implemented for critical system events like job status changes, timer events, document status changes, payment receipts, notifications, chat messages, and team presence changes, with automatic TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, worker sign-off, and AI Safety Scan. Includes a comprehensive WHS Safety module for incident, hazard, PPE, training, and site management (Incident Reports, Hazard Reports, PPE Checklists, Training Records, Site Emergency Plans, JSA Builder, Hazardous Environment tracking, Safety Signage, and WHS Role assignment).
*   **Operations & Dispatch**: Features a Team Operations Center, Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking, and a Smart Operational Action Center with real-time alerts. Includes a Worker State System for live status updates.
*   **Multi-Business Workspace Switching**: Allows subcontractors to switch between different business workspaces with data isolation and conflict detection.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, client data sanitization, and site photo filtering. Navigation gating enforced via `filterNavItems`/`filterSidebarItems` in `navigation-config.ts` using `FilterOptions` (role, `isSolo`, `hasProSubscription`, `hasTeamSubscription`, `isSimpleMode`). Team Operations requires team plan + non-solo owner/manager. Subscription/Admin restricted to owner. Branding restricted to owner/manager.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, idempotent record creation, optimistic UI rollback, field-level conflict merging, and background sync failure notification with retry capabilities (jittered exponential backoff and failed sync item preservation).
*   **Smart GPS Features**: Real ETA in "On My Way" SMS, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio. Mobile GPS & Geofencing features include registration, auto-sync, background tracking, geofence notifications, and running late detection with SMS. Includes a GPS Privacy Mode and location resilience for buffered pings and battery optimization.

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
*   **AI Receptionist (Voice)**: Vapi.ai (enhanced with ElevenLabs for voice tuning)

### Website Addon Interactive Features
The website addon (`website_addons` table) now includes three toggleable interactive features:
- **Click-to-Call** (`websiteClickToCall`): Embeddable floating phone button that dials the business's dedicated number
- **AI Chat Widget** (`websiteChatWidget`): Embeddable AI-powered live chat using the business's knowledge bank (same AI brain as the receptionist)
- **Booking Form** (`websiteBookingForm`): Embeddable booking/contact form that creates leads in the business's account

Public API endpoints (no auth required, rate-limited):
- `POST /api/public/website-chat/:businessId` — Chat with the AI widget
- `POST /api/public/website-booking/:businessId` — Submit a booking form (creates a lead)

Authenticated endpoints:
- `PATCH /api/website-addon/features` — Toggle website features on/off
- `GET /api/website-addon/embed-snippets` — Get HTML/JS embed code snippets for enabled features

Feature toggles are available in both the web client (WebsiteAddon.tsx) and mobile app (custom-website.tsx). Admin dashboard shows enabled features per business in the Users table.

*   **Error Tracking**: Sentry