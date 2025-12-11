### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to streamline business operations from job creation and management to quoting, invoicing, and payment collection. It includes Australian GST handling and AUD currency, aiming to provide a comprehensive, efficient, and user-friendly solution for solo tradies and small businesses to manage their operations effectively. The project's ambition is to empower tradies with tools that simplify their daily tasks, improve financial management, and enhance client communication, ultimately boosting productivity and profitability.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application, using shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for validation, storing data in PostgreSQL managed by Drizzle ORM.

Key architectural features include:
- **Authentication**: Email/password, Google OAuth 2.0, session management, and secure token-based password reset.
- **AI Assistant**: An integrated GPT-4o-mini AI provides business-aware suggestions and Australian English phrasing.
- **PDF Generation**: Server-side PDF generation via Puppeteer for quotes and invoices.
- **Theming & Branding**: Comprehensive system for custom brand colors, persisting across sessions.
- **UI/UX**: Mobile-first design with a native app feel, card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard.
- **Smart Tradie Features**: Includes Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
- **Adaptive Solo/Team Mode**: Adjusts interface based on team size, featuring time tracking and GPS check-in (team mode).
- **Job Workflow**: A 5-stage ServiceM8-style job status workflow (`pending` → `scheduled` → `in_progress` → `done` → `invoiced`) with visual indicators and professional job confirmation emails.
- **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, and deposit settings, supporting quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
- **Customisable Email Templates**: Preview and edit email content with AI-powered suggestions and Automated Gmail with PDF Workflow.
- **PWA Support**: Web manifest and service worker for offline capabilities.
- **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access.
- **Life360-Style Interactive Map**: (Owner/Manager only) Displays job pins and real-time location tracking for team members with activity status, speed, battery, and geofence alerts.
- **Role-Based Access Control (RBAC)**: Granular permissions and role templates (OWNER, ADMIN, SUPERVISOR, STAFF) enforced by middleware.
- **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval, previews, and toggle controls.
- **Mobile App**: A React Native mobile app (Expo SDK 52) with full API integration, Zustand for state management, and an SQLite-based offline mode with background sync and conflict resolution. It features permission-aware navigation and dedicated stores for auth, jobs, clients, quotes, and invoices.

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