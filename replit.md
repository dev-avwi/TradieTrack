### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to streamline business operations from job creation and management to quoting, invoicing, and payment collection, including GST and AUD currency handling. It aims to provide an efficient, user-friendly solution for solo tradies and small businesses, enhancing workflow efficiency and offering business-aware suggestions through an integrated AI Assistant.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack features an event-driven architecture built with TypeScript. The frontend is a mobile-first React 18 application utilizing shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for validation, storing data in PostgreSQL managed by Drizzle ORM.

Key architectural decisions and features include:
-   **UI/UX**: Mobile-first design with a native app feel, card-based layouts, touch-optimized components, and a dashboard prioritizing "Today's Schedule." It supports comprehensive theming and branding for custom brand colors.
-   **Authentication**: Supports email/password, Google OAuth 2.0, session management, and secure token-based password reset.
-   **AI Assistant**: Integrates GPT-4o-mini for business-aware suggestions, Australian English phrasing, and tone adjustments.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow (`pending` → `scheduled` → `in_progress` → `done` → `invoiced`) with visual indicators and professional job confirmation emails.
-   **Quoting & Invoicing**: Features a live editor, integration of templates and catalog items, seamless quote-to-invoice conversion, configurable deposit payments, and server-side PDF generation via Puppeteer.
-   **Communication**: Includes Job Chat, Team Chat, and Direct Messages with role-based access, along with customizable email templates with AI suggestions and automated Gmail integration.
-   **Location & Tracking**: Implements a Life360-style interactive map for owners/managers, displaying job pins and real-time location tracking for team members, including activity status and geofence alerts. Trip tracking with auto-detection and GPS-based distance calculation is also included.
-   **Team Management**: Features Role-Based Access Control (RBAC) with granular permissions and role templates (OWNER, ADMIN, SUPERVISOR, STAFF).
-   **Smart Features**: Includes Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, Contextual Quote/Invoice Creation, and Workflow-Integrated Smart Actions for contextual automation suggestions.
-   **Calendar Sync**: Google Calendar OAuth 2.0 integration for two-way job synchronization with secure state token CSRF protection.
-   **Online Booking Portal**: Public-facing booking page (/book/:slug) for client self-service booking. Business owners configure portal settings, available services, working hours, and minimum lead times. Clients can submit booking requests with preferred dates and times, which appear in the Booking Requests management page for confirmation or decline.
-   **PWA Support**: Web manifest and service worker enable offline capabilities.
-   **Mobile App (React Native/Expo)**: Provides an offline-first architecture with SQLite for local data, push notifications (Expo Notifications), background GPS tracking (TaskManager), on-device PDF generation, and Tap to Pay integration (Stripe Terminal). It also features a document scanner with edge detection and a comprehensive job diary/activity log.

### External Dependencies
-   **Database**: PostgreSQL (via Neon serverless)
-   **Email Services**: User SMTP, Gmail Connector, SendGrid Platform
-   **Payment Processing**: Stripe (Stripe Connect Express, Stripe Terminal)
-   **AI Integration**: Replit AI Integrations (GPT-4o-mini)
-   **PDF Generation**: Puppeteer (web), expo-print (mobile)
-   **UI Components**: Radix UI (via shadcn/ui)
-   **Styling**: TailwindCSS
-   **Fonts**: Google Fonts (Inter)
-   **SMS Notifications**: Twilio
-   **Object Storage**: Google Cloud Storage (GCS)
-   **Maps**: Leaflet with react-leaflet (CartoDB dark tiles)