### Overview
TradieTrack is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to centralize and streamline business operations, including job management, quoting, invoicing, and payment collection. The platform offers specific support for Australian GST and AUD currency, aiming to enhance productivity, financial management, and client communication for solo tradespeople and small businesses. Key capabilities include AI-driven scheduling optimization, multi-option quote generation, and comprehensive financial tracking.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
TradieTrack employs an event-driven architecture built with TypeScript. The frontend leverages React 18, shadcn/ui, TailwindCSS, Wouter, and TanStack Query, optimized for mobile responsiveness. The backend is an Express.js and TypeScript REST API, utilizing Zod for validation, PostgreSQL for data storage, and Drizzle ORM. A companion React Native/Expo mobile application integrates with the API, featuring Zustand for state management and SQLite-based offline capabilities.

Core architectural and design decisions include:

*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, and customizable theming. Key features include a "Today's Schedule" dashboard, Quick Add Client, Enhanced Template Selector, Smart Address Auto-fill, and Contextual Quote/Invoice Creation.
*   **Authentication**: Supports Email/password, Google OAuth, and secure password reset with cross-platform session tokens.
*   **AI Integration**: GPT-4o-mini is used for business suggestions, Australian English phrasing, proactive notifications, and quote generation. GPT-4o vision enables AI Photo Analysis, and the system includes an AI Schedule Optimizer and AI-powered voice note transcription.
*   **Role-Aware AI Assistant**: The AI assistant adapts to user roles with filtered context and permission-gated actions, providing role-specific prompts and action confirmations for sensitive operations.
*   **PDF Generation**: Server-side PDF generation for quotes and invoices is handled via Puppeteer, supporting customizable templates.
*   **Job Workflow**: A 5-stage ServiceM8-style job status workflow with visual indicators and professional confirmation emails.
*   **Live Quote/Invoice Editor**: Provides real-time preview, catalog item integration, deposit settings, quote-to-invoice conversion, Stripe Elements deposits, and digital signatures.
*   **Payment Collection**: Features Stripe Payment Links, "Tap to Pay Request Flow" for in-person payments, QR code support, comprehensive receipt generation, and Quick Collect Payment.
*   **Subscription & Billing System**: A three-tier pricing model (Free, Pro, Team) with smooth upgrade/downgrade flows and granular team member access control.
*   **Email Automation**: SendGrid integration for customizable emails with AI suggestions.
*   **PWA Support**: Offline capabilities are provided via web manifest and service worker.
*   **Real-time Communication**: Includes Job Chat, Team Chat, and Direct Messages with file attachments and two-way Twilio SMS integration with AI analysis, unified in a Microsoft Teams-style Chat Hub.
*   **Real-time WebSocket Updates**: Live UI synchronization for job status changes, timer events, document updates, payment records, and notifications. React Query caches auto-invalidate on WebSocket messages.
*   **Team Operations Center**: A centralized hub for live operations, administration, scheduling, skills/certifications, and performance monitoring.
*   **Live360-Style Interactive Map**: Displays job pins and real-time team location tracking with route optimization. Includes job search with autocomplete to quickly find and zoom to specific jobs on the map.
*   **Role-Based Access Control (RBAC)**: Granular permissions are enforced through middleware and a dual-permission system with offline caching.
*   **Comprehensive Offline Mode**: Offline-first support for major workflows with smart synchronization across web and mobile via IndexedDB and SQLite, including time tracking, payment drafts, and subscription caching.
*   **Media Sync**: Photos, videos, voice notes, and text notes sync between mobile and web, including photo markup.
*   **Recurring Invoices & Jobs**: Functionality for setting up recurring invoices and jobs.
*   **Financial Management**: A unified dashboard with key performance indicators.
*   **Documents Hub**: Consolidated view of quotes, invoices, and receipts with KPI headers and document relationship links.
*   **Client Asset Library & Smart Pre-fill**: API endpoints for reusing job photos, quote items, invoice items, and notes.
*   **Integrations**: Enhanced two-way Xero integration, MYOB AccountRight, and Google Calendar integrations.
*   **Safety Form Templates**: Australian-standard WHS compliance templates with digital signatures.
*   **Templates Hub**: Simplified to focus on Document Styles with integrated live preview for quotes, invoices, and jobs.
*   **Communications Hub**: Unified view of all sent emails and SMS messages with statistics and filtering.
*   **Automation Settings**: Configurable job reminders, quote follow-ups, invoice reminders, photo requirements, and GPS auto check-in/out.
*   **Defect Tracking**: Management of warranty work and defects with severity levels and photo attachments.
*   **Timesheet Approvals**: Workflow for crew timesheet approval.
*   **Simple CRM / Lead Pipeline**: Kanban-style lead tracking with convert-to-client functionality.
*   **Immersive Onboarding**: Full-screen onboarding with a 7-step "Life of a Job" walkthrough and an 18-step GuidedTour highlighting UI elements.
*   **Demo Data Management**: Demo data is preserved across server restarts and includes safe deletion mechanisms.
*   **Unified Notifications**: A single endpoint combines system, SMS, and chat notifications for both web and mobile.
*   **Document Template System**: 81 balanced templates (9 trades × 9 templates each) are seeded for new users, adhering to Australian standards, with trade filtering and general fallback templates.
*   **Trade-Specific Customization System**: A comprehensive trade catalog supports 13 priority trades with trade-specific terminology, custom job stages, custom fields, material catalogs, rate cards, safety checklists, and quote categories.
*   **QuickCreateFAB Component**: Replaces the full-width bottom sheet with a centered floating widget popup for quick actions.
*   **Mobile Collect Payment Redesign**: Overhauled mobile payment flow to include "Record Payment" and QR code generation, with receipt generation and optional linking.
*   **Job Assignment Request System**: Team members can request assignment to available unassigned jobs, with owner approval/rejection.
*   **Time Tracking Enhancements**: Includes break/pause functionality, separate tracking for work vs. break time, auto job status updates, and a job costing widget with variance display.
*   **Trade-Type Aware Templates**: Business templates are filterable by trade type with a fallback hierarchy.
*   **Trade-Specific Safety Forms System**: 18 Australian WHS-compliant safety checklists are auto-seeded, including pre-work and post-work forms with trade-specific items and digital signatures.
*   **Unified Communication Components**: Features for graceful SMS fallback, unified send modals for documents, before-photo prompts, and client contact cards with automatic Twilio/manual fallback detection.
*   **Unified Chat Hub with Job-Centric Design**: Jobs are primary navigation items in the conversation list, with filtering options for team, jobs, and unassigned enquiries.

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