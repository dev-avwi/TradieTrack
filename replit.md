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
*   **Subscription & Billing**: A tiered pricing model (Free, Pro, Team) with power add-ons (e.g., AI Receptionist, Custom Website). Freemium limits are enforced server-side with usage tracking. Automated overdue reminders via SMS, email, and push notifications are in place.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and automated material transfer from quotes to jobs.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails. Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording. An AI-powered Smart Payment Chaser prioritizes collections.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub. Google Review request automation is also included.
*   **Real-time Updates (WebSocket)**: Implemented for critical system events such as job status changes, timer events, document status changes, payment receipts, notifications, chat messages, and team presence changes, with automatic TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan. A comprehensive WHS Safety module includes Incident Reports, Hazard Reports, PPE Checklists, Training Records, Site Emergency Plans, JSA Builder, Hazardous Environment tracking, Safety Signage management, and WHS Role assignment.
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking.
*   **Multi-Business Workspace Switching**: Allows subcontractors to switch between different business workspaces, with data isolation and conflict detection.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, enforcing client data sanitization and site photo filtering.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, idempotent record creation, optimistic UI rollback, field-level conflict merging, and background sync failure notification.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio. Mobile GPS & Geofencing features include registration, auto-sync, background tracking, geofence notifications, and running late detection with SMS.

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