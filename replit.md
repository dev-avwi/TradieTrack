### Overview
TradieTrack is a mobile-first web application for Australian tradespeople, designed to streamline business operations from job creation and management to quoting, invoicing, and payment collection. It includes Australian GST handling and AUD currency, aiming to provide a comprehensive, efficient, and user-friendly solution for solo tradies and small businesses. The project's ambition is to empower tradies with tools that simplify daily tasks, improve financial management, and enhance client communication, ultimately boosting productivity and profitability.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack utilizes an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application, using shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for validation, storing data in PostgreSQL managed by Drizzle ORM.

Key architectural features include:
-   **Authentication**: Supports Email/password, Google OAuth 2.0, session management, and secure token-based password reset.
-   **AI Assistant**: Integrates GPT-4o-mini for business-aware suggestions and Australian English phrasing, including proactive notifications and quote generation.
-   **PDF Generation**: Server-side PDF generation via Puppeteer for quotes and invoices.
-   **Theming & Branding**: Comprehensive system for custom brand colors, typography, and appearance settings, persisting across sessions.
-   **UI/UX**: Mobile-first design with a native app feel, card-based layouts, touch-optimized components, and a "Today's Schedule" dashboard. Includes features like Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
-   **Adaptive Solo/Team Mode**: Adjusts interface based on team size, featuring time tracking and GPS check-in (team mode).
-   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional job confirmation emails.
-   **Live Quote/Invoice Editor**: Real-time preview with templates, catalog items, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
-   **Stripe Payment Links**: Auto-generated checkout links stored on invoices (`stripePaymentLink`), included in emails, with webhook-triggered payment status sync and automatic receipt emails.
-   **Email Automation with PDF Attachments**: Invoice/quote emails automatically attach PDF copies via SendGrid. Welcome emails include 5-step quick-start guide.
-   **Customisable Email Templates**: Preview and edit email content with AI-powered suggestions and Automated Gmail with PDF Workflow.
-   **PWA Support**: Web manifest and service worker for offline capabilities.
-   **Real-time Communication**: Job Chat, Team Chat, and Direct Messages with file attachments and role-based access. Includes two-way SMS integration via Twilio with templates, MMS, and branded sender IDs.
-   **Live360-Style Interactive Map**: (Owner/Manager only) Displays job pins and real-time location tracking for team members with activity status, speed, battery, and geofence alerts.
-   **Role-Based Access Control (RBAC)**: Granular permissions and role templates (OWNER, ADMIN, SUPERVISOR, STAFF) enforced by middleware.
-   **Workflow-Integrated Smart Actions**: Contextual automation suggestions with user approval, previews, and toggle controls, including next-action indicators and pre-fill APIs.
-   **Mobile App (React Native/Expo)**: Full API integration, Zustand for state management, SQLite-based offline mode with background sync (15-min intervals), conflict resolution UI, quote/invoice line items caching, max 10 retry attempts with exponential backoff, and permission-aware navigation.
-   **Financial Management**: Unified financial dashboard (`/money-hub`) combining invoices, quotes, and payments with KPI cards and quick actions. Supports recording on-site payments and generating Stripe payment links.
-   **Automation**: Rule-based SMS automation for reminders and follow-ups.
-   **Client Asset Library & Smart Pre-fill**: API endpoints for retrieving and reusing job photos, quote items, invoice items, and notes. Smart pre-fill suggestions for new jobs/quotes/invoices.

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

### Demo Mode & Testing

-   **Demo Account**: demo@tradietrack.com.au / demo123456 - Pre-loaded with 3 clients, 3 jobs, quotes & invoices
-   **DemoModeBanner**: Visual indicator when logged into demo account with helpful guidance
-   **DemoPaymentSimulator**: Simulates Stripe payment flow for demos (shows fee breakdown, processing animation)
-   **Test Users**: mike@northqldplumbing.com.au, luke@harriselectrical.com.au, tom@northqldplumbing.com.au (all password: Test123!)
-   **StripeSetupGuide**: In-app Stripe Connect setup documentation on Integrations page

### Documentation

-   **COMPREHENSIVE_APP_RATING.md**: Detailed 8.7/10 app rating with ServiceM8 comparison
-   Key Strengths: Modern UI (9.0), Job Management (9.2), AI Features (8.6), Offline Support (9.0)
-   Key Gap: Accounting software integrations (Xero/MYOB) - 7.5/10