### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to streamline business operations, from job creation and management to quoting, invoicing, and payment collection, including Australian GST handling and AUD currency. The platform aims to provide a comprehensive, efficient, and user-friendly solution for solo tradies and small businesses to effectively manage their operations, enhancing workflow efficiency and providing business-aware suggestions through an integrated AI Assistant.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack is built with an event-driven architecture using TypeScript. The frontend is a mobile-first React 18 application, leveraging shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for request validation, storing data in PostgreSQL managed by Drizzle ORM.

Key features include:
-   **Authentication**: Email/password, Google OAuth 2.0, session management, and secure token-based password reset.
-   **AI Assistant**: Integrated GPT-4o-mini for business-aware suggestions, Australian English phrasing, and tone adjustments in emails.
-   **PDF Generation**: Server-side PDF generation via Puppeteer for professional quotes and invoices.
-   **Theming & Branding**: Comprehensive system for custom brand colors, persisting across sessions.
-   **UI/UX**: Mobile-first design with a native app feel, card-based layouts, touch-optimized components, and a dashboard prioritizing "Today's Schedule."
-   **Smart Tradie Features**: Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
-   **Adaptive Solo/Team Mode**: Dynamically adjusts the interface based on team size, offering prominent time tracking, GPS check-in (team mode), and simplified navigation.
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow (`pending` → `scheduled` → `in_progress` → `done` → `invoiced`) with visual indicators and professional job confirmation emails.
-   **Live Quote/Invoice Editor**: Real-time preview, integrating templates, catalog items, and deposit settings, with seamless quote-to-invoice conversion and configurable deposit payments via Stripe Elements.
-   **Customizable Email Templates**: Preview and edit email content, with AI-powered suggestions and automated Gmail integration for PDF attachments.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with role-based access.
-   **Life360-Style Interactive Map**: (Owner/Manager only) Displays color-coded job pins and real-time location tracking for team members, including activity status, speed, battery levels, and geofence alerts.
-   **Role-Based Access Control (RBAC)**: Granular permissions and role templates (OWNER, ADMIN, SUPERVISOR, STAFF) enforced by middleware.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval, previews, and toggle controls.
-   **PWA Support**: Web manifest and service worker for offline capabilities.

The companion React Native mobile app (Expo SDK 52) provides offline-first architecture with SQLite for local data storage, push notifications (Expo Notifications), background GPS tracking (TaskManager), and planned Tap to Pay integration (Stripe Terminal).

### External Dependencies
-   **Database**: PostgreSQL (via Neon serverless)
-   **Email Service**: User SMTP, Gmail Connector, SendGrid Platform
-   **Payment Processing**: Stripe (Stripe Connect Express)
-   **PDF Generation**: Puppeteer
-   **UI Components**: Radix UI (via shadcn/ui)
-   **Styling**: TailwindCSS
-   **Fonts**: Google Fonts (Inter)
-   **AI Integration**: Replit AI Integrations (GPT-4o-mini)
-   **SMS Notifications**: Twilio
-   **Object Storage**: Google Cloud Storage (GCS)
-   **Maps**: Leaflet with react-leaflet (CartoDB dark tiles)

### Recent Changes (December 2025)
-   **Fixed Onboarding Team Invitation Flow**: The `useCompleteOnboarding` hook now properly processes team invitations during onboarding:
    -   Dynamically calculates `teamSize` (solo/small/medium/large) based on invitation count
    -   Fetches available roles from `/api/team/roles` and maps role names to roleIds
    -   Sends team invitations via `POST /api/team/members/invite` endpoint
    -   Provides structured feedback with success/failure counts
    -   Shows toast notifications for partial failures
-   **Owner Recognition**: Users are automatically recognized as owners via the `getUserContext` function in `server/permissions.ts` when they have no team membership (as opposed to being a team member of someone else's business)