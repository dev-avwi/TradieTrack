### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, offering features for job management, quoting, invoicing, and payment collection with specific support for Australian GST and AUD currency. The project aims to enhance productivity, financial management, and client communication for solo tradespeople and small businesses through advanced features like AI-driven scheduling optimization and multi-option quote generation.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack employs an event-driven architecture using TypeScript. The frontend is built with React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile devices. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for the database, and Drizzle ORM. A React Native/Expo mobile application integrates with the API, featuring Zustand for state management and an SQLite-based offline mode.

Key architectural and design decisions include:
*   **UI/UX**: Mobile-first design principles are applied, incorporating card-based layouts, touch-optimized components, and customizable theming. Features such as a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation enhance user experience.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset mechanisms, ensuring cross-platform session token security.
*   **AI Integration**: GPT-4o-mini is utilized for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision powers AI Photo Analysis, complemented by an AI Schedule Optimizer and AI-powered voice note transcription.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices is handled by Puppeteer, supporting customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow is implemented, featuring visual indicators, professional confirmation emails, and rollback capabilities.
*   **Live Quote/Invoice Editor**: Provides real-time preview, catalog item management, deposit settings, quote-to-invoice conversion, Stripe Elements for deposits, and digital signature capabilities.
*   **Payment Collection**: Integrates Stripe Payment Links, supports a "Tap to Pay Request Flow" for in-person payments, QR code generation, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: A three-tier pricing model (Free, Pro, Team) with smooth upgrade/downgrade flows and team member access control, including seat semantics for managing additional members.
*   **Email Automation**: Utilizes SendGrid for customizable email delivery, enhanced with AI suggestions.
*   **PWA Support**: Offers offline capabilities through web manifest and service worker implementation.
*   **Real-time Communication**: Features Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration, including AI analysis. A Microsoft Teams-style Chat Hub unifies all conversations.
*   **Team Operations Center**: A unified hub for managing live operations, administration, scheduling, team skills/certifications, and performance monitoring.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking, including route optimization.
*   **Role-Based Access Control (RBAC)**: Granular permissions are enforced via middleware.
*   **Comprehensive Offline Mode**: Supports offline-first workflows with smart synchronization across web and mobile platforms. Offline mutations are queued in IndexedDB and synced upon regaining connectivity, with ID reconciliation post-sync.
*   **Media Sync**: Ensures photos, videos, voice notes, and text notes, including photo markups, sync seamlessly between mobile and web.
*   **Recurring Invoices & Jobs**: Functionality for setting up and managing recurring invoices and jobs using templates.
*   **Financial Management**: A unified dashboard provides key performance indicators (KPIs).
*   **Documents Hub**: A consolidated view of quotes, invoices, and receipts, featuring KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints facilitate the reuse of job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced two-way Xero integration (including payment marking, chart of accounts, tax rates, bulk sync), MYOB AccountRight, and Google Calendar integrations.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signature support.
*   **Templates Hub**: Centralized management for customizable content with live preview.
*   **Communications Hub**: A unified view of all sent emails and SMS messages, with statistics and filtering capabilities.
*   **Automation Settings**: Configurable reminders for jobs, quotes, and invoices, along with photo requirements and GPS auto check-in/out.
*   **Defect Tracking**: Manages warranty work and defects, including severity levels and photo attachments.
*   **Timesheet Approvals**: Provides a workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: A Kanban-style lead tracking system with functionality to convert leads to clients.
*   **Immersive Onboarding**: A full-screen onboarding experience includes a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour to highlight UI elements.
*   **Demo Data Persistence**: Demo data (clients, jobs, quotes, invoices, receipts) is preserved across server restarts for consistent IDs.
*   **Unified Notifications**: Both web and mobile platforms utilize a single `/api/notifications/unified` endpoint to combine system, SMS, and chat notifications.
*   **Permission System**: Two parallel permission systems (`WORKER_PERMISSIONS` and `ActionPermissions`) with a translation layer ensure parity between web and mobile, including offline SQLite caching for mobile.
*   **Document Template System**: 35 default templates (quote, invoice, job) are pre-seeded for new users, adhering to Australian standards (GST, industry rates, payment terms). Templates are categorized, and team members access the owner's templates.
*   **Trade-Specific Customization System**: A comprehensive trade catalog (`shared/tradeCatalog.ts`) supports 13 priority trades, each with:
    *   Trade-specific terminology
    *   Custom job stages
    *   Trade-specific custom fields
    *   Default materials catalog with industry-standard pricing
    *   Trade-specific rate cards
    *   Safety checklists
    *   Quote categories
    *   A `useTradeContext` hook provides frontend access to all trade-specific configuration.
*   **iOS Native Navigation**: Uses expo-router's native iOS navigation components (UINavigationBar and UITabBar) for authentic Apple experience on iOS, while Android uses custom Header/BottomNav components.
    - **Native tab bar**: iOS uses native BlurView tab bar with haptic feedback on tab press
    - **Native headers**: iOS uses native navigation headers with `headerBlurEffect` (systemChromeMaterial), `headerTransparent: true`, and `headerLargeTitle` for scrolling collapse
    - **Platform detection**: `isIOS` from `mobile/src/lib/device.ts` controls conditional rendering in AuthenticatedLayout
    - **Navigation config**: `getNavigationConfig()` in `mobile/src/lib/platform.ts` returns iOS-specific blur headers or solid Android headers
    - **Haptic feedback** (`expo-haptics`) on tab presses, FAB, and quick actions
    - Android unchanged with custom solid Header/BottomNav components
*   **iOS Native UI Components**: Complete set of native iOS components in `mobile/src/components/ui/`:
    - **IOSActionSheet** (`useIOSActionSheet`, `useConfirmActionSheet`): Native UIActionSheet on iOS via `@expo/react-native-action-sheet`
    - **IOSContextMenu**: Native iOS context menus with haptic feedback via `zeego`, with SF Symbol icon mapping
    - **IOSGroupedList** (`IOSGroupedList`, `IOSListItem`, `IOSListSeparator`): UITableView grouped/inset list styling with proper separators and touch feedback
    - **IOSSegmentedControl**: Native iOS segmented control with animated sliding indicator
    - **IOSFormInput** (`IOSTextField`, `IOSToggleRow`): iOS-style form inputs with clearable text fields, proper keyboard behavior, and native switches
    - **IOSBackButton**: Native iOS back button with "soft" card-like variant for grouped list appearance
    - All components include platform detection: iOS-native experience, Android uses custom fallback styling
    - iOS design system defined in `mobile/src/lib/ios-design.ts`: system colors, corners, shadows, typography
*   **iOS 26 Liquid Glass Design System**: Modern translucent floating UI matching iOS 26 aesthetic:
    - **Floating Tab Bar**: Tab bar floats above content with rounded corners, margins (12px horizontal, 8px bottom), blur background, and subtle shadow. Content scrolls behind it.
    - **GlassSurface Component**: Reusable translucent container with BlurView, glass tint overlay, subtle border highlight. Variants: default, tabBar, header, fab, card.
    - **LiquidGlassScrollView**: ScrollView with automatic content insets for floating tab bar, edge-to-edge content that extends behind glass controls.
    - **Design Tokens** in `mobile/src/lib/ios-design.ts`: `LiquidGlass` object with corners (12/20/26px), blur intensities (40-100), surface colors (light/dark glass backgrounds), tabBar/header/fab specific settings.
    - **Edge-to-Edge Content**: Content extends behind transparent headers and floating tab bar for immersive feel.
    - Android unchanged with solid UI, Liquid Glass effects iOS-only via `isIOS` platform detection.

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
*   **Accounting Integration**: Xero, MYOB AccountRight
*   **Calendar Integration**: Google Calendar