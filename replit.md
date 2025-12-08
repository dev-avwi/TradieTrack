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

### Beta Ready Status (December 2025)

**VERIFIED WORKING - Core Features:**
- **Authentication**: Email/password + Google OAuth login fully functional
- **Dashboard**: Today's Schedule, overdue items, recent activity all display correctly  
- **Jobs**: CRUD operations, 5-stage workflow (pending → scheduled → in_progress → done → invoiced)
- **Clients**: Full client management with address auto-fill
- **Quotes**: Create, edit, PDF generation, email sending
- **Invoices**: Quote-to-invoice conversion, PDF generation, email delivery
- **Payments**: Stripe Elements integration for online payments, deposit handling
- **Calendar**: Week/month views with job scheduling
- **Map**: Leaflet integration with job pins (6 jobs visible in demo)
- **Time Tracking**: Timer UI with start/stop functionality
- **Team Management**: Role-based access (hidden for solo users by design)
- **Chat**: Job chat + team chat + direct messages (tables persisted)
- **Settings**: Business profile, branding, payment settings, integrations

**Mobile App Parity:**
- 5 main tabs: Dashboard, Jobs, Map, Collect, Profile
- 30+ screens in /more section matching web features
- AI Assistant, Dispatch, Expense Tracking, Reports all implemented

**QA Fixes Applied:**
- Fixed time-entries/active endpoint route ordering (404 → 200)
- Fixed Feather icon "palette" warnings (replaced with "edit-3")
- Improved Stripe Terminal error handling with structured error codes

**Known Limitations:**
- Stripe Terminal: Requires Connect account setup for production (shows helpful error message)
- Team features: Hidden for solo users (appears when team members added)
- Demo mode: Pre-loaded with mock data for testing (3 clients, 3 jobs, 4 invoices)

### Recent Changes (December 2025)
-   **ServiceM8 Mobile Parity Features** (December 7, 2025):
    -   **Trip Tracking**: Auto-detection of travel between jobs with GPS-based distance calculation, billable time suggestions, and Haversine formula for accurate distances. Backend routes at `/api/trips` with full CRUD operations. Database schema includes `trips` table.
    -   **Document Scanner**: Camera-based document capture with edge detection enhancement via expo-image-manipulator. Upload to job attachments with graceful fallbacks when native modules unavailable.
    -   **Mobile PDF Generation**: On-device quote/invoice PDF generation using expo-print without server round-trip. Includes sharing via expo-sharing and local file storage with expo-file-system. All methods include availability checks and proper error messages.
    -   **Push Notifications**: Complete push notification service with device registration, deep linking from notification taps, and test notification capability. Backend endpoints at `/api/notifications/register-device` and `/api/notifications/test-push`.
-   **Mobile App Dependencies**: New mobile features require: `npx expo install expo-print expo-sharing expo-file-system expo-image-manipulator`
-   **Fixed Onboarding Team Invitation Flow**: The `useCompleteOnboarding` hook now properly processes team invitations during onboarding:
    -   Dynamically calculates `teamSize` (solo/small/medium/large) based on invitation count
    -   Fetches available roles from `/api/team/roles` and maps role names to roleIds
    -   Sends team invitations via `POST /api/team/members/invite` endpoint
    -   Provides structured feedback with success/failure counts
    -   Shows toast notifications for partial failures
-   **Owner Recognition**: Users are automatically recognized as owners via the `getUserContext` function in `server/permissions.ts` when they have no team membership (as opposed to being a team member of someone else's business)
-   **Mobile Theme Consistency** (December 8, 2025):
    -   Converted `DocumentPreview.tsx` from static colors import to dynamic `useTheme()` hook for proper brand color support
    -   Mobile quote/invoice previews now respect custom brand colors set in business settings
-   **Stripe Connect Mobile Integration** (December 8, 2025):
    -   Updated mobile payments screen to call proper API endpoint `/api/stripe-connect/onboard` instead of external URL
    -   Added proper error handling with Alert dialogs for connection failures
    -   Stripe onboarding flow now opens properly in mobile browser
-   **TypeScript Fixes**:
    -   Fixed timer reference type in time-tracking.tsx (NodeJS.Timeout → ReturnType<typeof setInterval>)
    -   Fixed reports.tsx to not reference non-existent Job.totalHours property
-   **Job Site Forms & Checklists - Mobile Integration** (December 8, 2025):
    -   Integrated forms system into mobile job detail screen (`mobile/app/job/[id].tsx`)
    -   New "Forms" quick action button with badge showing completed form count
    -   Forms selection modal showing available templates with completion status
    -   Template fillout modal with field preview and submit functionality
    -   Completed forms section displaying submitted forms with date and field count
    -   Re-fill option for already completed forms with confirmation dialog
    -   Quick access to job-forms settings screen from empty state
    -   Backend integration with `/api/job-forms/templates` and `/api/jobs/:jobId/forms` endpoints
    -   Types: FormTemplate (jobFormTemplates) and FormResponse (jobFormResponses) from shared schema
-   **Mobile Feature Parity Improvements** (December 8, 2025):
    -   **Offline Authentication**: SQLite user_session table caching enables login without network after first successful login. Network status detection with graceful messaging when offline with no cached session.
    -   **Time Tracking Backend Integration**: Timer now persists to `/api/time-entries` with POST on start, PATCH on stop, GET for stats. Loading states and error handling with user-friendly alerts.
    -   **Recurring Jobs Mobile Screen**: Full management screen at `/more/recurring-jobs` with daily/weekly/fortnightly/monthly/quarterly/yearly patterns. Backend routes at `/api/recurring/jobs` with full CRUD.
    -   **Quick Messages SMS**: "I'm On My Way" and ETA templates via `/api/sms/send` endpoint. Pre-filled message templates with client selection and job linking.
    -   **Materials Catalog/Price Book**: Mobile screen at `/more/materials-catalog` for managing line items with name, description, price, trade type, and units. Backend routes at `/api/catalog` with user ownership protection.
    -   **Stripe Terminal Tap to Pay**: Production-ready implementation with connection token and payment intent routes. Requires EAS build with `@stripe/stripe-terminal-react-native` package. Comprehensive documentation in `mobile/src/lib/tapToPay.ts`.
-   **Profile Navigation Updates**: Added Price Book and Quick Messages to profile menu for easy access
-   **Mobile UX Polish - Beta Launch Prep** (December 8, 2025):
    -   **Google OAuth on Mobile**: Added Google Sign-In button to mobile login screen using expo-web-browser to open backend OAuth flow, with expo-linking for callback handling.
    -   **Forgot Password Flow**: Complete password reset flow with email input, 6-digit code verification, and new password entry. Integrates with `/api/auth/forgot-password`, `/api/auth/verify-reset-code`, and `/api/auth/reset-password` endpoints.
    -   **Skeleton Loaders**: Reusable skeleton loader components (`mobile/src/components/ui/Skeleton.tsx`) with shimmer animation. Applied to Dashboard and Jobs screens for better perceived performance during initial data loads.
    -   **Sticky Search Header**: Jobs list now has sticky header with search bar and filter pills that remain visible while scrolling. Added clear button (x-circle icon) to search input for easy query clearing.
    -   **Illustrated Empty States**: New reusable EmptyState component (`mobile/src/components/ui/EmptyState.tsx`) with type-specific icons, colors, and messaging for jobs, clients, invoices, quotes, messages, notifications, search, expenses, and documents. Applied to Jobs list.
-   **Quick Add Client UX Improvement** (December 8, 2025):
    -   Added visible "+" button next to client selector on Create Job screen for better discoverability
    -   New `QuickAddClientModal` component allows creating clients directly without opening the full client picker first
    -   Modal includes fields for name, email, phone, and address
    -   Auto-selects newly created client and auto-fills job address if provided
    -   Form state properly resets on modal dismissal (including Android back button)
    -   Uses `useCallback` and `useEffect` for proper cleanup to prevent stale data on re-open
-   **Mobile Time Tracking Full Implementation** (December 8, 2025):
    -   **Timesheet Tab**: Date-grouped time entries with job titles, durations, start/end times. Uses String coercion for job ID matching.
    -   **Reports Tab**: Weekly/monthly summaries with hours, entry counts, averages. Export button with messaging.
    -   **Stats Tab**: Daily hours bar chart with safe width calculations. Productivity insights cards with dynamic messaging.
-   **Tap to Pay Screen** (December 8, 2025):
    -   New dedicated screen at `/more/tap-to-pay` with amount input, description field, and payment collection
    -   Stripe Connect status check with proper disabled state when not connected
    -   Button colors use theme-based `successForeground` for proper contrast
    -   Instructions, feature list, and EAS build requirement messaging
    -   Removed all "Coming Soon" badges - feature is ready for EAS build
-   **Password Reset Email Enhancement** (December 8, 2025):
    -   Updated `sendPasswordResetEmail` to include optional 6-digit code for mobile app
    -   Email now displays both clickable link (web) and styled code box (mobile)
    -   Supports dual-flow password reset for web and mobile parity