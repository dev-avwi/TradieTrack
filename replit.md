### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary goal is to provide a centralized platform for job management, quoting, invoicing, and payment collection, with a focus on accurately documenting job progress, agreements, and changes. This aims to prevent disputes and enhance efficiency within the trades industry, supporting Australian GST and AUD. The project envisions streamlining operations, improving financial management, and fostering better communication for trades businesses.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application utilizing shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and features like "Today's Schedule" and Smart Address Auto-fill. Full mobile parity is a key design principle.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and secure password management.
*   **Onboarding**: A multi-step wizard for initial business setup, including logo upload, Stripe integration, team invites, and sample data.
*   **AI Integration**: Leverages GPT-4o-mini and GPT-4o vision for various functionalities such as business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs via Puppeteer, incorporating GPS Worker Presence Verification and photo GPS location stamps.
*   **Analytics & Error Handling**: GA4 event tracking and comprehensive server-side error logging.
*   **Job Workflow**: A 5-stage job status workflow similar to ServiceM8, with visual indicators and automated email confirmations. Quote-to-Job flow automates material transfer from accepted quotes.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, rate snapshots, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording.
*   **Smart Payment Chaser**: An AI-powered payment collection system within the Payment Hub, offering prioritized chase queues, one-tap reminders, and KPI dashboards.
*   **Subscription & Billing**: Three-tier pricing (Free, Pro, Team) with upgrade/downgrade functionality, granular team member access, and a 7-day free trial.
*   **Multi-Business Subcontractors**: Functionality for subcontractors to manage jobs across multiple businesses.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Operations & Dispatch**: Features a Team Operations Center, a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection, and assignment-based dispatch with live location tracking.
*   **Inventory & Equipment**: Unified management of stock, materials, and equipment.
*   **Visual Form Builder**: Custom form builder with 9 field types, conditional logic, and CSV export.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions and preset roles.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization.
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboards with KPIs, per-job profitability, payroll system, and various financial reports.
*   **Enterprise Features**: Advanced search and filtering, dual-view scheduler, progress payments, and profit margin analysis.
*   **Time Tracking**: Includes break/pause functionality, billable/non-billable toggles, job costing, timesheet approvals, and GPS Proof of Presence.
*   **Compliance**: Compliance & Licensing Module for document management, status tracking, and automated expiry notifications.
*   **SWMS (Safe Work Method Statements)**: Full Australian WHS-compliant SWMS system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan.
*   **Production Hardening**: Includes GPS coordinate validation, geofence event API idempotency, PDF generation concurrency limits, and robust error handling.
*   **Autopilot Enhancements**: Automated "Technician On Their Way" notifications and batch invoicing.
*   **CRM & Client Management**: Client tags, type classification, referral tracking, and smart segment filtering.
*   **Deep-Link Navigation**: KPI widgets and action items deep-link to specific filtered views.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Client Portal Enhancement**: Enhanced Job Portal with visual progress timelines and custom messages.
*   **Voice-to-Action Detection**: AI analysis of voice notes to detect and log action items.
*   **Photo Auto-Tagging**: AI categorization of uploaded photos (before/after/progress/materials/general).
*   **Expenses Page**: Standalone page for tracking business expenses with a receipt scanner.
*   **Photo Organiser**: Central photo library with categorization, filters, and bulk actions.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, and Safety Form Templates for inspections.

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
*   **Accounting Integration**: Xero, MYOB AccountRight, QuickBooks Online
*   **Calendar Integration**: Google Calendar
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine) for real driving time calculation, Haversine fallback

### Smart GPS Features
*   **Real ETA in "On My Way" SMS**: Mobile gets tradie's current GPS coordinates, server calculates real driving time via OSRM routing, SMS shows actual ETA + distance instead of generic "15-20 minutes". Falls back to Haversine distance heuristic, then 20-minute default.
*   **Smart Job Dashboard**: Today's job cards show "X km away / ~Y min drive" based on real GPS. Nearest Job suggestion banner shows closest scheduled job with distance and one-tap directions. Route optimization shows total estimated drive time.
*   **Photo MMS**: Photos can be sent via SMS using Twilio MMS. New `/api/sms/upload-media` endpoint handles photo upload to object storage. Available in Chat Hub, Send Modal, and Job Detail.

### Mobile GPS & Geofencing
*   **Geofence Registration**: When a user toggles geofencing ON/OFF in job detail, `locationTracking.addJobGeofence()`/`removeJobGeofence()` are called to register/unregister the native device geofence. Radius changes also update the native geofence.
*   **Auto-Sync on Startup**: `_layout.tsx` calls `locationTracking.syncJobGeofences()` after location initialization, which fetches all active jobs with `geofenceEnabled=true` and re-registers their geofences with the native location service.
*   **Background Tracking**: Uses `expo-location` with Balanced accuracy (30s/50m intervals) and `expo-task-manager` for background tasks. Requires native build for full background support.
*   **Geofence Notifications**: On geofence ENTER/EXIT, `_layout.tsx` calls `/api/geofence-events`, gets back `timeEntryAction` + `jobTitle`, and shows local push notification (e.g. "Arrived — Timer Started", "Left Site — Timer Stopped"). Tapping navigates to `/job/[id]`.
*   **Site Attendance in Completion Modal**: Job completion checklist shows "Site Attendance" section with arrival/departure times from `/api/jobs/:id/site-attendance`.
*   **Smart Running Late Detection**: Background check runs every 5 min in `_layout.tsx`. Gets GPS, calls `POST /api/smart-running-late/check`, which uses OSRM routing to determine if tradie can make next scheduled job. Shows notification if running late. Toggle in Autopilot page saves `smartRunningLateEnabled` to notification preferences.
*   **Running Late SMS with Real ETA**: `POST /api/jobs/:id/running-late` now accepts `latitude`/`longitude` in body and calculates real driving ETA via OSRM for the SMS message text.