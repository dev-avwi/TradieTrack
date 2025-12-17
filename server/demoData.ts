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
      console.log('✅ Demo user already exists:', DEMO_USER.email);
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
        brandColor: "#2563eb"
      });
      console.log('✅ Demo business settings created');
    }

    // Check if demo user has clients
    const existingClients = await storage.getClients(demoUser.id);
    if (existingClients.length === 0) {
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

      // Create demo jobs
      const demoJobs = [
        {
          userId: demoUser.id,
          clientId: createdClients[0].id,
          title: "Kitchen Tap Replacement",
          description: "Replace old kitchen tap with new mixer tap",
          address: createdClients[0].address || "",
          status: "pending" as const,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          notes: "Customer prefers morning appointment"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[1].id,
          title: "Bathroom Leak Repair",
          description: "Fix leak under bathroom sink",
          address: createdClients[1].address || "",
          status: "in_progress" as const,
          scheduledAt: new Date(), // Today
          notes: "Emergency job - water damage prevention"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Hot Water System Service",
          description: "Annual service and maintenance",
          address: createdClients[2].address || "",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          notes: "System in good condition - no issues found"
        }
      ];

      const createdJobs = [];
      for (const jobData of demoJobs) {
        const job = await storage.createJob(jobData);
        createdJobs.push(job);
      }
      console.log('✅ Demo jobs created:', createdJobs.length);

      // Create demo quote
      const quoteNumber = await storage.generateQuoteNumber(demoUser.id);
      const demoQuote = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[0].id,
        jobId: createdJobs[0].id,
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

      // Create demo invoice
      const invoiceNumber = await storage.generateInvoiceNumber(demoUser.id);
      const demoInvoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[2].id,
        jobId: createdJobs[2].id,
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
    }
    
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