### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its core purpose is to centralize job management, quoting, invoicing, and payment collection. It emphasizes accurate documentation to prevent disputes, improve efficiency, and enhance financial management. The platform supports Australian GST and AUD, offering features like AI-powered business suggestions, quote generation, payment chasing, and comprehensive compliance management. The project aims to streamline operations and foster better communication within trades businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture built with TypeScript. The frontend is a mobile-first React 18 application utilizing shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Key features include "Today's Schedule," Smart Address Auto-fill, and enhanced mobile job details with variations, linked jobs, site updates, job documents, and Proof Pack section toggles.
*   **Authentication**: Supports Email/password, Google OAuth, and Apple Sign-In.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for features such as business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, incorporating GPS Worker Presence Verification and photo GPS location stamps, respecting business document template styles.
*   **Subscription & Billing**: Three-tier pricing (Free: 25 jobs+invoices/mo, Pro $39/mo: unlimited, Team $49/mo+$29/seat: unlimited+team). Freemium limits enforced server-side for jobs, invoices, and quotes with usage tracking incremented after each creation. AI features gated for Pro plan users via frontend and backend checks. Payment enforcement immediately downgrades `past_due`/`canceled`/`unpaid` businesses to free-tier limits. Automated overdue reminders via SMS, email, and push notifications. Users can pause/unpause subscriptions.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and automated material transfer from quotes to jobs.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails. Both quotes and invoices support full editing (title, line items, notes, etc.) via `/quotes/:id/edit` and `/invoices/:id/edit` routes. Editing recalculates subtotal/GST/total server-side from line items. **Quote Version History**: Every quote edit saves a pre-edit snapshot (line items, totals, GST, notes) to `quote_versions` table. Version history is viewable from the quote detail page via the "History" button, showing all past versions with expandable line item details. Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording. An AI-powered Smart Payment Chaser prioritizes collections.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Compliance**: Australian WHS-compliant SWMS (Safe Work Method Statements) system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan. A comprehensive WHS Safety module includes Incident Reports, Hazard Reports, PPE Checklists, Training Records, Site Emergency Plans, JSA Builder, Hazardous Environment tracking, Safety Signage management, and WHS Role assignment. All WHS forms (Incidents, Emergency Plans, PPE Checklists) support job linking via a searchable JobPicker component that auto-fills address/site details from the selected job.
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions. Client data sanitization and site photo filtering by job assignment are enforced.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, idempotent record creation, optimistic UI rollback, field-level conflict merging, and background sync failure notification.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS using OSRM, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio. Mobile GPS & Geofencing features include registration, auto-sync, background tracking, geofence notifications, smart running late detection, and running late SMS with real ETA, supported by a full push notification system.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
*   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
*   **Payment Processing**: Stripe (Stripe Connect Express)
*   **PDF Generation**: Puppeteer
*   **UI Components**: Radix UI (via shadcn/ui)
*   **Styling**: TailwindCSS
*   **Fonts**: Google Fonts (Inter)
*   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
*   **SMS Notifications**: Twilio (alphanumeric sender ID "JobRunner" for system messages; self-service dedicated number purchase for two-way texting)
*   **Object Storage**: Google Cloud Storage (GCS)
*   **Maps**: Leaflet with react-leaflet
*   **Accounting Integration**: Xero, MYOB AccountRight, QuickBooks Online
*   **Calendar Integration**: Google Calendar, Outlook/Microsoft 365
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK (pending Apple approval).