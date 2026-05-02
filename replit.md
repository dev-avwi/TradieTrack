### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to streamline job management, quoting, invoicing, and payment collection, ensuring accurate documentation to minimize disputes and boost efficiency. The platform aims to enhance communication, provide AI-powered business suggestions, manage compliance, and optimize financial operations, all while fully supporting Australian GST and AUD. The project's ambition is to centralize and simplify all aspects of a tradesperson's business.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
JobRunner utilizes an event-driven architecture built with TypeScript. The frontend is a mobile-first React 18 application, leveraging shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL as the database, and Drizzle ORM. A dedicated React Native/Expo mobile application integrates with the API, employing Zustand for state management and SQLite for offline capabilities.

Core architectural and design decisions include:

*   **UI/UX**: Emphasis on mobile-first design with card-based layouts, touch-optimized components, customizable theming, and dynamic layouts for full mobile parity. Key features like "Today's Schedule" and Smart Address Auto-fill enhance mobile usability.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth, with consistent password policies.
*   **Onboarding**: A multi-step wizard guides users through business setup, including Stripe integration and team invitations.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for various functionalities such as business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **AI Receptionist**: A voice-based assistant (Vapi.ai + ElevenLabs) offers automated SMS follow-ups, push notifications for tradies, call recording playback, and caller sentiment analysis. It supports multiple dedicated numbers per business, each with independent AI configuration and provides call logs and analytics.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, including GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: A four-tier pricing model (Starter, Pro, Team, Business) with Apple In-App Purchase and Stripe integration. It includes server-side receipt verification and add-on management.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, and material transfer. It supports multi-worker time tracking, real-time availability, manager nudges, and worker acknowledgment.
*   **Financial System**: A live quote/invoice editor with real-time preview, catalog integration, deposit settings, digital signatures, invoice locking, and audit trails. It supports various payment methods including Stripe Payment Links, "Tap to Pay Request Flow," QR code, Quick Collect Payment, and manual recording, alongside an AI-powered Smart Payment Chaser.
*   **Number Porting (BYOD)**: Allows tradies to port existing phone numbers to the platform with an admin-managed workflow and automated AI receptionist activation upon completion.
*   **Communication**: Features customizable email automation via SendGrid with delivery tracking, PWA support, real-time WebSocket communication, two-way Twilio SMS integration with a unified Chat Hub, and Google Review request automation.
*   **Real-time Updates**: Implemented for critical system events like job status changes, timer events, document status changes, payment receipts, notifications, chat messages, and team presence, with automatic TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, worker sign-off, and AI Safety Scan. Includes a comprehensive WHS Safety module for incident, hazard, PPE, training, and site management.
*   **Operations & Dispatch**: Features a Team Operations Center, Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking, and a Smart Operational Action Center with real-time alerts and a Worker State System.
*   **Multi-Business Workspace Switching**: Enables subcontractors to switch between different business workspaces with data isolation and conflict detection.
*   **Unified Team & Magic-Link Subcontractor Flow**: Centralized `/team` page for managing members and subcontractors, featuring a magic-link send flow with wrong-number defense and a verification code process. Includes a secure session validation for all subcontractor web-view endpoints.
*   **Magic-link → Account Sub Upgrade**: Allows owners on the Team plan to upgrade magic-link subcontractors to full account subcontractors.
*   **Sub Onboarding for Existing Accounts**: Automatically links tokens for invited phone numbers already belonging to JobRunner users, streamlining the onboarding process. Provides a premium CTA for linking or creating accounts after job completion.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, client data sanitization, and site photo filtering. Navigation elements are gated based on user roles and subscription levels.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, idempotent record creation, optimistic UI rollback, field-level conflict merging, and background sync failure notifications with retry capabilities.
*   **Smart GPS Features**: Provides real ETA in "On My Way" SMS, a Smart Job Dashboard with distance and drive time, and Photo MMS via Twilio. Mobile GPS & Geofencing features include background tracking, geofence notifications, and running late detection.
*   **Track My Arrival**: Public job portal displaying assigned workers with profile images and polished SMS templates for status updates, including delayed notifications and anti-spam measures for frequent status changes.
*   **Website Addon Interactive Features**: Provides toggleable interactive features for business websites including Click-to-Call, an AI Chat Widget (powered by the same AI as the receptionist), and a Booking Form that creates leads. These features have public API endpoints for interaction and authenticated endpoints for management.
*   **Android Compatibility**: Specific considerations for Android build processes and UI components have been implemented to ensure cross-platform functionality.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
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
*   **Calendar Integration**: Google Calendar, Outlook/Microsoft 365
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK
*   **AI Receptionist (Voice)**: Vapi.ai (enhanced with ElevenLabs)
*   **Error Tracking**: Sentry