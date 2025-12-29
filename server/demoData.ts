import { storage } from './storage';
import { AuthService } from './auth';

// Demo user data
const DEMO_USER = {
  email: 'demo@tradietrack.com.au',
  username: 'demo_tradie',
  password: 'demo123456',
  firstName: 'Mike',
  lastName: 'Thompson',
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
        warrantyTerms: "Standard 12-month workmanship warranty applies to all plumbing installations. Manufacturer warranties apply to specific parts and fixtures as provided."
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

    // Create demo clients
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
        }
      ];

      const createdClients = [];
      for (const clientData of demoClients) {
        const client = await storage.createClient(clientData);
        createdClients.push(client);
      }
      console.log('✅ Demo clients created:', createdClients.length);

      // Create demo jobs with varied statuses and dates to show urgency badges
      const now = new Date();
      const demoJobs = [
        // OVERDUE - scheduled job that's past its time (shows red pulsing badge)
        {
          userId: demoUser.id,
          clientId: createdClients[0].id,
          title: "Urgent Drain Blockage",
          description: "Clear blocked drain in laundry - customer waiting",
          address: createdClients[0].address || "",
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

      // Create demo quote (linked to Kitchen Tap Replacement - index 2)
      const quoteNumber = await storage.generateQuoteNumber(demoUser.id);
      const demoQuote = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        jobId: createdJobs[2].id,
        number: quoteNumber,
        title: "Kitchen Tap Replacement Quote",
        description: "Supply and install new kitchen mixer tap",
        status: "sent" as const,
        subtotal: "280.00",
        gstAmount: "28.00", 
        total: "308.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        sentAt: new Date()
      });

      // Add line items to quote
      await storage.createQuoteLineItem({
        quoteId: demoQuote.id,
        description: "Premium Kitchen Mixer Tap",
        quantity: "1.00",
        unitPrice: "180.00",
        total: "180.00",
        sortOrder: 1
      });

      await storage.createQuoteLineItem({
        quoteId: demoQuote.id,
        description: "Installation Labour (1 hour)",
        quantity: "1.00", 
        unitPrice: "120.00",
        total: "120.00",
        sortOrder: 2
      });

      console.log('✅ Demo quote created');

      // Create demo invoice (linked to Hot Water System Service - index 5)
      const invoiceNumber = await storage.generateInvoiceNumber(demoUser.id);
      const demoInvoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        jobId: createdJobs[5].id,
        number: invoiceNumber,
        title: "Hot Water System Service",
        description: "Annual service and maintenance completed",
        status: "sent" as const,
        subtotal: "150.00",
        gstAmount: "15.00",
        total: "165.00",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date()
      });

      await storage.createInvoiceLineItem({
        invoiceId: demoInvoice.id,
        description: "Hot Water System Service",
        quantity: "1.00",
        unitPrice: "150.00", 
        total: "150.00",
        sortOrder: 1
      });

      console.log('✅ Demo invoice created');

      // ============================================
      // CREATE COMPLETE DOCUMENT CHAIN FOR TESTING
      // Quote → Job → Invoice → Receipt workflow
      // ============================================
      
      // 1. Create a COMPLETED job for the full chain
      const completedChainJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[0].id, // Sarah Johnson
        title: "Complete Bathroom Plumbing Upgrade",
        description: "Full bathroom renovation including new fixtures, pipes, and water heater installation",
        address: createdClients[0].address || "15 Oak Street, Cairns QLD 4870",
        status: "invoiced" as const,
        scheduledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
        startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Started 2 weeks ago
        completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // Finished 12 days ago
        notes: "Full bathroom upgrade completed successfully - customer very happy"
      });
      console.log('✅ Chain job created:', completedChainJob.id);

      // 2. Create an ACCEPTED quote linked to this job
      const chainQuoteNumber = await storage.generateQuoteNumber(demoUser.id);
      const chainQuote = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        jobId: completedChainJob.id,
        number: chainQuoteNumber,
        title: "Bathroom Plumbing Upgrade Quote",
        description: "Complete bathroom renovation plumbing works",
        status: "accepted" as const,
        subtotal: "2450.00",
        gstAmount: "245.00",
        total: "2695.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // Sent 3 weeks ago
        acceptedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // Accepted 18 days ago
        acceptedBy: "Sarah Johnson"
      });

      // Add line items to the chain quote
      await storage.createQuoteLineItem({
        quoteId: chainQuote.id,
        description: "New Toilet Suite (Caroma Smart Dual Flush)",
        quantity: "1.00",
        unitPrice: "650.00",
        total: "650.00",
        sortOrder: 1
      });

      await storage.createQuoteLineItem({
        quoteId: chainQuote.id,
        description: "Basin and Vanity Unit",
        quantity: "1.00",
        unitPrice: "450.00",
        total: "450.00",
        sortOrder: 2
      });

      await storage.createQuoteLineItem({
        quoteId: chainQuote.id,
        description: "Mixer Tap Set (Chrome)",
        quantity: "2.00",
        unitPrice: "180.00",
        total: "360.00",
        sortOrder: 3
      });

      await storage.createQuoteLineItem({
        quoteId: chainQuote.id,
        description: "Copper Pipe and Fittings",
        quantity: "1.00",
        unitPrice: "280.00",
        total: "280.00",
        sortOrder: 4
      });

      await storage.createQuoteLineItem({
        quoteId: chainQuote.id,
        description: "Installation Labour (6 hours @ $120/hr)",
        quantity: "6.00",
        unitPrice: "120.00",
        total: "720.00",
        sortOrder: 5
      });

      console.log('✅ Chain quote created (ACCEPTED):', chainQuote.number);

      // 3. Create a PAID invoice linked to the quote and job
      const chainInvoiceNumber = await storage.generateInvoiceNumber(demoUser.id);
      const chainInvoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        jobId: completedChainJob.id,
        quoteId: chainQuote.id, // Links back to the quote!
        number: chainInvoiceNumber,
        title: "Bathroom Plumbing Upgrade - Final Invoice",
        description: "Complete bathroom renovation plumbing works as per accepted quote",
        status: "paid" as const,
        subtotal: "2450.00",
        gstAmount: "245.00",
        total: "2695.00",
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Due 7 days ago
        sentAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // Sent when job completed
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // Paid 5 days ago
      });

      // Add line items to the chain invoice (same as quote)
      await storage.createInvoiceLineItem({
        invoiceId: chainInvoice.id,
        description: "New Toilet Suite (Caroma Smart Dual Flush)",
        quantity: "1.00",
        unitPrice: "650.00",
        total: "650.00",
        sortOrder: 1
      });

      await storage.createInvoiceLineItem({
        invoiceId: chainInvoice.id,
        description: "Basin and Vanity Unit",
        quantity: "1.00",
        unitPrice: "450.00",
        total: "450.00",
        sortOrder: 2
      });

      await storage.createInvoiceLineItem({
        invoiceId: chainInvoice.id,
        description: "Mixer Tap Set (Chrome)",
        quantity: "2.00",
        unitPrice: "180.00",
        total: "360.00",
        sortOrder: 3
      });

      await storage.createInvoiceLineItem({
        invoiceId: chainInvoice.id,
        description: "Copper Pipe and Fittings",
        quantity: "1.00",
        unitPrice: "280.00",
        total: "280.00",
        sortOrder: 4
      });

      await storage.createInvoiceLineItem({
        invoiceId: chainInvoice.id,
        description: "Installation Labour (6 hours @ $120/hr)",
        quantity: "6.00",
        unitPrice: "120.00",
        total: "720.00",
        sortOrder: 5
      });

      console.log('✅ Chain invoice created (PAID):', chainInvoice.number);

      // 4. Create a receipt linked to the invoice
      const chainReceipt = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: chainInvoice.id, // Links back to the invoice!
        jobId: completedChainJob.id,
        clientId: createdClients[0].id,
        receiptNumber: `REC-CHAIN-${Date.now().toString().slice(-6)}`,
        amount: "2695.00",
        gstAmount: "245.00",
        subtotal: "2450.00",
        description: "Payment for bathroom plumbing upgrade",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // Same as invoice paidAt
      });

      console.log('✅ Chain receipt created:', chainReceipt.receiptNumber);
      console.log('✅ COMPLETE DOCUMENT CHAIN CREATED:');
      console.log(`   Quote ${chainQuote.number} → Invoice ${chainInvoice.number} → Receipt ${chainReceipt.receiptNumber}`);
      console.log(`   Job: ${completedChainJob.title}`);
    
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

export { DEMO_USER };