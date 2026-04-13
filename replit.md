### Overview
JobRunner is a mobile-first web application for Australian tradespeople, centralizing job management, quoting, invoicing, and payment collection. It emphasizes accurate documentation to prevent disputes and improve efficiency, supporting Australian GST and AUD. Key features include AI-powered business suggestions, compliance management, and streamlined financial operations, aiming to enhance communication and overall business management for trades businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application using shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API with Zod for validation, PostgreSQL, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Includes "Today's Schedule," Smart Address Auto-fill, and enhanced mobile job details.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth with consistent password policies.
*   **Onboarding**: Multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, incorporating GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: Four-tier pricing model (Starter, Pro, Team, Business) with Apple In-App Purchase for iOS and Stripe for Android/web. Includes server-side receipt verification and add-ons managed via Stripe.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and material transfer. Supports multi-worker time tracking, multi-worker assignment, manager nudges, and worker acknowledgment.
*   **Time Tracking Earnings**: Live earnings display, daily/weekly totals, and inline editing of entries. CSV export available.
*   **Financial System**: Live quote/invoice editor, catalog integration, deposit settings, digital signatures, invoice locking, audit trails, and various payment collection methods including Stripe Payment Links and an AI-powered Smart Payment Chaser.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, two-way Twilio SMS integration with a Chat Hub, and Google Review request automation.
*   **Real-time Updates (WebSocket)**: Implemented for critical system events like job status changes, timer events, and notifications, with automatic TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, and AI Safety Scan. Includes a comprehensive WHS Safety module for incident, hazard, PPE, training, and site management.
*   **Operations & Dispatch**: Features a Team Operations Center, Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking, and a Smart Operational Action Center with real-time alerts. Includes a Worker State System for live status updates.
*   **Multi-Business Workspace Switching**: Allows subcontractors to switch between different business workspaces with data isolation.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, optimistic UI rollback, field-level conflict merging, and background sync failure notification with retry capabilities.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio. Mobile GPS & Geofencing features include registration, auto-sync, background tracking, geofence notifications, and running late detection with SMS. Includes a GPS Privacy Mode and location resilience for buffered pings.

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
*   **Error Tracking**: Sentry