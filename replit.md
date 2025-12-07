### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to streamline business operations, from job creation and management to quoting, invoicing, and payment collection, including Australian GST handling and AUD currency. The platform aims to provide a comprehensive, efficient, and user-friendly solution for solo tradies and small businesses to effectively manage their operations.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack is built with an event-driven architecture using TypeScript. The frontend is a mobile-first React 18 application, leveraging shadcn/ui (Radix UI) for components, TailwindCSS for styling, Wouter for routing, and TanStack Query for state management. The backend is an Express.js and TypeScript REST API with Zod for request validation. Data is stored in PostgreSQL, managed by Drizzle ORM, and supports Australian-specific features like GST.

Authentication includes email/password, Google OAuth 2.0, session management, and a secure token-based password reset. An integrated AI Assistant (GPT-4o-mini) provides business-aware suggestions, and server-side PDF generation via Puppeteer creates professional quotes and invoices. The system features robust role-based team management.

The application includes a comprehensive theming and branding system for custom brand colors, persisting across sessions and syncing with backend settings. UI/UX focuses on a native mobile app feel with card-based layouts, touch-optimized components, and a dashboard prioritizing "Today's Schedule."

Key "Smart Tradie Features" enhance workflow efficiency:
-   **Quick Add Client**: Inline client creation within job forms.
-   **Enhanced Template Selector**: Card-based template selection with previews.
-   **Smart Address Auto-fill**: Populates job addresses from client data.
-   **Contextual Quote/Invoice Creation**: Allows direct creation from jobs based on status.

An Adaptive Solo/Team Mode dynamically adjusts the interface based on team size, offering prominent time tracking, GPS check-in (team mode), and simplified navigation for staff. A 5-stage ServiceM8-style job status workflow (`pending` → `scheduled` → `in_progress` → `done` → `invoiced`) with visual indicators is implemented, alongside professional job confirmation emails.

A ServiceM8-style live quote/invoice editor provides real-time preview, integrating templates, catalog items, and deposit settings. The quote-to-invoice workflow enables seamless conversion of accepted quotes, supporting configurable deposit payments via Stripe Elements and digital signature capture.

Customisable Email Templates allow previewing and editing email content before sending. AI-powered suggestions (GPT-4o-mini) offer Australian English phrasing and quick tone adjustments (Formal, Friendly, Brief). An Automated Gmail with PDF Workflow allows one-click generation and attachment of PDFs to Gmail drafts.

Developer tools (dev mode only) facilitate mock data management. The application provides PWA support with a web manifest and service worker for offline capabilities.

Real-time communication features include Job Chat (per-job messaging with file attachments), Team Chat (business-wide communication), and Direct Messages (1-on-1 chat), all secured with role-based access.

A Life360-Style Interactive Map (Owner/Manager only) displays color-coded job pins and circular avatar markers for team members with real-time location tracking (30-second refresh), activity status (Online, Driving, Working, Offline), speed, battery levels, and geofence alerts for job site arrivals/departures (100m radius).

A comprehensive Role-Based Access Control (RBAC) system (`server/permissions.ts`) defines granular permissions and role templates (OWNER, ADMIN, SUPERVISOR, STAFF), enforced by middleware.

Workflow-Integrated Smart Actions provide contextual automation suggestions (e.g., "Create Invoice" after job completion) with user approval. These actions show previews, missing requirements, and toggle controls, ensuring no blind background execution.

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

### Beta Readiness Audit (December 2025)

**Overall Status: READY FOR BETA**

#### Core Business Modules (All Verified Working)

| Module | Status | Notes |
|--------|--------|-------|
| Authentication | ✅ Ready | Email/password, Google OAuth 2.0, password reset, session management |
| Clients | ✅ Ready | Full CRUD, validation, linking to jobs/quotes/invoices |
| Jobs | ✅ Ready | 5-stage pipeline (pending→scheduled→in_progress→done→invoiced), geocoding |
| Quotes | ✅ Ready | Line items, 10% GST, auto-numbering, PDF preview, live editor |
| Invoices | ✅ Ready | Quote-to-invoice conversion, Stripe Connect payments, deposit handling |
| Time Tracking | ✅ Ready | Start/stop timer, hours per job, supervisor access, overlap prevention |
| Calendar | ✅ Ready | Week/month views, job grouping, KPI stats |
| Chat | ✅ Ready | Job chat, team chat, direct messages, unread counts |
| Map Tracking | ✅ Ready | Life360-style team tracking, job pins, geofence alerts, route planning |

#### Integrations (All Verified Working)

| Integration | Status | Configuration |
|-------------|--------|---------------|
| Stripe Connect | ✅ Ready | Express accounts (AU), 2.5% platform fee, AUD currency, min $5 payment |
| SendGrid | ✅ Ready | Email fallback after SMTP and Gmail |
| Puppeteer PDF | ✅ Ready | Branded quotes/invoices with ABN/GST |
| Object Storage | ✅ Ready | GCS integration, logo upload with color detection |
| OpenAI | ✅ Ready | GPT-4o-mini for AI suggestions |
| Google OAuth | ✅ Ready | Login and Gmail connector |

#### Role-Based Access Control

| Role | Dashboard | Permissions |
|------|-----------|-------------|
| OWNER | owner | Full access, team management, billing, settings |
| ADMIN | manager | Team management, all operations except billing |
| SUPERVISOR | manager | Manage assigned workers, view team data |
| STAFF | staff_tradie | Own jobs, time tracking, limited views |
| Solo Owner | solo_tradie | Full access, no team features |

#### Feature Gating (useFeatureAccess)

- **Free Tier**: 5 jobs/month limit, basic branding
- **Pro Tier**: Unlimited jobs, custom branding, AI features
- **Business Tier**: Team members, advanced reporting
- **Beta Mode**: All features unlocked (UpgradePrompt shows "Free During Beta")

#### Known Considerations for Beta

1. **Google OAuth Callback**: Users need to add the callback URL to their Google Cloud Console
2. **Gmail Profile Read**: Permission might need refresh for profile reads (send works)
3. **SMS Disabled**: Twilio integration available but disabled for beta to reduce complexity
4. **Test Accounts Available**:
   - luke@harriselectrical.com.au (solo owner)
   - mike@northqldplumbing.com.au (team owner)
   - tom@northqldplumbing.com.au (staff)
   - All use password: Test123!

#### Error Handling

- User-friendly error messages via `parseTradieFriendlyError`
- Toast notifications for all API operations
- Loading states with skeleton UI
- Subscription limit handling with upgrade prompts

#### UX Quality

- Design guidelines documented in `design_guidelines.md`
- Mobile-first responsive layout
- Inter font, consistent spacing (gap-4, space-y-6)
- Dark/light mode with brand color theming

### Mobile App (Real API Integration Complete)

A React Native mobile app is built in `mobile/` directory with full API integration to the backend.

**Architecture:**
- Expo SDK 52 with TypeScript
- Zustand stores for state management (single source of truth)
- API client with bearer token authentication
- Light theme with blue accents (#3b82f6 primary, #ffffff background) matching web

**Implemented Features:**

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Complete | Login/register with session persistence |
| Dashboard | ✅ Complete | Real stats (jobs today, overdue, pending quotes, revenue) |
| Jobs List | ✅ Complete | Search, filters, client names, status workflow |
| Job Detail | ✅ Complete | Full details, status updates, navigation |
| Clients List | ✅ Complete | Search, real data from API |
| Client Detail | ✅ Complete | Contact info, stats, call/email actions |
| Create Client | ✅ Complete | Full form with validation |
| Quotes List | ✅ Complete | Search, filters, amount summaries |
| Quote Detail | ✅ Complete | Amounts, dates, send/accept actions |
| Invoices List | ✅ Complete | Summary card, search, filters |
| Invoice Detail | ✅ Complete | Payment status, collect payment actions |
| Business Settings | ✅ Complete | Edit business details via API |
| Payments | ✅ Info | Stripe connection status (managed via web) |
| Notifications | ✅ Settings | Preference toggles (local state) |
| App Settings | ✅ Settings | Theme/region preferences |

**Data Stores (mobile/src/lib/store.ts):**
- `useAuthStore` - User auth, session, business settings
- `useJobsStore` - Jobs CRUD, today's jobs
- `useClientsStore` - Clients CRUD
- `useQuotesStore` - Quotes CRUD, status updates
- `useInvoicesStore` - Invoices CRUD, status updates
- `useDashboardStore` - Aggregated stats from API

**Navigation Structure:**
- Bottom Tabs: Dashboard, Jobs, Map, More
- More Stack: Quotes, Invoices, Clients, Business Settings, Payments, Notifications, App Settings
- Detail Screens: Client/[id], Quote/[id], Invoice/[id]

**To test the mobile app:**
1. Navigate to `mobile/` directory
2. Run `npm install` 
3. Run `npm start`
4. Scan QR code with Expo Go app on your phone

### Native Mobile Features (December 2025)

The mobile app now includes full native capabilities requiring EAS Build for production:

**Offline-First Architecture (`mobile/src/lib/`):**
- `database.ts` - SQLite schema for all entities (jobs, clients, quotes, invoices, assets, messages, time entries, signatures, location history)
- `offlineStore.ts` - CRUD operations with mutation queue, auto-sync, conflict resolution (last-write-wins), temp ID reconciliation
- `useNetworkStatus.ts` hook - Network state monitoring with pending change counts
- `OfflineBanner.tsx` - Visual offline indicator with sync button

**Push Notifications (`mobile/src/lib/notifications.ts`):**
- Expo Notifications with permission handling
- Android channels: jobs (high), payments (high), messages (default), reminders (default)
- Deep linking via expo-router to job/quote/invoice/chat screens
- Local notification scheduling for job reminders (30 min before)
- Badge count management

**Background GPS Tracking (`mobile/src/lib/locationTracking.ts`):**
- TaskManager background task for continuous location updates
- Foreground service notification (Android requirement)
- Geofence monitoring with 100m radius for job sites
- Activity detection (stationary, walking, running, driving)
- Battery-optimized updates (30s interval, 50m distance)
- Location history saved to SQLite for offline sync

**Tap to Pay (`mobile/src/lib/tapToPay.ts`):**
- Service layer ready for @stripe/stripe-terminal-react-native
- Payment intent creation and capture flow
- Connection status and payment status subscriptions
- Offline payment queueing for retry
- Manual entry fallback

**EAS Build Configuration:**
- `eas.json` - Development (simulator APK), Preview (internal), Production (app-bundle) profiles
- `app.json` - Native entitlements including:
  - iOS: UIBackgroundModes (location, fetch, remote-notification), Tap to Pay entitlement
  - Android: FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS

**App Store Requirements:**
1. Apple Developer Program ($99/year)
2. Tap to Pay entitlement request: https://developer.apple.com/contact/request/tap-to-pay-on-iphone
3. Google Play Developer account ($25 one-time)
4. FCM/APNs credentials for push notifications
5. EAS Build for native module compilation

**Testing Native Features:**
```bash
cd mobile
npm install
npx expo prebuild  # Generate native projects
eas build --platform ios --profile development
eas build --platform android --profile development
```

Full requirements in `docs/NATIVE_APP_REQUIREMENTS.md`.