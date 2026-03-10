### Overview
JobRunner is a mobile-first web application for Australian tradespeople. Its primary purpose is to centralize job management, quoting, invoicing, and payment collection, focusing on accurate documentation to prevent disputes and enhance efficiency. The platform supports Australian GST and AUD, aiming to streamline operations, improve financial management, and foster better communication within trades businesses. It includes capabilities for AI-powered business suggestions, quote generation, payment chasing, and comprehensive compliance management.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner employs an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application built with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A React Native/Expo mobile app integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:
*   **UI/UX**: Mobile-first design emphasizing card-based layouts, touch-optimized components, customizable theming, dynamic layouts, and full mobile parity. Key features include "Today's Schedule" and Smart Address Auto-fill. Mobile job detail now includes: Variations (create/send/approve/reject with signature), Linked Jobs (previous client jobs), Site Update (quick notes + photos), Job Documents (upload/preview/delete), and Proof Pack section toggles.
*   **Authentication**: Supports Email/password, Google OAuth, and Apple Sign-In.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invites.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for functionalities like business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs (with section toggle support on both web and mobile), incorporating GPS Worker Presence Verification and photo GPS location stamps. Proof Packs respect business document template styles (Professional/Modern/Minimal).
*   **Analytics & Error Handling**: GA4 event tracking and comprehensive server-side error logging.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators and automated email confirmations, and automated material transfer from quotes to jobs.
*   **Financial System**: Live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails.
*   **Payment Collection**: Supports Stripe Payment Links, "Tap to Pay Request Flow," QR code support, Quick Collect Payment, and manual payment recording, with automatic receipt dispatch.
*   **Smart Payment Chaser**: An AI-powered system for prioritized payment collection.
*   **Subscription & Billing**: Three-tier pricing with granular team member access and a 7-day free trial.
*   **Multi-Business Subcontractors**: Functionality for subcontractors to manage jobs across multiple businesses.
*   **Communication**: Customizable email automation via SendGrid, PWA support, real-time communication via WebSockets, and two-way Twilio SMS integration with a unified Chat Hub.
*   **Operations & Dispatch**: Features a Team Operations Center and a Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking.
*   **Inventory & Equipment**: Unified management of stock, materials, and equipment.
*   **Visual Form Builder**: Custom form builder with various field types and conditional logic.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions. Client data sanitization enforced on detail endpoints. Site photos filtered by job assignment for workers.
*   **Rate Limiting**: Database-backed rate limiting (PostgreSQL `rate_limits` table) with in-memory fallback for chat and portal endpoints.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue (prevents lost edits on rapid updates), idempotent record creation (prevents duplicates after crash), optimistic UI rollback on permanent failure, field-level conflict merging, and background sync failure notification.
*   **Bulk Actions**: Bulk delete clients/quotes and bulk status update jobs via dedicated API endpoints (`/api/clients/bulk-delete`, `/api/quotes/bulk-delete`, `/api/jobs/bulk-status`).
*   **Financial Reporting**: Recurring invoices/jobs, unified dashboards with KPIs, per-job profitability, payroll system, and various financial reports.
*   **Time Tracking**: Includes break/pause functionality, billable/non-billable toggles, job costing, timesheet approvals, and GPS Proof of Presence.
*   **Compliance**: Compliance & Licensing Module for document management and automated expiry notifications.
*   **SWMS (Safe Work Method Statements)**: Australian WHS-compliant system with templates, risk matrix, PPE categories, worker sign-off, PDF generation, and AI Safety Scan.
*   **Autopilot Enhancements**: Automated "Technician On Their Way" notifications and batch invoicing.
*   **CRM & Client Management**: Client tags, type classification, referral tracking, and smart segment filtering.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with relationship links.
*   **Client Portal Enhancement**: Enhanced Job Portal with visual progress timelines and custom messages, maintaining consistent branding.
*   **Voice-to-Action Detection**: AI analysis of voice notes to detect and log action items. Standalone `/api/voice-notes/transcribe` endpoint for AI Quote Generator voice input (SSRF-hardened with URL allowlist and size limits).
*   **Photo Auto-Tagging**: AI categorization of uploaded photos.
*   **Expenses Page**: Standalone page for tracking business expenses with a receipt scanner.
*   **Photo Organiser**: Central photo library with categorization, filters, and bulk actions.
*   **Templates Hub**: Document Styles with live preview for quotes, invoices, and jobs, and Safety Form Templates.
*   **Smart GPS Features**: Real ETA in "On My Way" SMS using OSRM, Smart Job Dashboard showing distance and drive time, Photo MMS via Twilio.
*   **Mobile GPS & Geofencing**: Geofence registration, auto-sync on startup, background tracking, geofence notifications, smart running late detection, and running late SMS with real ETA. Full push notification system with tap routing.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
*   **Email Service**: User SMTP, Gmail Connector, Outlook/Microsoft 365, SendGrid Platform
*   **Payment Processing**: Stripe (Stripe Connect Express)
*   **Mobile Build**: iOS buildNumber `29` (bumped from 24; last submitted was #28). EAS slug: `tradietrack`. Bluetooth permission added for Stripe Terminal.
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
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK (for iOS 17.6+). SDK loading disabled via `TAP_TO_PAY_ENABLED = false` in `useServices.ts` pending Apple Tap to Pay approval (Case-ID 18817353). Voice transcription uses `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit AI integration), not `OPENAI_API_KEY`.