# JobRunner - App Store Submission Guide

## App Information

**App Name:** JobRunner  
**Subtitle:** Job Management for Tradies  
**Bundle ID:** com.jobrunner.app  
**Version:** 1.1.0  
**Category:** Business  
**Secondary Category:** Productivity  
**Age Rating:** 4+  

---

## App Description (4000 characters max)

JobRunner is the complete business management app designed specifically for Australian tradespeople. Whether you're a solo sparky, a plumber with a small team, or running a growing electrical business, JobRunner helps you manage jobs, send quotes, create invoices, and get paid faster.

**JOB MANAGEMENT**
Create and track jobs from first contact to completion. Add job photos, notes, and checklists. Track job status through a simple 5-stage workflow: Pending, Scheduled, In Progress, Done, and Invoiced. Access job details even when you're offline.

**PROFESSIONAL QUOTES & INVOICES**
Send professional quotes and invoices that make you look like a pro. Choose from beautiful templates or upload your own design. Include your logo, ABN, and business details. Automatic GST calculation built in.

**GET PAID FASTER**
Accept card payments on-site with Tap to Pay. Generate QR codes for quick payments. Send payment links via SMS. Track what's been paid and chase overdue invoices with automated reminders.

**TEAM MANAGEMENT**
Add team members and assign jobs. Track where your crew is with real-time location. Automatic clock-in when tradies arrive at job sites using geofence technology. Review timesheets and manage payroll data.

**SMART SCHEDULING**
View all your jobs on a calendar. Optimise your route for the day. Sync with Google Calendar so you never miss an appointment.

**REPORTS & INSIGHTS**
Track your business performance with easy-to-read reports. See revenue, outstanding invoices, and job completion rates. Export data for your accountant or BAS reporting.

**INTEGRATIONS**
Connect to Xero for seamless accounting. Sync contacts and push invoices automatically. More integrations coming soon.

**BUILT FOR AUSSIE TRADIES**
- Australian dollar (AUD) support
- GST included on all invoices
- ABN display on documents
- Australian address format
- Aussie-friendly language

**SUBSCRIPTION PLANS**
Free: Up to 5 active jobs, basic features
Pro ($39/month): Unlimited jobs, payments, reporting
Team ($49/month + $29/seat): Everything in Pro plus team features

Try Pro free for 14 days. Cancel anytime.

---

## Keywords (100 characters max, comma-separated)

tradies,job management,invoicing,quotes,plumber,electrician,tradie,ABN,GST,payments,aussie business

---

## What's New in This Version

Welcome to JobRunner 1.1! Everything you need to run your trade business:

- Create and manage jobs with photos and notes
- Send professional quotes and invoices
- Accept payments with Tap to Pay, QR codes, and payment links
- Track your team's location and work hours
- Automatic clock-in at job sites with geofence
- Beautiful reports and business insights
- Xero integration for seamless accounting
- Works offline - sync when you're back online

---

## Support URL

https://jobrunner.com.au/support

## Marketing URL

https://jobrunner.com.au

## Privacy Policy URL

https://jobrunner.com.au/privacy

---

## App Review Notes

**Demo Account:**
- Email: demo@jobrunner.com.au
- Password: demo123

This demo account has pre-populated data including sample jobs, clients, quotes, and invoices for testing all features.

**Payment Testing:**
Stripe test mode is enabled. Use test card 4242 4242 4242 4242 with any future expiry and CVC to test payments.

**Location Features:**
Background location is used for:
1. Team Tracking - Owners/managers can see where team members are in real-time
2. Geofence Auto Clock-In - Automatically starts time tracking when tradies arrive at job sites
Location tracking is optional and can be disabled in Settings > App Settings.

**Tap to Pay:**
The app uses Stripe Terminal for Tap to Pay functionality. On simulator/demo mode, payments are simulated. Real NFC payments work on physical devices with Stripe Terminal enabled.

**Subscription Note:**
Subscriptions are managed through Stripe. JobRunner is a business management tool for tradespeople who provide physical services (plumbing, electrical, building, etc.). The subscription unlocks the ability to process real-world payments on-site using Stripe Terminal / Tap to Pay hardware, manage physical job sites, dispatch teams to locations, and invoice clients for physical labour and materials. No digital content, digital goods, or in-app consumables are sold. If the review team determines IAP is required, we are prepared to implement StoreKit integration and would appreciate guidance on the appropriate approach for our use case.

---

## Required Permissions Explanation

**Camera (NSCameraUsageDescription):**
"JobRunner uses your camera to take before-and-after photos of job sites, attach photo evidence to quotes and invoices, and scan documents for your records."

**Photo Library (NSPhotoLibraryUsageDescription):**
"JobRunner accesses your photo library so you can attach existing site photos to jobs, quotes, and invoices as visual records for your clients."

**Microphone (NSMicrophoneUsageDescription):**
"JobRunner uses your microphone to record voice notes that are transcribed and attached to jobs, allowing you to dictate site observations hands-free while working."

**Location When In Use (NSLocationWhenInUseUsageDescription):**
"JobRunner uses your location to show your position on the dispatch map, display nearby job sites, calculate travel distance for timesheets, and provide navigation to your next job."

**Location Always (NSLocationAlwaysAndWhenInUseUsageDescription):**
"JobRunner uses your background location so your team's live positions appear on the dispatch map and to automatically clock you in and out when you arrive at or leave a job site using geofence technology. Your location is only shared with your team owner or manager."
- This is OPTIONAL and requires explicit user consent in the app

**NFC (NFCReaderUsageDescription):**
"JobRunner uses NFC to accept contactless card payments on-site via Tap to Pay, powered by Stripe Terminal."

**Bluetooth (NSBluetoothAlwaysUsageDescription):**
"JobRunner uses Bluetooth to connect to Stripe card readers for processing on-site payments from your clients."

---

## Screenshot Requirements

### iPhone 6.7" (iPhone 14 Pro Max / 15 Pro Max)
1. Dashboard showing today's jobs
2. Job detail page with photos and notes
3. Quote/Invoice creation screen
4. Tap to Pay collection screen
5. Team management with map view
6. Reports and analytics dashboard

### iPhone 6.5" (iPhone 11 Pro Max / 12 Pro Max)
Same as above

### iPhone 5.5" (iPhone 8 Plus)
Same as above (scaled)

### iPad Pro 12.9"
1. Dashboard with sidebar navigation
2. Job detail with photo gallery
3. Financial overview
4. Team location map

---

## App Privacy Details

**Data Linked to You:**
- Contact Info (name, email, phone)
- Financial Info (payment cards via Stripe)
- Location (precise location for team tracking)
- User Content (photos, documents, notes, voice memos)
- Audio Data (voice notes recorded and transcribed for job records)
- Identifiers (user ID)

**Data Not Linked to You:**
- Usage Data (app analytics)
- Diagnostics (crash logs, performance data)

**Data Used for Tracking:**
None

**Data Collected:**
| Category | Purpose | Linked to Identity |
|----------|---------|-------------------|
| Contact Info | App Functionality | Yes |
| Financial Info | App Functionality | Yes |
| Precise Location | App Functionality | Yes |
| Photos or Videos | App Functionality | Yes |
| Other User Content | App Functionality | Yes |
| Audio Data | App Functionality | Yes |
| User ID | App Functionality | Yes |
| Crash Data | App Functionality | No |
| Performance Data | Analytics | No |

---

## Third-Party Services

1. **Stripe** - Payment processing
2. **SendGrid** - Email delivery for invoices/quotes
3. **Twilio** - SMS notifications
4. **Google Cloud** - Photo storage
5. **Xero** - Accounting integration (optional)
6. **Google Calendar** - Calendar sync (optional)
7. **OpenAI** - AI assistant features

All services comply with Australian Privacy Principles and GDPR.

---

## Contact Information

**Developer:** LinkUp2Care Pty Ltd  
**Email:** admin@avwebinnovation.com  
**Phone:** +61 1800 XXX XXX  
**Address:** Sydney, NSW, Australia  

---

## Checklist Before Submission

- [ ] TestFlight build tested on real device
- [ ] All permissions work correctly
- [ ] Demo account accessible and has data
- [ ] Privacy Policy URL is live
- [ ] Terms of Service URL is live
- [ ] Support URL is live
- [ ] App icon meets guidelines (1024x1024, no alpha)
- [ ] Screenshots prepared for all device sizes
- [ ] All text is spelled correctly (Australian English)
- [ ] No placeholder or Lorem Ipsum text
- [ ] Stripe test mode works in TestFlight
- [ ] Account deletion works (Settings > Delete Account)
- [ ] Background location indicator shows when tracking
- [ ] Offline mode works correctly
