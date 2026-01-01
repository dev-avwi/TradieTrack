import { storage, db } from './storage';
import { AuthService } from './auth';
import { teamMemberSkills } from '@shared/schema';

// Demo user data - Business Owner
const DEMO_USER = {
  email: 'demo@tradietrack.com.au',
  username: 'demo_tradie',
  password: 'demo123456',
  firstName: 'Mike',
  lastName: 'Thompson',
  tradeType: 'plumbing'
};

// Demo worker account - belongs to demo team
const DEMO_WORKER = {
  email: 'worker@tradietrack.com.au',
  username: 'demo_worker',
  password: 'worker123456',
  firstName: 'Jake',
  lastName: 'Morrison',
  tradeType: 'plumbing'
};

// Test user accounts for QA testing
const TEST_USERS = [
  {
    id: 'test-owner-mike-sullivan',
    email: 'mike@northqldplumbing.com.au',
    username: 'mike_sullivan',
    password: 'Test123!',
    firstName: 'Mike',
    lastName: 'Sullivan',
    tradeType: 'plumbing',
    role: 'owner'
  },
  {
    id: 'test-solo-luke-harris',
    email: 'luke@harriselectrical.com.au',
    username: 'luke_harris',
    password: 'Test123!',
    firstName: 'Luke',
    lastName: 'Harris',
    tradeType: 'electrical',
    role: 'solo'
  },
  {
    id: 'test-tradie-tom-nguyen',
    email: 'tom@northqldplumbing.com.au',
    username: 'tom_nguyen',
    password: 'Test123!',
    firstName: 'Tom',
    lastName: 'Nguyen',
    tradeType: 'plumbing',
    role: 'tradie'
  }
];

// Fix test user passwords on startup
export async function fixTestUserPasswords() {
  console.log('🔧 Checking test user passwords...');
  
  for (const testUser of TEST_USERS) {
    try {
      const existingUser = await storage.getUserByEmail(testUser.email);
      if (existingUser) {
        // Hash the correct password and update
        const hashedPassword = await AuthService.hashPassword(testUser.password);
        await storage.updateUser(existingUser.id, { 
          password: hashedPassword,
          emailVerified: true 
        });
        console.log(`✅ Fixed password for ${testUser.email}`);
      }
    } catch (error) {
      console.error(`Failed to fix password for ${testUser.email}:`, error);
    }
  }
}

export async function createDemoUserAndData() {
  try {
    console.log('Setting up demo user and data...');
    
    // Check if demo user already exists
    let demoUser = await storage.getUserByEmail(DEMO_USER.email);
    
    if (!demoUser) {
      // Create demo user
      const result = await AuthService.register(DEMO_USER);
      if (!result.success) {
        console.error('Failed to create demo user:', result.error);
        return null;
      }
      demoUser = await storage.getUserByEmail(DEMO_USER.email);
      console.log('✅ Demo user created:', DEMO_USER.email);
    } else {
      // Demo user exists - ensure password is correct (fix placeholder hashes)
      const hashedPassword = await AuthService.hashPassword(DEMO_USER.password);
      await storage.updateUser(demoUser.id, { 
        password: hashedPassword,
        emailVerified: true 
      });
      console.log('✅ Demo user already exists, password updated:', DEMO_USER.email);
    }

    if (!demoUser) {
      console.error('Demo user not found after creation');
      return null;
    }

    // Ensure demo user email is verified
    if (!demoUser.emailVerified) {
      await storage.updateUser(demoUser.id, { emailVerified: true });
      const updatedUser = await storage.getUserByEmail(DEMO_USER.email);
      if (updatedUser) {
        demoUser = updatedUser;
      }
      console.log('✅ Demo user email verified');
    }

    // Check if demo user has business settings
    let businessSettings = await storage.getBusinessSettings(demoUser.id);
    if (!businessSettings) {
      // Create business settings
      businessSettings = await storage.createBusinessSettings({
        userId: demoUser.id,
        businessName: "Mike's Plumbing Services",
        abn: "12 345 678 901",
        phone: "(07) 4123 4567",
        email: "mike@mikesplumbing.com.au",
        address: "15 Trade Street, Cairns QLD 4870",
        gstEnabled: true,
        defaultHourlyRate: "120.00",
        calloutFee: "90.00",
        quoteValidityDays: 30,
        invoicePrefix: "MP-",
        quotePrefix: "MPQ-",
        paymentInstructions: "Payment due within 30 days. Direct deposit preferred.",
        brandColor: "#2563eb",
        invoiceTerms: "1. All work is guaranteed for 12 months from completion. 2. Payments must be made within 14 days of invoice date. 3. Materials remain property of Mike's Plumbing until paid in full.",
        warrantyPeriod: "12 months workmanship warranty on all plumbing installations"
      });
      console.log('✅ Demo business settings created');
    }

    // Reset data for demo user to ensure clean state with complete chains
    console.log('🔄 Resetting data for demo user to ensure clean document chains...');
    const allClients = await storage.getClients(demoUser.id);
    for (const client of allClients) {
      await storage.deleteClient(client.id, demoUser.id);
    }
    const allJobs = await storage.getJobs(demoUser.id, true);
    for (const job of allJobs) {
      await storage.deleteJob(job.id, demoUser.id);
    }
    const allQuotes = await storage.getQuotes(demoUser.id, true);
    for (const quote of allQuotes) {
      await storage.deleteQuote(quote.id, demoUser.id);
    }
    const allInvoices = await storage.getInvoices(demoUser.id, true);
    for (const invoice of allInvoices) {
      await storage.deleteInvoice(invoice.id, demoUser.id);
    }
    const allReceipts = await storage.getReceipts(demoUser.id);
    for (const receipt of allReceipts) {
      await storage.deleteReceipt(receipt.id, demoUser.id);
    }

    // Create demo clients - expanded list for realistic testing
    const demoClients = [
        {
          userId: demoUser.id,
          name: "Sarah Johnson",
          email: "sarah.johnson@email.com",
          phone: "(07) 4123 4567",
          address: "15 Oak Street, Cairns QLD 4870",
          notes: "Preferred customer - prompt payment"
        },
        {
          userId: demoUser.id,
          name: "David Wilson", 
          email: "d.wilson@email.com",
          phone: "(07) 4987 6543",
          address: "8 Pine Avenue, Trinity Beach QLD 4879",
          notes: "Regular maintenance contract"
        },
        {
          userId: demoUser.id,
          name: "Emma Thompson",
          email: "emma.t@email.com",
          phone: "(07) 4555 1234",
          address: "22 Beach Road, Port Douglas QLD 4877",
          notes: "New customer - kitchen renovation"
        },
        {
          userId: demoUser.id,
          name: "Marcus Chen",
          email: "marcus.chen@gmail.com",
          phone: "(07) 4111 2233",
          address: "45 Reef Street, Palm Cove QLD 4879",
          notes: "Commercial property manager - multiple units"
        },
        {
          userId: demoUser.id,
          name: "Lisa Nakamura",
          email: "lisa.n@outlook.com",
          phone: "(07) 4333 4455",
          address: "78 Sunset Drive, Edge Hill QLD 4870",
          notes: "Referred by Sarah Johnson"
        },
        {
          userId: demoUser.id,
          name: "Robert O'Brien",
          email: "rob.obrien@yahoo.com.au",
          phone: "(07) 4222 5566",
          address: "12 Mango Court, Whitfield QLD 4870",
          notes: "Pool and spa maintenance"
        },
        {
          userId: demoUser.id,
          name: "Jennifer Walsh",
          email: "jen.walsh@bigpond.com",
          phone: "(07) 4444 7788",
          address: "33 Hibiscus Street, Smithfield QLD 4878",
          notes: "New build - plumbing rough-in"
        },
        {
          userId: demoUser.id,
          name: "Ahmed Hassan",
          email: "a.hassan@email.com",
          phone: "(07) 4555 9900",
          address: "99 Coral Way, Machans Beach QLD 4878",
          notes: "Restaurant owner - commercial account"
        },
        {
          userId: demoUser.id,
          name: "Melissa Torres",
          email: "mel.torres@icloud.com",
          phone: "(07) 4666 1122",
          address: "5 Banyan Close, Holloways Beach QLD 4878",
          notes: "Rental property investor - 3 properties"
        }
      ];

      const createdClients = [];
      for (const clientData of demoClients) {
        const client = await storage.createClient(clientData);
        createdClients.push(client);
      }
      console.log('✅ Demo clients created:', createdClients.length);

      // Create demo jobs with varied statuses and dates to show urgency badges
      // Cairns QLD coordinates: -16.92, 145.77
      const now = new Date();
      const demoJobs = [
        // OVERDUE - scheduled job that's past its time (shows red pulsing badge)
        {
          userId: demoUser.id,
          clientId: createdClients[0].id,
          title: "Urgent Drain Blockage",
          description: "Clear blocked drain in laundry - customer waiting",
          address: createdClients[0].address || "",
          latitude: "-16.9186",
          longitude: "145.7781",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (OVERDUE)
          notes: "Customer called twice - high priority"
        },
        // STARTING SOON - within 45 minutes (shows orange pulsing badge)
        {
          userId: demoUser.id,
          clientId: createdClients[1].id,
          title: "Gas Line Inspection",
          description: "Annual gas safety check and compliance certificate",
          address: createdClients[1].address || "",
          latitude: "-16.7889",
          longitude: "145.6967",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 45 * 60 * 1000), // 45 minutes from now
          notes: "Need gas certificate for landlord"
        },
        // TODAY - later today (shows blue badge)
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Kitchen Tap Replacement",
          description: "Replace old kitchen tap with new mixer tap",
          address: createdClients[2].address || "",
          latitude: "-16.4827",
          longitude: "145.4635",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          notes: "Customer prefers afternoon appointment"
        },
        // TOMORROW (shows purple badge)
        {
          userId: demoUser.id,
          clientId: createdClients[0].id,
          title: "Bathroom Renovation Plumbing",
          description: "Rough-in plumbing for new bathroom fixtures",
          address: createdClients[0].address || "",
          latitude: "-16.9250",
          longitude: "145.7720",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          notes: "Full day job - bring extra supplies"
        },
        // IN PROGRESS - active job to test timer banner
        {
          userId: demoUser.id,
          clientId: createdClients[1].id,
          title: "Bathroom Leak Repair",
          description: "Fix leak under bathroom sink",
          address: createdClients[1].address || "",
          latitude: "-16.7950",
          longitude: "145.7000",
          status: "in_progress" as const,
          scheduledAt: new Date(), // Today
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 mins ago
          notes: "Emergency job - water damage prevention"
        },
        // DONE - completed job
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Hot Water System Service",
          description: "Annual service and maintenance",
          address: createdClients[2].address || "",
          latitude: "-16.4900",
          longitude: "145.4700",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours after start
          notes: "System in good condition - no issues found"
        },
        // PENDING - waiting for quote acceptance
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Pool Pump Installation",
          description: "Install new pool pump and filter system",
          address: createdClients[2].address || "",
          latitude: "-16.5000",
          longitude: "145.4800",
          status: "pending" as const,
          scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          notes: "Awaiting quote approval"
        }
      ];

      const createdJobs = [];
      for (const jobData of demoJobs) {
        const job = await storage.createJob(jobData);
        createdJobs.push(job);
      }
      console.log('✅ Demo jobs created:', createdJobs.length);

      // ============================================
      // CREATE 8 QUOTES ACROSS ALL STATUS CATEGORIES
      // 2 Draft, 2 Sent, 2 Accepted, 2 Rejected
      // ============================================

      // DRAFT QUOTES (2)
      const draft1Num = await storage.generateQuoteNumber(demoUser.id);
      const draftQuote1 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        title: "Kitchen Renovation Plumbing",
        description: "Complete kitchen plumbing upgrade including new sink, dishwasher connection, and garbage disposal",
        status: "draft" as const,
        subtotal: "1850.00",
        gstAmount: "185.00",
        total: "2035.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft1Num
      });
      await storage.createQuoteLineItem({ quoteId: draftQuote1.id, description: "Kitchen Sink (Stainless Steel Double Bowl)", quantity: "1.00", unitPrice: "450.00", total: "450.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: draftQuote1.id, description: "Dishwasher Connection Kit", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: draftQuote1.id, description: "Garbage Disposal Unit", quantity: "1.00", unitPrice: "350.00", total: "350.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: draftQuote1.id, description: "Installation Labour (7 hours)", quantity: "7.00", unitPrice: "120.00", total: "840.00", sortOrder: 4 });
      await storage.createQuoteLineItem({ quoteId: draftQuote1.id, description: "Miscellaneous Fittings", quantity: "1.00", unitPrice: "30.00", total: "30.00", sortOrder: 5 });

      const draft2Num = await storage.generateQuoteNumber(demoUser.id);
      const draftQuote2 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Outdoor Shower Installation",
        description: "Install outdoor shower near pool area with hot and cold water",
        status: "draft" as const,
        subtotal: "980.00",
        gstAmount: "98.00",
        total: "1078.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft2Num
      });
      await storage.createQuoteLineItem({ quoteId: draftQuote2.id, description: "Outdoor Shower Fixture (Chrome)", quantity: "1.00", unitPrice: "320.00", total: "320.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: draftQuote2.id, description: "Hot/Cold Mixing Valve", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: draftQuote2.id, description: "Installation Labour (4 hours)", quantity: "4.00", unitPrice: "120.00", total: "480.00", sortOrder: 3 });

      // SENT QUOTES (2)
      const sent1Num = await storage.generateQuoteNumber(demoUser.id);
      const sentQuote1 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        jobId: createdJobs[2].id,
        title: "Kitchen Tap Replacement Quote",
        description: "Supply and install new kitchen mixer tap",
        status: "sent" as const,
        subtotal: "280.00",
        gstAmount: "28.00",
        total: "308.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        number: sent1Num
      });
      await storage.createQuoteLineItem({ quoteId: sentQuote1.id, description: "Premium Kitchen Mixer Tap", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: sentQuote1.id, description: "Installation Labour (1 hour)", quantity: "1.00", unitPrice: "120.00", total: "120.00", sortOrder: 2 });

      const sent2Num = await storage.generateQuoteNumber(demoUser.id);
      const sentQuote2 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        title: "Water Heater Replacement",
        description: "Replace existing gas water heater with new energy-efficient model",
        status: "sent" as const,
        subtotal: "2200.00",
        gstAmount: "220.00",
        total: "2420.00",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: sent2Num
      });
      await storage.createQuoteLineItem({ quoteId: sentQuote2.id, description: "Rheem 250L Gas Water Heater", quantity: "1.00", unitPrice: "1450.00", total: "1450.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: sentQuote2.id, description: "Removal of Old Unit", quantity: "1.00", unitPrice: "150.00", total: "150.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: sentQuote2.id, description: "Installation Labour (5 hours)", quantity: "5.00", unitPrice: "120.00", total: "600.00", sortOrder: 3 });

      // ACCEPTED QUOTES (2)
      const accepted1Num = await storage.generateQuoteNumber(demoUser.id);
      const acceptedQuote1 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Ensuite Bathroom Plumbing",
        description: "Complete plumbing for new ensuite bathroom addition",
        status: "accepted" as const,
        subtotal: "3200.00",
        gstAmount: "320.00",
        total: "3520.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        acceptedBy: "David Wilson",
        number: accepted1Num
      });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Toilet Suite (Wall-Hung)", quantity: "1.00", unitPrice: "890.00", total: "890.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Vanity Basin and Cabinet", quantity: "1.00", unitPrice: "650.00", total: "650.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Shower Screen and Base", quantity: "1.00", unitPrice: "420.00", total: "420.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Tapware Set", quantity: "1.00", unitPrice: "280.00", total: "280.00", sortOrder: 4 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Rough-In Plumbing", quantity: "1.00", unitPrice: "480.00", total: "480.00", sortOrder: 5 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote1.id, description: "Installation Labour (4 hours)", quantity: "4.00", unitPrice: "120.00", total: "480.00", sortOrder: 6 });

      const accepted2Num = await storage.generateQuoteNumber(demoUser.id);
      const acceptedQuote2 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        title: "Rainwater Tank Connection",
        description: "Connect rainwater tank to toilets and laundry",
        status: "accepted" as const,
        subtotal: "1450.00",
        gstAmount: "145.00",
        total: "1595.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        acceptedBy: "Emma Thompson",
        number: accepted2Num
      });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote2.id, description: "Pump and Pressure System", quantity: "1.00", unitPrice: "580.00", total: "580.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote2.id, description: "Pipework and Fittings", quantity: "1.00", unitPrice: "350.00", total: "350.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote2.id, description: "Mains Water Switching Valve", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote2.id, description: "Installation Labour (3 hours)", quantity: "3.00", unitPrice: "120.00", total: "360.00", sortOrder: 4 });

      // REJECTED QUOTES (2)
      const rejected1Num = await storage.generateQuoteNumber(demoUser.id);
      const rejectedQuote1 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        title: "Solar Hot Water System",
        description: "Supply and install solar hot water system with electric boost",
        status: "rejected" as const,
        subtotal: "4800.00",
        gstAmount: "480.00",
        total: "5280.00",
        validUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        number: rejected1Num
      });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote1.id, description: "Solar Collector Panels (2)", quantity: "2.00", unitPrice: "1200.00", total: "2400.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote1.id, description: "Storage Tank 315L", quantity: "1.00", unitPrice: "1100.00", total: "1100.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote1.id, description: "Electric Booster Element", quantity: "1.00", unitPrice: "250.00", total: "250.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote1.id, description: "Installation Labour (9 hours)", quantity: "9.00", unitPrice: "120.00", total: "1080.00", sortOrder: 4 });

      const rejected2Num = await storage.generateQuoteNumber(demoUser.id);
      const rejectedQuote2 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Greywater Recycling System",
        description: "Install greywater system for garden irrigation",
        status: "rejected" as const,
        subtotal: "3650.00",
        gstAmount: "365.00",
        total: "4015.00",
        validUntil: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        number: rejected2Num
      });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote2.id, description: "Greywater Treatment Tank", quantity: "1.00", unitPrice: "1800.00", total: "1800.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote2.id, description: "Irrigation Pump", quantity: "1.00", unitPrice: "450.00", total: "450.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote2.id, description: "Diversion Valves and Pipework", quantity: "1.00", unitPrice: "680.00", total: "680.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote2.id, description: "Installation Labour (6 hours)", quantity: "6.00", unitPrice: "120.00", total: "720.00", sortOrder: 4 });

      console.log('✅ 8 Demo quotes created (2 draft, 2 sent, 2 accepted, 2 rejected)');

      // ============================================
      // CREATE MULTIPLE INVOICES ACROSS ALL STATUSES
      // Draft, Sent, Overdue, Paid
      // ============================================

      // DRAFT INVOICE
      const draftInvNum = await storage.generateInvoiceNumber(demoUser.id);
      const draftInvoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Emergency Call-Out - After Hours",
        description: "After-hours emergency call-out for burst pipe",
        status: "draft" as const,
        subtotal: "380.00",
        gstAmount: "38.00",
        total: "418.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draftInvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: draftInvoice.id, description: "After-Hours Call-Out Fee", quantity: "1.00", unitPrice: "150.00", total: "150.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: draftInvoice.id, description: "Emergency Pipe Repair", quantity: "1.00", unitPrice: "110.00", total: "110.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: draftInvoice.id, description: "Labour (1 hour)", quantity: "1.00", unitPrice: "120.00", total: "120.00", sortOrder: 3 });

      // SENT INVOICES (2)
      const sentInv1Num = await storage.generateInvoiceNumber(demoUser.id);
      const sentInvoice1 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        jobId: createdJobs[5].id,
        title: "Hot Water System Service",
        description: "Annual service and maintenance completed",
        status: "sent" as const,
        subtotal: "150.00",
        gstAmount: "15.00",
        total: "165.00",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        number: sentInv1Num
      });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice1.id, description: "Hot Water System Service", quantity: "1.00", unitPrice: "150.00", total: "150.00", sortOrder: 1 });

      const sentInv2Num = await storage.generateInvoiceNumber(demoUser.id);
      const sentInvoice2 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        title: "Drain Cleaning Service",
        description: "High-pressure drain cleaning and camera inspection",
        status: "sent" as const,
        subtotal: "420.00",
        gstAmount: "42.00",
        total: "462.00",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        number: sentInv2Num
      });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice2.id, description: "High-Pressure Jetter Service", quantity: "1.00", unitPrice: "280.00", total: "280.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice2.id, description: "CCTV Drain Camera Inspection", quantity: "1.00", unitPrice: "140.00", total: "140.00", sortOrder: 2 });

      // OVERDUE INVOICE
      const overdueInvNum = await storage.generateInvoiceNumber(demoUser.id);
      const overdueInvoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Tap Washer Replacements",
        description: "Replace worn washers on 3 taps throughout house",
        status: "sent" as const,
        subtotal: "180.00",
        gstAmount: "18.00",
        total: "198.00",
        dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        number: overdueInvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: overdueInvoice.id, description: "Tap Washers (3 sets)", quantity: "3.00", unitPrice: "15.00", total: "45.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: overdueInvoice.id, description: "Labour (1.5 hours)", quantity: "1.50", unitPrice: "90.00", total: "135.00", sortOrder: 2 });

      // PAID INVOICES (3) - with linked receipts
      const paid1InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice1 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        quoteId: acceptedQuote1.id,
        title: "Ensuite Bathroom Plumbing - Progress Payment",
        description: "50% deposit for ensuite bathroom plumbing work",
        status: "paid" as const,
        subtotal: "1600.00",
        gstAmount: "160.00",
        total: "1760.00",
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        number: paid1InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice1.id, description: "50% Deposit - Ensuite Bathroom Plumbing", quantity: "1.00", unitPrice: "1600.00", total: "1600.00", sortOrder: 1 });

      const paid2InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice2 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        title: "Toilet Replacement",
        description: "Supply and install new dual-flush toilet",
        status: "paid" as const,
        subtotal: "680.00",
        gstAmount: "68.00",
        total: "748.00",
        dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        number: paid2InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: "Caroma Dual-Flush Toilet Suite", quantity: "1.00", unitPrice: "520.00", total: "520.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: "Removal of Old Toilet", quantity: "1.00", unitPrice: "40.00", total: "40.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: "Installation Labour (1 hour)", quantity: "1.00", unitPrice: "120.00", total: "120.00", sortOrder: 3 });

      const paid3InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice3 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[1].id,
        title: "Gas Fitting Compliance Check",
        description: "Annual gas safety inspection and compliance certificate",
        status: "paid" as const,
        subtotal: "220.00",
        gstAmount: "22.00",
        total: "242.00",
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        number: paid3InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice3.id, description: "Gas Safety Inspection", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice3.id, description: "Compliance Certificate", quantity: "1.00", unitPrice: "40.00", total: "40.00", sortOrder: 2 });

      console.log('✅ 7 Demo invoices created (1 draft, 2 sent, 1 overdue, 3 paid)');

      // ============================================
      // CREATE RECEIPTS FOR ALL PAID INVOICES
      // ============================================

      const receipt1 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice1.id,
        clientId: createdClients[0].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-001`,
        amount: "1760.00",
        gstAmount: "160.00",
        subtotal: "1600.00",
        description: "50% Deposit - Ensuite Bathroom Plumbing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000)
      });

      const receipt2 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice2.id,
        clientId: createdClients[2].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-002`,
        amount: "748.00",
        gstAmount: "68.00",
        subtotal: "680.00",
        description: "Payment for toilet replacement",
        paymentMethod: 'card',
        paidAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      });

      const receipt3 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice3.id,
        clientId: createdClients[1].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-003`,
        amount: "242.00",
        gstAmount: "22.00",
        subtotal: "220.00",
        description: "Payment for gas compliance check",
        paymentMethod: 'cash',
        paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      });

      console.log('✅ 3 Demo receipts created for paid invoices');
      console.log(`   Receipt ${receipt1.receiptNumber} → Invoice ${paid1InvNum}`);
      console.log(`   Receipt ${receipt2.receiptNumber} → Invoice ${paid2InvNum}`);
      console.log(`   Receipt ${receipt3.receiptNumber} → Invoice ${paid3InvNum}`);
    
    // Check if demo user has SMS conversations (separate from client check)
    const existingSmsConversations = await storage.getSmsConversationsByBusiness(demoUser.id);
    if (existingSmsConversations.length === 0) {
      // Get first client for linking
      const clients = await storage.getClients(demoUser.id);
      const firstClient = clients[0];
      
      // Create demo SMS conversations with job requests
      const smsConversations = [
        {
          businessOwnerId: demoUser.id,
          clientId: firstClient?.id || null,
          clientPhone: '+61412345678',
          clientName: firstClient?.name || 'Sarah Johnson',
          lastMessageAt: new Date(),
          unreadCount: 2,
        },
        {
          businessOwnerId: demoUser.id,
          clientId: null, // Unknown caller - tests auto-client creation
          clientPhone: '+61498765432',
          clientName: 'Unknown Caller',
          lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          unreadCount: 1,
        }
      ];
      
      const createdConversations = [];
      for (const convData of smsConversations) {
        const conv = await storage.createSmsConversation(convData);
        createdConversations.push(conv);
      }
      
      // Create SMS messages including job requests
      const smsMessages = [
        // Conversation 1: Known client asking for a quote (job request)
        {
          conversationId: createdConversations[0].id,
          direction: 'inbound' as const,
          body: 'Hi Mike, can you come out and give me a quote for fixing my hot water system? It stopped heating properly last night. Address is 15 Oak Street Cairns.',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'quote_request' as const,
          suggestedJobTitle: 'Hot Water System Repair',
          suggestedDescription: 'Customer reports hot water system not heating properly. Requesting quote for repair at 15 Oak Street Cairns.',
        },
        {
          conversationId: createdConversations[0].id,
          direction: 'outbound' as const,
          body: "Hi Sarah! Thanks for reaching out. I'll add this to my schedule and get back to you with a quote today.",
          senderUserId: demoUser.id,
          status: 'delivered' as const,
        },
        // Conversation 2: Unknown caller - job request
        {
          conversationId: createdConversations[1].id,
          direction: 'inbound' as const,
          body: 'G\'day mate, I got a burst pipe in my kitchen and water is going everywhere! Can you come ASAP? I\'m at 42 Smith Street, Edge Hill. This is urgent!',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'job_request' as const,
          suggestedJobTitle: 'Emergency Burst Pipe Repair',
          suggestedDescription: 'Emergency call - burst pipe in kitchen causing water damage. Location: 42 Smith Street, Edge Hill. Urgent response required.',
        },
      ];
      
      for (const msgData of smsMessages) {
        await storage.createSmsMessage(msgData);
      }
      
      console.log('✅ Demo SMS conversations created:', createdConversations.length, 'conversations with messages');
    }

    // Check if templates exist, if not seed them (we expect 20+ templates now)
    const templates = await storage.getDocumentTemplates(demoUser.id);
    if (templates.length < 15) {
      console.log('🔄 Seeding tradie templates...');
      try {
        // Import template data
        const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');
        
        let templateCount = 0;
        let itemCount = 0;
        let rateCardCount = 0;

        // Create templates
        for (const template of tradieQuoteTemplates) {
          try {
            await storage.createDocumentTemplate({
              type: template.type,
              familyKey: template.familyKey,
              name: template.name,
              tradeType: template.tradeType,
              userId: demoUser.id,
              styling: template.styling,
              sections: template.sections,
              defaults: template.defaults,
              defaultLineItems: template.defaultLineItems
            });
            templateCount++;
          } catch (error) {
            // Template might already exist, continue
          }
        }

        // Create line items
        for (const item of tradieLineItems) {
          try {
            await storage.createLineItemCatalogItem({
              tradeType: item.tradeType,
              name: item.name,
              description: item.description,
              unit: item.unit,
              unitPrice: item.unitPrice.toString(),
              defaultQty: item.defaultQty.toString(),
              userId: demoUser.id,
              tags: []
            });
            itemCount++;
          } catch (error) {
            // Line item might already exist, continue
          }
        }

        // Create rate cards
        for (const rateCard of tradieRateCards) {
          try {
            await storage.createRateCard({
              name: rateCard.name,
              tradeType: rateCard.tradeType,
              hourlyRate: rateCard.hourlyRate.toString(),
              calloutFee: rateCard.calloutFee.toString(),
              materialMarkupPct: rateCard.materialMarkupPct.toString(),
              afterHoursMultiplier: rateCard.afterHoursMultiplier.toString(),
              gstEnabled: rateCard.gstEnabled,
              userId: demoUser.id
            });
            rateCardCount++;
          } catch (error) {
            // Rate card might already exist, continue
          }
        }

        console.log(`✅ Templates seeded: ${templateCount} templates, ${itemCount} line items, ${rateCardCount} rate cards`);
      } catch (error) {
        console.error('Error seeding templates:', error);
      }
    } else {
      console.log(`✅ Templates already exist: ${templates.length} templates found`);
    }

    return demoUser;
  } catch (error) {
    console.error('Error setting up demo data:', error);
    return null;
  }
}

// Also seed SMS demo data for test users (Mike Sullivan) so testers can see the feature
export async function seedSmsDataForTestUsers() {
  try {
    const testUser = await storage.getUserByEmail('mike@northqldplumbing.com.au');
    if (!testUser) {
      console.log('No test user found for SMS demo data');
      return;
    }
    
    // Check if test user already has SMS conversations
    const existingSmsConversations = await storage.getSmsConversationsByBusiness(testUser.id);
    if (existingSmsConversations.length > 0) {
      console.log(`✅ Test user already has ${existingSmsConversations.length} SMS conversations`);
      return;
    }
    
    // Get first client for linking
    const clients = await storage.getClients(testUser.id);
    const firstClient = clients[0];
    
    // Create SMS conversations with job requests for test user
    const smsConversations = [
      {
        businessOwnerId: testUser.id,
        clientId: firstClient?.id || null,
        clientPhone: '+61412345678',
        clientName: firstClient?.name || 'Sarah Johnson',
        lastMessageAt: new Date(),
        unreadCount: 2,
      },
      {
        businessOwnerId: testUser.id,
        clientId: null, // Unknown caller - tests auto-client creation
        clientPhone: '+61498765432',
        clientName: 'Unknown Caller',
        lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        unreadCount: 1,
      }
    ];
    
    const createdConversations = [];
    for (const convData of smsConversations) {
      const conv = await storage.createSmsConversation(convData);
      createdConversations.push(conv);
    }
    
    // Create SMS messages including job requests
    const smsMessages = [
      {
        conversationId: createdConversations[0].id,
        direction: 'inbound' as const,
        body: 'Hi, can you come out and give me a quote for fixing my hot water system? It stopped heating properly last night. Address is 15 Oak Street Cairns.',
        status: 'delivered' as const,
        isJobRequest: true,
        intentConfidence: 'high' as const,
        intentType: 'quote_request' as const,
        suggestedJobTitle: 'Hot Water System Repair',
        suggestedDescription: 'Customer reports hot water system not heating properly. Requesting quote for repair at 15 Oak Street Cairns.',
      },
      {
        conversationId: createdConversations[0].id,
        direction: 'outbound' as const,
        body: "Thanks for reaching out. I'll add this to my schedule and get back to you with a quote today.",
        senderUserId: testUser.id,
        status: 'delivered' as const,
      },
      {
        conversationId: createdConversations[1].id,
        direction: 'inbound' as const,
        body: 'G\'day mate, I got a burst pipe in my kitchen and water is going everywhere! Can you come ASAP? I\'m at 42 Smith Street, Edge Hill. This is urgent!',
        status: 'delivered' as const,
        isJobRequest: true,
        intentConfidence: 'high' as const,
        intentType: 'job_request' as const,
        suggestedJobTitle: 'Emergency Burst Pipe Repair',
        suggestedDescription: 'Emergency call - burst pipe in kitchen causing water damage. Location: 42 Smith Street, Edge Hill. Urgent response required.',
      },
    ];
    
    for (const msgData of smsMessages) {
      await storage.createSmsMessage(msgData);
    }
    
    console.log('✅ Test user SMS demo data created:', createdConversations.length, 'conversations');
  } catch (error) {
    console.error('Error seeding SMS data for test users:', error);
  }
}

// Sydney-area coordinates for demo team members (realistic Australian locations)
const SYDNEY_TEAM_LOCATIONS = [
  { lat: -33.8688, lng: 151.2093 }, // Sydney CBD
  { lat: -33.8568, lng: 151.2153 }, // Circular Quay
  { lat: -33.8915, lng: 151.2767 }, // Bondi Beach
  { lat: -33.8402, lng: 151.2086 }, // North Sydney
  { lat: -33.9285, lng: 151.1683 }, // Marrickville
  { lat: -33.8749, lng: 151.2062 }, // Pyrmont
];

// Ensure existing team members have tradieStatus records for map visibility
async function ensureTeamMemberLocations(businessOwnerId: string, teamMembers: any[]) {
  console.log('🔧 Ensuring team members have location data for map...');
  let updated = 0;
  
  for (let i = 0; i < teamMembers.length; i++) {
    const member = teamMembers[i];
    if (!member.memberId) continue;
    
    // Check if tradieStatus exists
    const existingStatus = await storage.getTradieStatus(member.memberId);
    if (existingStatus?.currentLatitude && existingStatus?.currentLongitude) {
      continue; // Already has location
    }
    
    // Use Sydney coordinates (rotating through the array)
    const coords = SYDNEY_TEAM_LOCATIONS[i % SYDNEY_TEAM_LOCATIONS.length];
    const lastSeenOffset = Math.floor(Math.random() * 30) * 60 * 1000; // 0-30 mins ago
    const activityStatuses = ['online', 'working', 'driving', 'offline'];
    const activityStatus = activityStatuses[Math.floor(Math.random() * activityStatuses.length)];
    
    await storage.upsertTradieStatus({
      userId: member.memberId,
      businessOwnerId: businessOwnerId,
      currentLatitude: coords.lat.toString(),
      currentLongitude: coords.lng.toString(),
      activityStatus: activityStatus,
      lastSeenAt: new Date(Date.now() - lastSeenOffset),
      lastLocationUpdate: new Date(Date.now() - lastSeenOffset),
      batteryLevel: Math.floor(Math.random() * 60) + 40, // 40-100%
      isCharging: Math.random() > 0.7, // 30% chance charging
      speed: activityStatus === 'driving' ? String(Math.floor(Math.random() * 60) + 20) : '0', // 20-80 km/h if driving
    });
    updated++;
  }
  
  if (updated > 0) {
    console.log(`✅ Added location data for ${updated} team members`);
  }
}

// Create demo team members with realistic Australian data for testing live locations
export async function createDemoTeamMembers() {
  try {
    console.log('🔧 Setting up demo team members...');
    
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      console.log('Demo user not found, skipping team member creation');
      return;
    }
    
    // Check if demo worker account needs to be updated (indicates config change)
    const existingTeamMembers = await storage.getTeamMembers(demoUser.id);
    const hasWorkerDemoAccount = existingTeamMembers.some(m => m.email === DEMO_WORKER.email);
    const hasInvitedMembers = existingTeamMembers.some(m => m.inviteStatus === 'invited');
    
    // Force reset if: team config changed (no worker account or no invited members)
    const needsReset = existingTeamMembers.length > 0 && (!hasWorkerDemoAccount || !hasInvitedMembers);
    
    if (needsReset) {
      console.log('🔄 Resetting team members for updated configuration...');
      // Delete existing team members to recreate with proper config
      for (const member of existingTeamMembers) {
        await storage.deleteTeamMember(member.id, demoUser.id);
      }
    } else if (existingTeamMembers.length >= 5 && hasWorkerDemoAccount && hasInvitedMembers) {
      console.log(`✅ Demo team already has ${existingTeamMembers.length} members`);
      // Ensure existing team members have tradieStatus records for map visibility
      await ensureTeamMemberLocations(demoUser.id, existingTeamMembers);
      return;
    }
    
    // Get emails of existing team members to avoid duplicates (after potential reset)
    const currentTeamMembers = await storage.getTeamMembers(demoUser.id);
    const existingEmails = new Set(currentTeamMembers.map(m => m.email));
    
    // Create roles if they don't exist
    const existingRoles = await storage.getUserRoles();
    let workerRole = existingRoles.find(r => r.name === 'Worker');
    let managerRole = existingRoles.find(r => r.name === 'Manager');
    
    if (!workerRole) {
      workerRole = await storage.createUserRole({
        name: 'Worker',
        description: 'Field worker - works on assigned jobs',
        permissions: ['read_jobs', 'write_job_notes', 'write_job_media', 'read_clients', 'read_time_entries', 'write_time_entries'],
      });
    }
    if (!managerRole) {
      managerRole = await storage.createUserRole({
        name: 'Manager', 
        description: 'Manages jobs, team members, quotes and invoices',
        permissions: ['read_jobs', 'write_jobs', 'assign_jobs', 'read_quotes', 'write_quotes', 'read_invoices', 'write_invoices', 'read_clients', 'manage_team', 'read_reports'],
      });
    }
    
    // Demo team members - realistic Australian names with Cairns area locations
    // Some are accepted (can login and work), some are invited (pending acceptance)
    const teamMemberData = [
      {
        firstName: 'Jake',
        lastName: 'Morrison',
        email: DEMO_WORKER.email, // Use demo worker email so user can login as this team member
        role: workerRole.id,
        status: 'online',
        lat: -16.9203, // Cairns CBD
        lng: 145.7710,
        statusMessage: 'On-site at client',
        inviteStatus: 'accepted' as const, // Can login as worker@tradietrack.com.au
      },
      {
        firstName: 'Sarah',
        lastName: 'Chen',
        email: 'sarah.chen@mikesplumbing.com.au',
        role: managerRole.id,
        status: 'online',
        lat: -16.9282, // Parramatta Park
        lng: 145.7571,
        statusMessage: 'Managing afternoon schedule',
        inviteStatus: 'accepted' as const,
      },
      {
        firstName: 'Liam',
        lastName: 'OConnor',
        email: 'liam.oconnor@mikesplumbing.com.au',
        role: workerRole.id,
        status: 'on_job',
        lat: -16.8853, // Edge Hill
        lng: 145.7321,
        statusMessage: 'Hot water install - 42 Smith St',
        inviteStatus: 'accepted' as const,
      },
      {
        firstName: 'Brodie',
        lastName: 'Williams',
        email: 'brodie.williams@mikesplumbing.com.au',
        role: workerRole.id,
        status: 'busy',
        lat: -16.8513, // Whitfield
        lng: 145.7109,
        statusMessage: 'Emergency callout',
        inviteStatus: 'invited' as const, // Pending invite - for testing invite flow
      },
      {
        firstName: 'Emma',
        lastName: 'Patterson',
        email: 'emma.patterson@mikesplumbing.com.au',
        role: workerRole.id,
        status: 'break',
        lat: -16.9187, // Cairns Esplanade
        lng: 145.7788,
        statusMessage: 'Lunch break',
        inviteStatus: 'invited' as const, // Pending invite - for testing invite flow
      },
      {
        firstName: 'Trent',
        lastName: 'Nguyen',
        email: 'trent.nguyen@mikesplumbing.com.au',
        role: workerRole.id,
        status: 'on_job',
        lat: -16.9475, // Earlville
        lng: 145.7401,
        statusMessage: 'Blocked drain - residential',
        inviteStatus: 'accepted' as const,
      },
    ];
    
    // Skills/certifications data
    const skillsData: Record<string, Array<{name: string; type: string; license?: string; expiry?: Date}>> = {
      'Jake Morrison': [
        { name: 'QBCC Plumbing License', type: 'license', license: 'QLD-PL-45678', expiry: new Date('2025-08-15') },
        { name: 'White Card', type: 'certification', license: 'WC-123456' },
      ],
      'Sarah Chen': [
        { name: 'QBCC Plumbing License', type: 'license', license: 'QLD-PL-34567', expiry: new Date('2025-11-20') },
        { name: 'First Aid Certificate', type: 'certification', expiry: new Date('2025-03-10') },
        { name: 'Working at Heights', type: 'certification', expiry: new Date('2025-06-30') },
      ],
      'Liam OConnor': [
        { name: 'QBCC Plumbing License', type: 'license', license: 'QLD-PL-56789', expiry: new Date('2026-02-28') },
        { name: 'Gas Fitting License', type: 'license', license: 'QLD-GAS-11223', expiry: new Date('2025-09-15') },
        { name: 'White Card', type: 'certification', license: 'WC-234567' },
      ],
      'Brodie Williams': [
        { name: 'Apprentice Plumber (3rd Year)', type: 'training' },
        { name: 'White Card', type: 'certification', license: 'WC-345678' },
        { name: 'First Aid Certificate', type: 'certification', expiry: new Date('2025-05-20') },
      ],
      'Emma Patterson': [
        { name: 'QBCC Plumbing License', type: 'license', license: 'QLD-PL-67890', expiry: new Date('2025-12-01') },
        { name: 'Backflow Prevention', type: 'certification', expiry: new Date('2025-07-15') },
        { name: 'White Card', type: 'certification', license: 'WC-456789' },
      ],
      'Trent Nguyen': [
        { name: 'QBCC Plumbing License', type: 'license', license: 'QLD-PL-78901', expiry: new Date('2026-01-10') },
        { name: 'Drain Camera Certification', type: 'certification' },
        { name: 'White Card', type: 'certification', license: 'WC-567890' },
      ],
    };
    
    for (const member of teamMemberData) {
      // Skip if team member with this email already exists
      if (existingEmails.has(member.email)) {
        console.log(`  ⏭️ Skipping existing member: ${member.firstName} ${member.lastName}`);
        continue;
      }
      
      // Use demo worker password for the worker demo account, otherwise use default
      const isWorkerDemoAccount = member.email === DEMO_WORKER.email;
      const password = isWorkerDemoAccount ? DEMO_WORKER.password : 'TeamMember123!';
      const hashedPassword = await AuthService.hashPassword(password);
      let memberUser = await storage.getUserByEmail(member.email);
      
      if (!memberUser) {
        memberUser = await storage.createUser({
          email: member.email,
          username: isWorkerDemoAccount ? DEMO_WORKER.username : member.email.split('@')[0],
          password: hashedPassword,
          firstName: member.firstName,
          lastName: member.lastName,
        });
        // Mark email as verified
        await storage.updateUser(memberUser.id, { emailVerified: true });
      } else if (isWorkerDemoAccount) {
        // Update password for worker demo account if user already exists
        await storage.updateUser(memberUser.id, { password: hashedPassword, emailVerified: true });
      }
      
      // Create team member record with proper invite status
      const isAccepted = member.inviteStatus === 'accepted';
      const teamMember = await storage.createTeamMember({
        businessOwnerId: demoUser.id,
        memberId: isAccepted ? memberUser.id : undefined, // Only link user if accepted
        roleId: member.role,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        inviteStatus: member.inviteStatus,
        inviteAcceptedAt: isAccepted ? new Date() : undefined,
        allowLocationSharing: isAccepted,
        locationEnabledByOwner: isAccepted,
        hourlyRate: '55.00',
        startDate: isAccepted ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) : undefined,
        isActive: isAccepted,
      });
      
      // Only create presence/location data for accepted team members
      if (isAccepted) {
        // Create presence record with location
        const lastSeenOffset = Math.floor(Math.random() * 30) * 60 * 1000; // 0-30 mins ago
        await storage.updatePresence(memberUser.id, demoUser.id, {
          status: member.status,
          statusMessage: member.statusMessage,
          lastLocationLat: member.lat,
          lastLocationLng: member.lng,
          lastLocationUpdatedAt: new Date(Date.now() - lastSeenOffset),
        });
        
        // Create tradieStatus record for map visibility (used by /api/map/team-locations)
        const activityStatus = member.status === 'on_job' ? 'working' : 
                              member.status === 'busy' ? 'working' :
                              member.status === 'break' ? 'offline' : 'online';
        await storage.upsertTradieStatus({
          userId: memberUser.id,
          businessOwnerId: demoUser.id,
          currentLatitude: member.lat.toString(),
          currentLongitude: member.lng.toString(),
          activityStatus: activityStatus,
          lastSeenAt: new Date(Date.now() - lastSeenOffset),
          lastLocationUpdate: new Date(Date.now() - lastSeenOffset),
          batteryLevel: Math.floor(Math.random() * 60) + 40, // 40-100%
          isCharging: Math.random() > 0.7, // 30% chance charging
          speed: activityStatus === 'working' ? '0' : String(Math.floor(Math.random() * 40)), // 0-40 km/h if not working
        });
      }
      
      // Add skills for this member (even for invited members - they have qualifications)
      const memberSkills = skillsData[`${member.firstName} ${member.lastName}`] || [];
      for (const skill of memberSkills) {
        await db.insert(teamMemberSkills).values({
          teamMemberId: teamMember.id,
          skillName: skill.name,
          skillType: skill.type,
          licenseNumber: skill.license,
          expiryDate: skill.expiry,
          isVerified: true,
        });
      }
      
      const statusLabel = isAccepted ? member.status : 'invited';
      console.log(`  ✅ Created team member: ${member.firstName} ${member.lastName} (${statusLabel})`);
    }
    
    console.log('✅ Demo team members created successfully');
  } catch (error) {
    console.error('Error creating demo team members:', error);
  }
}

export { DEMO_USER, DEMO_WORKER };