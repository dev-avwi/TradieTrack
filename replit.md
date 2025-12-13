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

### Recent Changes (December 2025)
- **Money Hub Dashboard**: New unified financial dashboard (`/money-hub`) combining invoices, quotes, and payments in one view with KPI cards (Outstanding, Overdue, Paid 30d, Pending Quotes), tabbed interface, and quick actions. Mobile parity via `mobile/app/more/money-hub.tsx`.
- **AI Assistant Proactive Notifications**: Enhanced mobile AI assistant with real-time notifications for overdue invoices, pending quotes, and today's jobs. Color-coded priority indicators (high/medium/low) with dismissible cards. Matches web `/api/ai/notifications` endpoint functionality.
- **Job Workflow Validation**: Backend now validates job status transitions - jobs cannot be set to "invoiced" without a linked invoice record. Added efficient `/api/jobs/:id/linked-documents` endpoint for fetching quote/invoice linkage.
- **Comprehensive FAQ System**: Enhanced SupportTab with 6 categorized FAQ sections using Accordion UI:
  - Getting Started (first job, first client, business setup)
  - Jobs & Scheduling (statuses, photos, scheduling, completion)
  - Quotes (creation, sending, deposits, conversion to invoice)
  - Invoices & Payments (creation, sending, Stripe, payment recording, overdue handling)
  - Team Management (adding members, roles, job assignment)
  - Troubleshooting (email issues, Stripe, sync, PDF generation, feature requests)
- **App Walkthrough Tutorial**: New `AppWalkthrough.tsx` component provides guided 5-step tour for new users covering clients, jobs, quotes, invoices, and settings. Accessible via Settings → Support → "Start App Tour" button.
- **Mobile P0 Bug Fixes**: Fixed critical production bugs:
  - Added missing Alert import to payments.tsx for Stripe Connect error handling
  - Fixed VoiceRecorder permission handling for expo-audio with graceful fallback
  - Added background location tracking error handling with foreground-only fallback
  - Fixed Stripe Connect URL opening with canOpenURL/openURL pattern
  - Fixed chat hub filter chips height (36px) for better touch targets
  - Added Quick Add Client to create-job.tsx for feature parity
  - Added StatusBar to LoadingScreen to prevent dark bars on splash
- **AI Quote Generator**: Generate quote line items from photos/voice/description using GPT-4o vision. Features JSON parse validation, line item normalization (clamps quantities/prices), and server-side total recalculation (subtotal + GST + grand total). Integrated into LiveQuoteEditor with Sparkles AI button.
- **Instant Job Parser**: Create jobs from pasted text (SMS, email, message) via `/api/ai/parse-job-text`. Extracts client name, description, address, urgency. SessionStorage uses scoped keys with 5-minute expiry for security.
- **Next-Action Indicators**: Smart "what to do next" suggestions on job cards and table view. Batch endpoint `/api/jobs/next-actions` returns priority-colored guidance (high/medium/low). Cache invalidates on job create/update.
- **Mobile Feature Parity Components**: Four new standalone components for web-mobile parity:
  - `DragDropDispatchBoard.tsx`: Gesture-based drag-and-drop dispatch board with timeline grid, draggable job cards, and team member columns (integrated into dispatch-board.tsx with list/timeline toggle)
  - `EmailComposeModal.tsx`: AI-powered email compose modal with templates, preview, and AI suggestions
  - `CustomFormBuilder.tsx`: Full form builder UI with field type picker, drag reorder, and live preview
  - `AdvancedThemeControls.tsx`: Granular theming controls with presets, typography, corner radius, and animation settings
- **Advanced Theme Store**: Extended theme management (`advanced-theme-store.ts`) with theme presets, custom palettes (light/dark), typography settings (font scale, heading weight, line height), and appearance settings (border radius, shadow intensity, animation speed, compact mode)
- **Client Asset Library**: API endpoints to retrieve job photos, quote items, invoice items, and notes for reuse; security-verified with client ownership checks
- **Smart Pre-fill API**: `/api/clients/:id/prefill` endpoint returns recent job descriptions, line items, and notes for auto-populating new jobs/quotes/invoices
- **CSV Export**: Reports dashboard has export buttons with disabled states for each report type
- **Mobile Smart Pre-fill**: Create job screen fetches and displays smart suggestions when client is selected, with proper loading states and error handling
- **Attachment Offline Sync**: Complete implementation with `saveAttachmentOffline`, `deleteAttachmentOffline`, `syncAttachment` methods; `local_id` column for ID reconciliation; nullable `local_uri` for server-fetched attachments; verified update success before clearing sync queue
- **ID Reconciliation**: `updateLocalIdWithServerId` tries WHERE local_id=? first, falls back to WHERE id=? for backwards compatibility, returns boolean success
- **Offline Sync Improvements**: Exponential backoff now follows spec (30s/2m/5m/15m/30m delays), `last_attempted_at` updates after sync attempts to prevent premature delays on pre-sync failures
- **Automation Templates**: 12 pre-built trade-specific sequences (quote follow-ups, invoice reminders, job confirmations) with full email/SMS content for plumbing, electrical, HVAC, landscaping
- **Stripe Terminal Mobile**: SDK integration complete with connection token fetching, simulator fallback for Expo Go testing
- **Offline Auth Flow**: checkAuth() properly falls back to cached auth data when offline or API fails

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