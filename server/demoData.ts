import { storage, db } from './storage';
import { AuthService } from './auth';
import { teamMemberSkills, WORKER_PERMISSIONS } from '@shared/schema';

// Helper function to get today's date at a specific time
function getTodayAt(hours: number, minutes: number): Date {
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  return today;
}

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
      // Verify email for new demo user (NOT platform admin - that's only for admin@avwebinnovation.com)
      if (demoUser) {
        await storage.updateUser(demoUser.id, { 
          isPlatformAdmin: false,
          emailVerified: true,
        });
        demoUser = await storage.getUserByEmail(DEMO_USER.email);
      }
      console.log('✅ Demo user created as business owner:', DEMO_USER.email);
    } else {
      // Demo user exists - ensure password is correct (NOT platform admin - that's only for admin@avwebinnovation.com)
      const hashedPassword = await AuthService.hashPassword(DEMO_USER.password);
      await storage.updateUser(demoUser.id, { 
        password: hashedPassword,
        emailVerified: true,
        isPlatformAdmin: false, // Business owner, NOT platform admin
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

    // Create demo clients - expanded list for realistic testing (16 clients for variety)
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
        },
        {
          userId: demoUser.id,
          name: "Greg Patterson",
          email: "greg.p@outlook.com.au",
          phone: "(07) 4777 8899",
          address: "67 Esplanade Way, Yorkeys Knob QLD 4878",
          notes: "Beachfront property - salt corrosion issues"
        },
        {
          userId: demoUser.id,
          name: "Wendy Chang",
          email: "wendy.chang@gmail.com",
          phone: "(07) 4888 2211",
          address: "14 Tropical Court, Kewarra Beach QLD 4879",
          notes: "Holiday rental owner - quick turnarounds needed"
        },
        {
          userId: demoUser.id,
          name: "Steve Morrison",
          email: "steve.m@email.com.au",
          phone: "(07) 4999 3322",
          address: "28 Mountain View Rd, Redlynch QLD 4870",
          notes: "New home build in progress"
        },
        {
          userId: demoUser.id,
          name: "Catherine Murray",
          email: "cmurray@bigpond.net.au",
          phone: "(07) 4111 4455",
          address: "3 Rainforest Crescent, Freshwater QLD 4870",
          notes: "Elderly customer - requires morning appointments"
        },
        {
          userId: demoUser.id,
          name: "Tom Benson",
          email: "tbenson@tradiemail.com.au",
          phone: "(07) 4222 6677",
          address: "55 Cane Road, Gordonvale QLD 4865",
          notes: "Sugarcane farmer - rural property"
        },
        {
          userId: demoUser.id,
          name: "Angela White",
          email: "angela.w@icloud.com",
          phone: "(07) 4333 7788",
          address: "19 Lake Street, Cairns City QLD 4870",
          notes: "Apartment complex body corporate contact"
        },
        {
          userId: demoUser.id,
          name: "Paul Davidson",
          email: "paul.davidson@email.com",
          phone: "(07) 4444 8899",
          address: "42 Captain Cook Highway, Clifton Beach QLD 4879",
          notes: "Cafe owner - commercial kitchen work"
        },
        // Additional clients for expanded demo data (24 more)
        {
          userId: demoUser.id,
          name: "Karen Mitchell",
          email: "karen.m@gmail.com",
          phone: "(07) 4555 0011",
          address: "7 Marlin Drive, Cairns North QLD 4870",
          notes: "Regular customer - annual maintenance"
        },
        {
          userId: demoUser.id,
          name: "Bruce Campbell",
          email: "bruce.campbell@outlook.com",
          phone: "(07) 4666 2233",
          address: "23 Barramundi Street, Portsmith QLD 4870",
          notes: "Industrial property - factory plumbing"
        },
        {
          userId: demoUser.id,
          name: "Sophie Turner",
          email: "sophie.t@icloud.com",
          phone: "(07) 4777 3344",
          address: "89 Barrier Reef Drive, Manoora QLD 4870",
          notes: "Renovating heritage home - careful work required"
        },
        {
          userId: demoUser.id,
          name: "James O'Connor",
          email: "james.oconnor@bigpond.com",
          phone: "(07) 4888 4455",
          address: "16 Sugar Mill Road, Edmonton QLD 4869",
          notes: "Retired plumber - knows what he wants"
        },
        {
          userId: demoUser.id,
          name: "Priya Sharma",
          email: "priya.sharma@email.com",
          phone: "(07) 4999 5566",
          address: "44 Lotus Court, Brinsmead QLD 4870",
          notes: "Prefers email communication"
        },
        {
          userId: demoUser.id,
          name: "William Foster",
          email: "will.foster@yahoo.com.au",
          phone: "(07) 4111 6677",
          address: "31 Crocodile Crescent, Bentley Park QLD 4869",
          notes: "Builder - subcontract work available"
        },
        {
          userId: demoUser.id,
          name: "Michelle Lee",
          email: "michelle.lee@gmail.com",
          phone: "(07) 4222 7788",
          address: "52 Palm Street, Mooroobool QLD 4870",
          notes: "Landlord with 5 rental properties"
        },
        {
          userId: demoUser.id,
          name: "Daniel Brown",
          email: "dan.brown@tradiemail.com.au",
          phone: "(07) 4333 8899",
          address: "8 Cassowary Close, Kanimbla QLD 4870",
          notes: "Commercial property investor"
        },
        {
          userId: demoUser.id,
          name: "Rachel Green",
          email: "rachel.g@outlook.com.au",
          phone: "(07) 4444 9900",
          address: "77 Dugong Drive, Woree QLD 4868",
          notes: "Daycare centre manager - after hours work only"
        },
        {
          userId: demoUser.id,
          name: "Andrew Kelly",
          email: "andrew.kelly@email.com",
          phone: "(07) 4555 0022",
          address: "19 Reef Close, Earlville QLD 4870",
          notes: "Restaurant owner - multiple venues"
        },
        {
          userId: demoUser.id,
          name: "Christina Nguyen",
          email: "christina.n@icloud.com",
          phone: "(07) 4666 1133",
          address: "35 Rainforest Way, Bayview Heights QLD 4868",
          notes: "New build project manager"
        },
        {
          userId: demoUser.id,
          name: "Peter MacDonald",
          email: "peter.mac@bigpond.net.au",
          phone: "(07) 4777 2244",
          address: "62 Coral Sea Boulevard, Stratford QLD 4870",
          notes: "Strata manager for 3 complexes"
        },
        {
          userId: demoUser.id,
          name: "Susan Williams",
          email: "susan.w@gmail.com",
          phone: "(07) 4888 3355",
          address: "41 Mangrove Circuit, Machans Beach QLD 4878",
          notes: "Elderly pensioner - needs patience"
        },
        {
          userId: demoUser.id,
          name: "Tony Rizzo",
          email: "tony.rizzo@email.com.au",
          phone: "(07) 4999 4466",
          address: "28 Olive Lane, Parramatta Park QLD 4870",
          notes: "Italian restaurant - commercial kitchen"
        },
        {
          userId: demoUser.id,
          name: "Helen Andrews",
          email: "helen.a@yahoo.com.au",
          phone: "(07) 4111 5577",
          address: "15 Pandanus Street, Holloways Beach QLD 4878",
          notes: "Beachfront unit - cyclone season prep needed"
        },
        {
          userId: demoUser.id,
          name: "Mark Thompson",
          email: "mark.t@outlook.com",
          phone: "(07) 4222 6688",
          address: "73 Cane Toad Close, White Rock QLD 4868",
          notes: "Builder referral from William Foster"
        },
        {
          userId: demoUser.id,
          name: "Jessica Liu",
          email: "jessica.liu@gmail.com",
          phone: "(07) 4333 7799",
          address: "9 Fern Tree Court, Caravonica QLD 4878",
          notes: "Airbnb host - quick turnarounds"
        },
        {
          userId: demoUser.id,
          name: "Craig Patterson",
          email: "craig.p@tradiemail.com.au",
          phone: "(07) 4444 8800",
          address: "56 Tuna Terrace, Yorkeys Knob QLD 4878",
          notes: "Fishing boat captain - flexible schedule"
        },
        {
          userId: demoUser.id,
          name: "Amanda Cole",
          email: "amanda.cole@icloud.com",
          phone: "(07) 4555 9911",
          address: "22 Paradise Parade, Port Douglas QLD 4877",
          notes: "Luxury resort manager"
        },
        {
          userId: demoUser.id,
          name: "Gary Hughes",
          email: "gary.hughes@bigpond.com",
          phone: "(07) 4666 0022",
          address: "38 Pioneer Street, Cairns City QLD 4870",
          notes: "Commercial building owner - CBD"
        },
        {
          userId: demoUser.id,
          name: "Natalie Wood",
          email: "natalie.w@email.com",
          phone: "(07) 4777 1133",
          address: "64 Barrier Reef Boulevard, Trinity Beach QLD 4879",
          notes: "Medical centre manager"
        },
        {
          userId: demoUser.id,
          name: "Simon Clarke",
          email: "simon.c@outlook.com.au",
          phone: "(07) 4888 2244",
          address: "11 Saltwater Close, Kewarra Beach QLD 4879",
          notes: "Property developer - ongoing work"
        },
        {
          userId: demoUser.id,
          name: "Linda Martinez",
          email: "linda.m@gmail.com",
          phone: "(07) 4999 3355",
          address: "47 Sunset Boulevard, Palm Cove QLD 4879",
          notes: "Hotel owner - 24hr emergency contact"
        },
        {
          userId: demoUser.id,
          name: "Robert Yang",
          email: "robert.yang@email.com.au",
          phone: "(07) 4111 4466",
          address: "33 Ocean View Drive, Clifton Beach QLD 4879",
          notes: "New customer - referred by Google"
        }
      ];

      const createdClients = [];
      for (const clientData of demoClients) {
        const client = await storage.createClient(clientData);
        createdClients.push(client);
      }
      console.log('✅ Demo clients created:', createdClients.length);

      // Look up demo worker for job assignments (Jake Morrison)
      const demoWorkerUser = await storage.getUserByEmail(DEMO_WORKER.email);
      const demoWorkerId = demoWorkerUser?.id || null;
      if (demoWorkerId) {
        console.log('✅ Found demo worker for job assignments:', DEMO_WORKER.email);
      }

      // Create demo jobs with varied statuses and dates to show urgency badges
      // Cairns QLD coordinates: -16.92, 145.77
      // 19 jobs total: 4 pending, 5 scheduled, 3 in_progress, 4 done, 3 invoiced
      const now = new Date();
      const demoJobs = [
        // ============================================
        // PENDING JOBS (4) - waiting for quote acceptance or scheduling
        // ============================================
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Pool Pump Installation",
          description: "Install new pool pump and filter system",
          address: createdClients[2].address || "",
          latitude: "-16.5000",
          longitude: "145.4800",
          status: "pending" as const,
          scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          notes: "Awaiting quote approval"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[9].id,
          title: "Pipe Corrosion Assessment",
          description: "Assess salt corrosion damage on beachfront property pipes",
          address: createdClients[9].address || "",
          latitude: "-16.8120",
          longitude: "145.7200",
          status: "pending" as const,
          notes: "Customer requested quote first - salt damage suspected"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[11].id,
          title: "New Build Plumbing Quote",
          description: "Complete rough-in plumbing for new 4-bedroom home",
          address: createdClients[11].address || "",
          latitude: "-16.8650",
          longitude: "145.6950",
          status: "pending" as const,
          notes: "Builder contact: Steve Morrison. Large job - needs site visit."
        },
        {
          userId: demoUser.id,
          clientId: createdClients[15].id,
          title: "Commercial Kitchen Grease Trap",
          description: "Install new grease trap for cafe kitchen - council requirement",
          address: createdClients[15].address || "",
          latitude: "-16.7950",
          longitude: "145.7100",
          status: "pending" as const,
          notes: "Council compliance deadline in 2 weeks"
        },

        // ============================================
        // SCHEDULED JOBS FOR TODAY (6) - For AI Schedule Optimizer testing
        // All scheduled for today at different times, spread across Cairns area
        // estimatedDuration is in MINUTES (integer)
        // ============================================
        {
          userId: demoUser.id,
          clientId: createdClients[0].id,
          title: "Morning Hot Water Service",
          description: "Service and flush hot water system",
          address: createdClients[0].address || "",
          latitude: "-16.9186",
          longitude: "145.7781",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(8, 0), // 8:00 AM today
          estimatedDuration: 90, // 1.5 hours in minutes
          notes: "Annual service - customer home all day"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[1].id,
          title: "Gas Line Inspection",
          description: "Annual gas safety check and compliance certificate",
          address: createdClients[1].address || "",
          latitude: "-16.7889",
          longitude: "145.6967",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(9, 30), // 9:30 AM today
          estimatedDuration: 60, // 1 hour in minutes
          notes: "Need gas certificate for landlord"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Kitchen Tap Replacement",
          description: "Replace old kitchen tap with new mixer tap",
          address: createdClients[2].address || "",
          latitude: "-16.4827",
          longitude: "145.4635",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(11, 0), // 11:00 AM today
          estimatedDuration: 60, // 1 hour in minutes
          notes: "Customer prefers morning - has lunch appointment"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[4].id,
          title: "Blocked Toilet Repair",
          description: "Clear blockage and check sewer line",
          address: createdClients[4].address || "",
          latitude: "-16.7950",
          longitude: "145.7000",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(13, 0), // 1:00 PM today
          estimatedDuration: 90, // 1.5 hours in minutes
          notes: "Urgent - only one bathroom in house"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[5].id,
          title: "Leaking Shower Repair",
          description: "Fix shower mixer valve and replace seals",
          address: createdClients[5].address || "",
          latitude: "-16.8650",
          longitude: "145.6950",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(14, 30), // 2:30 PM today
          estimatedDuration: 60, // 1 hour in minutes
          notes: "Access from front - side gate locked"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[6].id,
          title: "Water Pressure Check",
          description: "Diagnose low water pressure issue",
          address: createdClients[6].address || "",
          latitude: "-16.8200",
          longitude: "145.7350",
          status: "scheduled" as const,
          scheduledAt: getTodayAt(16, 0), // 4:00 PM today
          estimatedDuration: 60, // 1 hour in minutes
          notes: "Customer works from home - flexible timing"
        },

        // ============================================
        // SCHEDULED JOBS FOR FUTURE (3) - tomorrow and beyond
        // ============================================
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
        {
          userId: demoUser.id,
          clientId: createdClients[10].id,
          title: "Holiday Rental Turnover",
          description: "Quick bathroom check and minor repairs between guests",
          address: createdClients[10].address || "",
          latitude: "-16.7830",
          longitude: "145.6890",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          assignedTo: demoWorkerId, // Assigned to Jake Morrison
          notes: "Guest checking in at 2pm - must be done by noon"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[7].id,
          title: "Commercial Kitchen Inspection",
          description: "Full plumbing inspection for restaurant",
          address: createdClients[7].address || "",
          latitude: "-16.8450",
          longitude: "145.7280",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          notes: "After hours only - restaurant closes at 10pm"
        },

        // ============================================
        // IN PROGRESS JOBS (3) - active jobs to test timer banner
        // ============================================
        {
          userId: demoUser.id,
          clientId: createdClients[1].id,
          title: "Bathroom Leak Repair",
          description: "Fix leak under bathroom sink",
          address: createdClients[1].address || "",
          latitude: "-16.7950",
          longitude: "145.7000",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 mins ago
          notes: "Emergency job - water damage prevention"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[3].id,
          title: "Unit Complex Maintenance",
          description: "Replace water heaters in units 3 and 7",
          address: createdClients[3].address || "",
          latitude: "-16.7860",
          longitude: "145.6940",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Started 2 hours ago
          assignedTo: demoWorkerId, // Assigned to Jake Morrison
          notes: "Property manager Marcus on site. Two units to complete."
        },
        {
          userId: demoUser.id,
          clientId: createdClients[7].id,
          title: "Restaurant Dishwasher Connection",
          description: "Install commercial dishwasher water lines",
          address: createdClients[7].address || "",
          latitude: "-16.8200",
          longitude: "145.7350",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 45 * 60 * 1000), // Started 45 mins ago
          notes: "Commercial kitchen - after hours work. Restaurant closed Mondays."
        },

        // ============================================
        // DONE JOBS (4) - completed, ready for invoicing
        // ============================================
        {
          userId: demoUser.id,
          clientId: createdClients[2].id,
          title: "Hot Water System Service",
          description: "Annual service and maintenance",
          address: createdClients[2].address || "",
          latitude: "-16.4900",
          longitude: "145.4700",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "System in good condition - no issues found"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[4].id,
          title: "Leaking Shower Head Fix",
          description: "Replace washer and cartridge in shower mixer",
          address: createdClients[4].address || "",
          latitude: "-16.9100",
          longitude: "145.7600",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
          notes: "Quick fix - customer very happy with prompt service"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[12].id,
          title: "Toilet Replacement",
          description: "Replace old single-flush with new dual-flush toilet",
          address: createdClients[12].address || "",
          latitude: "-16.8750",
          longitude: "145.7150",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000),
          notes: "Elderly customer - explained how dual flush works"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[13].id,
          title: "Rural Bore Pump Service",
          description: "Annual service and pressure test on bore pump",
          address: createdClients[13].address || "",
          latitude: "-17.0800",
          longitude: "145.7850",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          notes: "Long drive out to Gordonvale. Pump running well."
        },

        // ============================================
        // INVOICED JOBS (3) - completed and invoiced
        // ============================================
        {
          userId: demoUser.id,
          clientId: createdClients[5].id,
          title: "Pool Filter Replacement",
          description: "Replace pool filter cartridge and service pump",
          address: createdClients[5].address || "",
          latitude: "-16.8950",
          longitude: "145.7450",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "Invoice sent - awaiting payment"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[6].id,
          title: "Rough-In Plumbing Stage 1",
          description: "First fix plumbing for new build bathroom and kitchen",
          address: createdClients[6].address || "",
          latitude: "-16.8350",
          longitude: "145.6850",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          notes: "Builder payment - 50% deposit received, awaiting final"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[8].id,
          title: "Rental Property Maintenance",
          description: "Fix kitchen tap, bathroom sink drain, toilet cistern",
          address: createdClients[8].address || "",
          latitude: "-16.8450",
          longitude: "145.7280",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
          notes: "Invoice paid - excellent property manager"
        },

        // ============================================
        // ADDITIONAL JOBS (57 more for expanded demo data)
        // Mix of pending, scheduled, in_progress, done, invoiced
        // ============================================

        // PENDING JOBS (10 more)
        {
          userId: demoUser.id,
          clientId: createdClients[16].id,
          title: "Annual Hot Water Service",
          description: "Regular maintenance and anode check on electric hot water system",
          address: createdClients[16].address || "",
          latitude: "-16.9050",
          longitude: "145.7680",
          status: "pending" as const,
          notes: "Customer prefers morning appointments"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[17].id,
          title: "Factory Bathroom Renovation",
          description: "Complete renovation of staff amenities - 4 toilets, 3 showers",
          address: createdClients[17].address || "",
          latitude: "-16.9380",
          longitude: "145.7520",
          status: "pending" as const,
          notes: "Large commercial job - needs site inspection"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[18].id,
          title: "Heritage Home Pipe Replacement",
          description: "Replace galvanized pipes with copper throughout heritage home",
          address: createdClients[18].address || "",
          latitude: "-16.8920",
          longitude: "145.7650",
          status: "pending" as const,
          notes: "Heritage listed - careful work required"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[20].id,
          title: "Bathroom Vanity Installation",
          description: "Install new double vanity with matching tapware",
          address: createdClients[20].address || "",
          latitude: "-16.8750",
          longitude: "145.7200",
          status: "pending" as const,
          notes: "Customer supplying vanity - we supply tapware"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[22].id,
          title: "Multi-Unit Hot Water Quote",
          description: "Quote for replacing 5 hot water systems in rental properties",
          address: createdClients[22].address || "",
          latitude: "-16.8680",
          longitude: "145.7350",
          status: "pending" as const,
          notes: "Landlord wants energy efficient options"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[24].id,
          title: "Daycare Centre Compliance",
          description: "Install backflow prevention and drinking fountain for daycare",
          address: createdClients[24].address || "",
          latitude: "-16.9420",
          longitude: "145.7480",
          status: "pending" as const,
          notes: "Must meet childcare regulations"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[26].id,
          title: "New Build Bathroom Rough-In",
          description: "Rough-in plumbing for master ensuite and main bathroom",
          address: createdClients[26].address || "",
          latitude: "-16.8550",
          longitude: "145.6980",
          status: "pending" as const,
          notes: "Working with builder - tight timeline"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[27].id,
          title: "Strata Complex Pipe Assessment",
          description: "Assess common area plumbing in 12-unit complex",
          address: createdClients[27].address || "",
          latitude: "-16.8920",
          longitude: "145.7580",
          status: "pending" as const,
          notes: "Body corporate approval required"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[29].id,
          title: "Commercial Kitchen Fit-Out",
          description: "Complete plumbing fit-out for new Italian restaurant",
          address: createdClients[29].address || "",
          latitude: "-16.9180",
          longitude: "145.7750",
          status: "pending" as const,
          notes: "Council approval pending"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[31].id,
          title: "Heritage Building Water Main",
          description: "Replace water main to heritage building in CBD",
          address: createdClients[31].address || "",
          latitude: "-16.9200",
          longitude: "145.7700",
          status: "pending" as const,
          notes: "Road permit required"
        },

        // SCHEDULED JOBS (15 more)
        {
          userId: demoUser.id,
          clientId: createdClients[16].id,
          title: "Blocked Kitchen Drain",
          description: "Clear blocked kitchen drain and check trap",
          address: createdClients[16].address || "",
          latitude: "-16.9050",
          longitude: "145.7680",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          estimatedDuration: 60,
          notes: "Standard drain clearing"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[19].id,
          title: "Tap Replacement",
          description: "Replace kitchen mixer tap - customer supplied",
          address: createdClients[19].address || "",
          latitude: "-16.9450",
          longitude: "145.7380",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          estimatedDuration: 45,
          notes: "Customer has already purchased tap"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[21].id,
          title: "Gas Appliance Service",
          description: "Annual gas heater and cooktop service",
          address: createdClients[21].address || "",
          latitude: "-16.8850",
          longitude: "145.7150",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          estimatedDuration: 90,
          notes: "Issue gas compliance certificate"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[23].id,
          title: "Toilet Cistern Repair",
          description: "Fix running toilet - replace cistern internals",
          address: createdClients[23].address || "",
          latitude: "-16.8780",
          longitude: "145.7420",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedDuration: 45,
          assignedTo: demoWorkerId,
          notes: "Quick job - elderly customer"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[25].id,
          title: "Restaurant Grease Trap",
          description: "Install new grease trap for restaurant expansion",
          address: createdClients[25].address || "",
          latitude: "-16.8980",
          longitude: "145.7620",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          estimatedDuration: 240,
          notes: "Large commercial job - all day"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[28].id,
          title: "Elderly Home Safety Bars",
          description: "Install grab rails in bathroom and toilet",
          address: createdClients[28].address || "",
          latitude: "-16.8420",
          longitude: "145.7280",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
          estimatedDuration: 120,
          notes: "NDIS funded - need invoice for claim"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[30].id,
          title: "Unit Cyclone Prep",
          description: "Check all taps, pipes and connections before cyclone season",
          address: createdClients[30].address || "",
          latitude: "-16.8380",
          longitude: "145.7220",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          estimatedDuration: 90,
          notes: "Beachfront property - salt corrosion check"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[32].id,
          title: "New Home Fit-Out",
          description: "Complete fit-out plumbing for new 3-bed home",
          address: createdClients[32].address || "",
          latitude: "-16.8580",
          longitude: "145.6950",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
          estimatedDuration: 480,
          notes: "Builder coordination - week long job"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[33].id,
          title: "Airbnb Quick Turnaround",
          description: "Fix leaking shower and replace toilet seat",
          address: createdClients[33].address || "",
          latitude: "-16.8650",
          longitude: "145.7080",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          estimatedDuration: 60,
          notes: "Guest arriving 3pm - must be done by 2pm"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[34].id,
          title: "Boat Moorings Water Line",
          description: "Install water line to new boat mooring",
          address: createdClients[34].address || "",
          latitude: "-16.8120",
          longitude: "145.7150",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
          estimatedDuration: 180,
          notes: "Marine grade fittings required"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[35].id,
          title: "Resort Pool Plumbing",
          description: "Repair main pool pump and check filtration system",
          address: createdClients[35].address || "",
          latitude: "-16.4850",
          longitude: "145.4650",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
          estimatedDuration: 240,
          notes: "Port Douglas - early start for travel"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[36].id,
          title: "Office Building Maintenance",
          description: "Quarterly plumbing inspection and minor repairs",
          address: createdClients[36].address || "",
          latitude: "-16.9220",
          longitude: "145.7720",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          estimatedDuration: 180,
          notes: "Commercial building - after hours preferred"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[37].id,
          title: "Medical Centre Backflow",
          description: "Annual backflow prevention test and certification",
          address: createdClients[37].address || "",
          latitude: "-16.7920",
          longitude: "145.6980",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          estimatedDuration: 90,
          notes: "Council compliance - certificate required"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[38].id,
          title: "Development Site Inspection",
          description: "Pre-construction plumbing assessment for new units",
          address: createdClients[38].address || "",
          latitude: "-16.7850",
          longitude: "145.6920",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
          estimatedDuration: 120,
          notes: "Large development - ongoing work potential"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[39].id,
          title: "Hotel Emergency Line",
          description: "Install dedicated emergency water shut-off",
          address: createdClients[39].address || "",
          latitude: "-16.7580",
          longitude: "145.6720",
          status: "scheduled" as const,
          scheduledAt: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
          estimatedDuration: 150,
          notes: "24hr property - work around guests"
        },

        // IN PROGRESS JOBS (5 more)
        {
          userId: demoUser.id,
          clientId: createdClients[17].id,
          title: "Factory Toilet Block",
          description: "Renovating staff toilet block - day 2 of 3",
          address: createdClients[17].address || "",
          latitude: "-16.9380",
          longitude: "145.7520",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
          notes: "Multi-day job - good progress"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[21].id,
          title: "Builder New Home Plumbing",
          description: "First fix plumbing for new construction",
          address: createdClients[21].address || "",
          latitude: "-16.8850",
          longitude: "145.7150",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          assignedTo: demoWorkerId,
          notes: "Large new build - Jake handling"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[23].id,
          title: "Emergency Burst Pipe",
          description: "Emergency call-out for burst copper pipe in ceiling",
          address: createdClients[23].address || "",
          latitude: "-16.8780",
          longitude: "145.7420",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          notes: "Water damage - plumber on site"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[27].id,
          title: "Strata Common Area",
          description: "Replacing shared hot water system for units 1-6",
          address: createdClients[27].address || "",
          latitude: "-16.8920",
          longitude: "145.7580",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          notes: "Large job - body corporate approved"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[29].id,
          title: "Restaurant Dishwasher Install",
          description: "Installing commercial dishwasher with grease trap connection",
          address: createdClients[29].address || "",
          latitude: "-16.9180",
          longitude: "145.7750",
          status: "in_progress" as const,
          scheduledAt: new Date(),
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          notes: "Commercial kitchen - after hours work"
        },

        // DONE JOBS (15 more)
        {
          userId: demoUser.id,
          clientId: createdClients[16].id,
          title: "Laundry Tap Repair",
          description: "Fixed dripping laundry tap - replaced washer and seat",
          address: createdClients[16].address || "",
          latitude: "-16.9050",
          longitude: "145.7680",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          notes: "Quick job - customer very happy"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[18].id,
          title: "Bathroom Vanity Install",
          description: "Installed new vanity basin and tapware",
          address: createdClients[18].address || "",
          latitude: "-16.8920",
          longitude: "145.7650",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "Heritage home - careful work required"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[19].id,
          title: "Gas Cooktop Connection",
          description: "Connected new gas cooktop with compliance certificate",
          address: createdClients[19].address || "",
          latitude: "-16.9450",
          longitude: "145.7380",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000),
          notes: "Gas certificate issued"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[20].id,
          title: "Shower Screen Leak",
          description: "Resealed shower screen and fixed drain issue",
          address: createdClients[20].address || "",
          latitude: "-16.8750",
          longitude: "145.7200",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
          notes: "Water damage prevented"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[22].id,
          title: "Hot Water System Replace",
          description: "Replaced failed electric hot water with heat pump",
          address: createdClients[22].address || "",
          latitude: "-16.8680",
          longitude: "145.7350",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
          notes: "Customer happy with energy savings"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[24].id,
          title: "Blocked Sewer Line",
          description: "Cleared blocked sewer line with CCTV inspection",
          address: createdClients[24].address || "",
          latitude: "-16.9420",
          longitude: "145.7480",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "Root intrusion found - recommend annual clearing"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[25].id,
          title: "Restaurant Emergency",
          description: "Fixed burst hot water line during service",
          address: createdClients[25].address || "",
          latitude: "-16.8980",
          longitude: "145.7620",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
          notes: "Emergency call-out - after hours"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[26].id,
          title: "New Build Final Fix",
          description: "Final fix plumbing - toilets, taps, and connections",
          address: createdClients[26].address || "",
          latitude: "-16.8550",
          longitude: "145.6980",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
          notes: "Multi-day job completed"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[28].id,
          title: "Tap Replacement Set",
          description: "Replaced all bathroom and kitchen taps",
          address: createdClients[28].address || "",
          latitude: "-16.8420",
          longitude: "145.7280",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          notes: "Elderly customer - explained all new fixtures"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[30].id,
          title: "Annual Maintenance",
          description: "Annual plumbing inspection and minor repairs",
          address: createdClients[30].address || "",
          latitude: "-16.8380",
          longitude: "145.7220",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "Regular maintenance contract"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[31].id,
          title: "CBD Office Repairs",
          description: "Fixed multiple running toilets and leaking taps",
          address: createdClients[31].address || "",
          latitude: "-16.9200",
          longitude: "145.7700",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          notes: "After hours work - building manager happy"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[33].id,
          title: "Airbnb Turnaround",
          description: "Fixed blocked drain and toilet before guest arrival",
          address: createdClients[33].address || "",
          latitude: "-16.8650",
          longitude: "145.7080",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
          notes: "Quick turnaround for Airbnb host"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[35].id,
          title: "Resort Spa Repairs",
          description: "Fixed spa jets and replumbed circulation system",
          address: createdClients[35].address || "",
          latitude: "-16.4850",
          longitude: "145.4650",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
          notes: "Port Douglas resort - long travel"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[37].id,
          title: "Medical Centre Sink",
          description: "Installed new handwash sink in treatment room",
          address: createdClients[37].address || "",
          latitude: "-16.7920",
          longitude: "145.6980",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          notes: "Healthcare standard installation"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[39].id,
          title: "Hotel Room Batch",
          description: "Fixed plumbing issues in 6 hotel rooms",
          address: createdClients[39].address || "",
          latitude: "-16.7580",
          longitude: "145.6720",
          status: "done" as const,
          scheduledAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
          notes: "Multi-day hotel job"
        },

        // INVOICED JOBS (12 more)
        {
          userId: demoUser.id,
          clientId: createdClients[16].id,
          title: "Toilet Suite Installation",
          description: "Installed new wall-hung toilet suite",
          address: createdClients[16].address || "",
          latitude: "-16.9050",
          longitude: "145.7680",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          notes: "Invoice sent - awaiting payment"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[18].id,
          title: "Heritage Kitchen Plumbing",
          description: "Complete kitchen replumb for heritage renovation",
          address: createdClients[18].address || "",
          latitude: "-16.8920",
          longitude: "145.7650",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000),
          notes: "Large renovation job - paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[20].id,
          title: "Bathroom Renovation",
          description: "Complete bathroom renovation plumbing",
          address: createdClients[20].address || "",
          latitude: "-16.8750",
          longitude: "145.7200",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
          notes: "Large job - invoice paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[21].id,
          title: "Builder Final Payment",
          description: "Final fix plumbing for new home construction",
          address: createdClients[21].address || "",
          latitude: "-16.8850",
          longitude: "145.7150",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
          notes: "Builder progress payment"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[22].id,
          title: "Multi-Property Service",
          description: "Annual maintenance on 5 rental properties",
          address: createdClients[22].address || "",
          latitude: "-16.8680",
          longitude: "145.7350",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000),
          notes: "Landlord account - paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[25].id,
          title: "Restaurant Fit-Out Complete",
          description: "Complete plumbing fit-out for new restaurant",
          address: createdClients[25].address || "",
          latitude: "-16.8980",
          longitude: "145.7620",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000),
          notes: "Large commercial job - paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[27].id,
          title: "Strata Hot Water Upgrade",
          description: "Upgraded shared hot water system for 12 units",
          address: createdClients[27].address || "",
          latitude: "-16.8920",
          longitude: "145.7580",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 57 * 24 * 60 * 60 * 1000),
          notes: "Body corporate - payment pending"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[29].id,
          title: "Commercial Kitchen Complete",
          description: "Full commercial kitchen plumbing installation",
          address: createdClients[29].address || "",
          latitude: "-16.9180",
          longitude: "145.7750",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000),
          notes: "Large commercial - invoice paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[31].id,
          title: "CBD Building Upgrade",
          description: "Major plumbing upgrade for commercial building",
          address: createdClients[31].address || "",
          latitude: "-16.9200",
          longitude: "145.7700",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 67 * 24 * 60 * 60 * 1000),
          notes: "Commercial building - paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[35].id,
          title: "Resort Pool Renovation",
          description: "Complete pool and spa plumbing renovation",
          address: createdClients[35].address || "",
          latitude: "-16.4850",
          longitude: "145.4650",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000),
          notes: "Port Douglas resort - large job paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[37].id,
          title: "Medical Centre Upgrade",
          description: "Compliance upgrade for medical centre",
          address: createdClients[37].address || "",
          latitude: "-16.7920",
          longitude: "145.6980",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 78 * 24 * 60 * 60 * 1000),
          notes: "Healthcare compliance - paid"
        },
        {
          userId: demoUser.id,
          clientId: createdClients[39].id,
          title: "Hotel Bathroom Renovation",
          description: "Renovated 10 hotel room bathrooms",
          address: createdClients[39].address || "",
          latitude: "-16.7580",
          longitude: "145.6720",
          status: "invoiced" as const,
          scheduledAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
          notes: "Large hotel job - invoice paid"
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

      // ============================================
      // ADDITIONAL QUOTES (5 more for variety)
      // ============================================

      // DRAFT QUOTE 3 - Commercial job
      const draft3Num = await storage.generateQuoteNumber(demoUser.id);
      const draftQuote3 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[15].id,
        title: "Grease Trap Installation",
        description: "Supply and install commercial grease trap for cafe kitchen",
        status: "draft" as const,
        subtotal: "2450.00",
        gstAmount: "245.00",
        total: "2695.00",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draft3Num
      });
      await storage.createQuoteLineItem({ quoteId: draftQuote3.id, description: "Commercial Grease Trap (100L)", quantity: "1.00", unitPrice: "1200.00", total: "1200.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: draftQuote3.id, description: "Drainage Connection Kit", quantity: "1.00", unitPrice: "350.00", total: "350.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: draftQuote3.id, description: "Council Inspection Fee", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: draftQuote3.id, description: "Installation Labour (6 hours)", quantity: "6.00", unitPrice: "120.00", total: "720.00", sortOrder: 4 });

      // SENT QUOTE 3 - Awaiting response
      const sent3Num = await storage.generateQuoteNumber(demoUser.id);
      const sentQuote3 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[9].id,
        title: "Corrosion Repair Package",
        description: "Replace corroded copper pipes in beachfront property",
        status: "sent" as const,
        subtotal: "1680.00",
        gstAmount: "168.00",
        total: "1848.00",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        number: sent3Num
      });
      await storage.createQuoteLineItem({ quoteId: sentQuote3.id, description: "Copper Pipe (15m)", quantity: "15.00", unitPrice: "45.00", total: "675.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: sentQuote3.id, description: "Marine-Grade Fittings", quantity: "1.00", unitPrice: "285.00", total: "285.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: sentQuote3.id, description: "Installation Labour (6 hours)", quantity: "6.00", unitPrice: "120.00", total: "720.00", sortOrder: 3 });

      // SENT QUOTE 4 - Recent submission
      const sent4Num = await storage.generateQuoteNumber(demoUser.id);
      const sentQuote4 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[11].id,
        title: "New Build Plumbing - Stage 1",
        description: "First fix rough-in plumbing for new 4-bedroom home",
        status: "sent" as const,
        subtotal: "8500.00",
        gstAmount: "850.00",
        total: "9350.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        number: sent4Num
      });
      await storage.createQuoteLineItem({ quoteId: sentQuote4.id, description: "PVC Drainage System", quantity: "1.00", unitPrice: "2200.00", total: "2200.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: sentQuote4.id, description: "Copper Water Lines", quantity: "1.00", unitPrice: "1800.00", total: "1800.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: sentQuote4.id, description: "Gas Rough-In", quantity: "1.00", unitPrice: "950.00", total: "950.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: sentQuote4.id, description: "Fixtures Preparation", quantity: "1.00", unitPrice: "750.00", total: "750.00", sortOrder: 4 });
      await storage.createQuoteLineItem({ quoteId: sentQuote4.id, description: "Installation Labour (24 hours)", quantity: "24.00", unitPrice: "120.00", total: "2880.00", sortOrder: 5 });

      // ACCEPTED QUOTE 3 - Ready for work
      const accepted3Num = await storage.generateQuoteNumber(demoUser.id);
      const acceptedQuote3 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[10].id,
        title: "Holiday Rental Bathroom Upgrade",
        description: "Full bathroom renovation for holiday rental property",
        status: "accepted" as const,
        subtotal: "4200.00",
        gstAmount: "420.00",
        total: "4620.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        acceptedBy: "Wendy Chang",
        number: accepted3Num
      });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote3.id, description: "Vanity and Basin Set", quantity: "1.00", unitPrice: "950.00", total: "950.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote3.id, description: "Toilet Suite (Close Coupled)", quantity: "1.00", unitPrice: "680.00", total: "680.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote3.id, description: "Shower Mixer and Rail", quantity: "1.00", unitPrice: "520.00", total: "520.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote3.id, description: "Towel Rails and Accessories", quantity: "1.00", unitPrice: "290.00", total: "290.00", sortOrder: 4 });
      await storage.createQuoteLineItem({ quoteId: acceptedQuote3.id, description: "Installation Labour (15 hours)", quantity: "15.00", unitPrice: "120.00", total: "1800.00", sortOrder: 5 });

      // REJECTED QUOTE 3 - Too expensive for customer
      const rejected3Num = await storage.generateQuoteNumber(demoUser.id);
      const rejectedQuote3 = await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[3].id,
        title: "Full Unit Complex Repiping",
        description: "Complete copper repiping for all 6 units in complex",
        status: "rejected" as const,
        subtotal: "18500.00",
        gstAmount: "1850.00",
        total: "20350.00",
        validUntil: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        number: rejected3Num
      });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote3.id, description: "Copper Piping Materials", quantity: "1.00", unitPrice: "6500.00", total: "6500.00", sortOrder: 1 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote3.id, description: "Fittings and Valves", quantity: "1.00", unitPrice: "2800.00", total: "2800.00", sortOrder: 2 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote3.id, description: "Access Work and Making Good", quantity: "1.00", unitPrice: "1500.00", total: "1500.00", sortOrder: 3 });
      await storage.createQuoteLineItem({ quoteId: rejectedQuote3.id, description: "Labour (64 hours over 8 days)", quantity: "64.00", unitPrice: "120.00", total: "7680.00", sortOrder: 4 });

      // ============================================
      // ADDITIONAL QUOTES (27 more for 40+ total)
      // ============================================

      // Additional DRAFT quotes (5 more)
      const draft4Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[16].id,
        title: "Hot Water System Upgrade",
        description: "Upgrade to heat pump hot water system with solar assist",
        status: "draft" as const,
        subtotal: "3200.00",
        gstAmount: "320.00",
        total: "3520.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft4Num
      });

      const draft5Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[17].id,
        title: "Factory Amenities Upgrade",
        description: "Complete staff bathroom and kitchen plumbing renovation",
        status: "draft" as const,
        subtotal: "12500.00",
        gstAmount: "1250.00",
        total: "13750.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft5Num
      });

      const draft6Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[19].id,
        title: "Laundry Renovation Plumbing",
        description: "New laundry trough, taps, and washing machine connections",
        status: "draft" as const,
        subtotal: "850.00",
        gstAmount: "85.00",
        total: "935.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft6Num
      });

      const draft7Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[21].id,
        title: "Gas BBQ Connection",
        description: "Install permanent gas line to outdoor BBQ area",
        status: "draft" as const,
        subtotal: "680.00",
        gstAmount: "68.00",
        total: "748.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft7Num
      });

      const draft8Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[23].id,
        title: "Bathroom Accessibility Upgrade",
        description: "Install grab rails, raised toilet, and accessible shower",
        status: "draft" as const,
        subtotal: "2450.00",
        gstAmount: "245.00",
        total: "2695.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        number: draft8Num
      });

      // Additional SENT quotes (8 more)
      const sent5Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[18].id,
        title: "Heritage Bathroom Restoration",
        description: "Restore original bathroom with period-appropriate fixtures",
        status: "sent" as const,
        subtotal: "5800.00",
        gstAmount: "580.00",
        total: "6380.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        number: sent5Num
      });

      const sent6Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[20].id,
        title: "Second Bathroom Addition",
        description: "Full second bathroom rough-in and fit-out",
        status: "sent" as const,
        subtotal: "6200.00",
        gstAmount: "620.00",
        total: "6820.00",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        number: sent6Num
      });

      const sent7Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[22].id,
        title: "Multi-Property Hot Water",
        description: "Replace 5 hot water systems across rental portfolio",
        status: "sent" as const,
        subtotal: "8500.00",
        gstAmount: "850.00",
        total: "9350.00",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        number: sent7Num
      });

      const sent8Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[25].id,
        title: "Restaurant Kitchen Upgrade",
        description: "Commercial dishwasher and additional sink installation",
        status: "sent" as const,
        subtotal: "4800.00",
        gstAmount: "480.00",
        total: "5280.00",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        number: sent8Num
      });

      const sent9Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[27].id,
        title: "Strata Pipe Upgrade",
        description: "Replace common area copper pipes to PEX",
        status: "sent" as const,
        subtotal: "15200.00",
        gstAmount: "1520.00",
        total: "16720.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        number: sent9Num
      });

      const sent10Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[31].id,
        title: "CBD Office Bathroom Fit-Out",
        description: "New executive bathroom with premium fixtures",
        status: "sent" as const,
        subtotal: "8900.00",
        gstAmount: "890.00",
        total: "9790.00",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        number: sent10Num
      });

      const sent11Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[35].id,
        title: "Resort Pool Upgrade",
        description: "Complete pool and spa plumbing renovation",
        status: "sent" as const,
        subtotal: "22000.00",
        gstAmount: "2200.00",
        total: "24200.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        number: sent11Num
      });

      const sent12Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[37].id,
        title: "Medical Centre Compliance",
        description: "Healthcare compliance upgrade with backflow prevention",
        status: "sent" as const,
        subtotal: "4200.00",
        gstAmount: "420.00",
        total: "4620.00",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: sent12Num
      });

      // Additional ACCEPTED quotes (7 more)
      const accepted4Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[24].id,
        title: "Daycare Centre Plumbing",
        description: "Child-safe fixtures and drinking fountains",
        status: "accepted" as const,
        subtotal: "3600.00",
        gstAmount: "360.00",
        total: "3960.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        acceptedBy: "Rachel Green",
        number: accepted4Num
      });

      const accepted5Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[26].id,
        title: "New Build Final Fix",
        description: "Final fix plumbing for new construction",
        status: "accepted" as const,
        subtotal: "4800.00",
        gstAmount: "480.00",
        total: "5280.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        acceptedBy: "Christina Nguyen",
        number: accepted5Num
      });

      const accepted6Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[29].id,
        title: "Commercial Kitchen Fit-Out",
        description: "Full commercial kitchen plumbing installation",
        status: "accepted" as const,
        subtotal: "9500.00",
        gstAmount: "950.00",
        total: "10450.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        acceptedBy: "Tony Rizzo",
        number: accepted6Num
      });

      const accepted7Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[33].id,
        title: "Airbnb Bathroom Refresh",
        description: "Quick bathroom update for holiday rental",
        status: "accepted" as const,
        subtotal: "1850.00",
        gstAmount: "185.00",
        total: "2035.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        acceptedBy: "Jessica Liu",
        number: accepted7Num
      });

      const accepted8Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[36].id,
        title: "Office Building Maintenance",
        description: "Annual maintenance contract for commercial building",
        status: "accepted" as const,
        subtotal: "2400.00",
        gstAmount: "240.00",
        total: "2640.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        acceptedBy: "Gary Hughes",
        number: accepted8Num
      });

      const accepted9Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[38].id,
        title: "Development Site Plumbing",
        description: "Rough-in plumbing for 4-unit development",
        status: "accepted" as const,
        subtotal: "18500.00",
        gstAmount: "1850.00",
        total: "20350.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        acceptedBy: "Simon Clarke",
        number: accepted9Num
      });

      const accepted10Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[39].id,
        title: "Hotel Room Upgrades",
        description: "Bathroom upgrades for 8 hotel rooms",
        status: "accepted" as const,
        subtotal: "12800.00",
        gstAmount: "1280.00",
        total: "14080.00",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
        acceptedBy: "Linda Martinez",
        number: accepted10Num
      });

      // Additional REJECTED quotes (7 more)
      const rejected4Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[16].id,
        title: "Rainwater Tank System",
        description: "Large rainwater collection and distribution system",
        status: "rejected" as const,
        subtotal: "8500.00",
        gstAmount: "850.00",
        total: "9350.00",
        validUntil: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        number: rejected4Num
      });

      const rejected5Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[18].id,
        title: "Full Home Repipe",
        description: "Complete copper to PEX repipe throughout house",
        status: "rejected" as const,
        subtotal: "14500.00",
        gstAmount: "1450.00",
        total: "15950.00",
        validUntil: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        number: rejected5Num
      });

      const rejected6Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[21].id,
        title: "Solar Hot Water Premium",
        description: "Premium evacuated tube solar hot water system",
        status: "rejected" as const,
        subtotal: "7200.00",
        gstAmount: "720.00",
        total: "7920.00",
        validUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        number: rejected6Num
      });

      const rejected7Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[27].id,
        title: "Complex-Wide Upgrade",
        description: "Complete plumbing upgrade for entire apartment complex",
        status: "rejected" as const,
        subtotal: "45000.00",
        gstAmount: "4500.00",
        total: "49500.00",
        validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        number: rejected7Num
      });

      const rejected8Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[30].id,
        title: "Beachfront Remodel",
        description: "Complete plumbing remodel for beachfront property",
        status: "rejected" as const,
        subtotal: "18000.00",
        gstAmount: "1800.00",
        total: "19800.00",
        validUntil: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        number: rejected8Num
      });

      const rejected9Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[34].id,
        title: "Marina Facility Upgrade",
        description: "Water and waste system upgrade for marina facilities",
        status: "rejected" as const,
        subtotal: "25000.00",
        gstAmount: "2500.00",
        total: "27500.00",
        validUntil: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
        number: rejected9Num
      });

      const rejected10Num = await storage.generateQuoteNumber(demoUser.id);
      await storage.createQuote({
        userId: demoUser.id,
        clientId: createdClients[37].id,
        title: "Medical Centre Expansion",
        description: "Plumbing for new wing of medical centre",
        status: "rejected" as const,
        subtotal: "32000.00",
        gstAmount: "3200.00",
        total: "35200.00",
        validUntil: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        number: rejected10Num
      });

      console.log('✅ 40 Demo quotes created (8 draft, 12 sent, 10 accepted, 10 rejected)');

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

      // ============================================
      // ADDITIONAL INVOICES (6 more for variety)
      // ============================================

      // DRAFT INVOICE 2
      const draftInv2Num = await storage.generateInvoiceNumber(demoUser.id);
      const draftInvoice2 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[4].id,
        title: "Leaking Shower Head Fix",
        description: "Replace washer and cartridge in shower mixer",
        status: "draft" as const,
        subtotal: "95.00",
        gstAmount: "9.50",
        total: "104.50",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draftInv2Num
      });
      await storage.createInvoiceLineItem({ invoiceId: draftInvoice2.id, description: "Shower Mixer Cartridge", quantity: "1.00", unitPrice: "35.00", total: "35.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: draftInvoice2.id, description: "Labour (30 mins)", quantity: "0.50", unitPrice: "120.00", total: "60.00", sortOrder: 2 });

      // SENT INVOICE 3 - Recent
      const sentInv3Num = await storage.generateInvoiceNumber(demoUser.id);
      const sentInvoice3 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[12].id,
        title: "Toilet Replacement - Catherine Murray",
        description: "Supply and install new dual-flush toilet",
        status: "sent" as const,
        subtotal: "580.00",
        gstAmount: "58.00",
        total: "638.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        number: sentInv3Num
      });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice3.id, description: "Caroma Dual-Flush Toilet", quantity: "1.00", unitPrice: "420.00", total: "420.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice3.id, description: "Installation and Old Removal", quantity: "1.00", unitPrice: "160.00", total: "160.00", sortOrder: 2 });

      // SENT INVOICE 4 - Linked to invoiced job (Pool Filter Replacement)
      const sentInv4Num = await storage.generateInvoiceNumber(demoUser.id);
      const sentInvoice4 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[5].id,
        jobId: createdJobs[20].id, // Pool Filter Replacement - invoiced job
        title: "Pool Filter Replacement",
        description: "Replace pool filter cartridge and service pump",
        status: "sent" as const,
        subtotal: "450.00",
        gstAmount: "45.00",
        total: "495.00",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: sentInv4Num
      });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice4.id, description: "Pool Filter Cartridge (Large)", quantity: "1.00", unitPrice: "220.00", total: "220.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice4.id, description: "Pump Service and Clean", quantity: "1.00", unitPrice: "150.00", total: "150.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: sentInvoice4.id, description: "Labour (1 hour)", quantity: "1.00", unitPrice: "80.00", total: "80.00", sortOrder: 3 });

      // OVERDUE INVOICE 2 - Significantly overdue (Rural Bore Pump Service)
      const overdueInv2Num = await storage.generateInvoiceNumber(demoUser.id);
      const overdueInvoice2 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[13].id,
        jobId: createdJobs[19].id, // Rural Bore Pump Service - done job
        title: "Rural Bore Pump Service",
        description: "Annual bore pump service and pressure test",
        status: "sent" as const,
        subtotal: "380.00",
        gstAmount: "38.00",
        total: "418.00",
        dueDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        number: overdueInv2Num
      });
      await storage.createInvoiceLineItem({ invoiceId: overdueInvoice2.id, description: "Bore Pump Service", quantity: "1.00", unitPrice: "220.00", total: "220.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: overdueInvoice2.id, description: "Pressure Test & Travel", quantity: "1.00", unitPrice: "160.00", total: "160.00", sortOrder: 2 });

      // PAID INVOICES (3 more)
      const paid4InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice4 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[6].id,
        jobId: createdJobs[21].id, // Rough-In Plumbing Stage 1 - invoiced job
        title: "Rough-In Plumbing Stage 1",
        description: "First fix plumbing for new build - progress payment",
        status: "paid" as const,
        subtotal: "2800.00",
        gstAmount: "280.00",
        total: "3080.00",
        dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        number: paid4InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice4.id, description: "Rough-In Plumbing - Bathroom", quantity: "1.00", unitPrice: "1200.00", total: "1200.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice4.id, description: "Rough-In Plumbing - Kitchen", quantity: "1.00", unitPrice: "950.00", total: "950.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice4.id, description: "Drainage Connection", quantity: "1.00", unitPrice: "650.00", total: "650.00", sortOrder: 3 });

      const paid5InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice5 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[8].id,
        jobId: createdJobs[22].id, // Rental Property Maintenance - invoiced job
        title: "Rental Property Maintenance",
        description: "Multi-property maintenance - Melissa Torres portfolio",
        status: "paid" as const,
        subtotal: "520.00",
        gstAmount: "52.00",
        total: "572.00",
        dueDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
        number: paid5InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice5.id, description: "Kitchen Tap Repair", quantity: "1.00", unitPrice: "150.00", total: "150.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice5.id, description: "Bathroom Drain Clearing", quantity: "1.00", unitPrice: "180.00", total: "180.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice5.id, description: "Toilet Cistern Repair", quantity: "1.00", unitPrice: "190.00", total: "190.00", sortOrder: 3 });

      const paid6InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice6 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[14].id,
        title: "Body Corporate Emergency Repair",
        description: "After-hours burst pipe repair at Lake Street apartments",
        status: "paid" as const,
        subtotal: "680.00",
        gstAmount: "68.00",
        total: "748.00",
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: paid6InvNum
      });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice6.id, description: "Emergency Call-Out (After Hours)", quantity: "1.00", unitPrice: "200.00", total: "200.00", sortOrder: 1 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice6.id, description: "Burst Pipe Repair", quantity: "1.00", unitPrice: "280.00", total: "280.00", sortOrder: 2 });
      await storage.createInvoiceLineItem({ invoiceId: paidInvoice6.id, description: "Water Damage Mitigation", quantity: "1.00", unitPrice: "200.00", total: "200.00", sortOrder: 3 });

      // ============================================
      // ADDITIONAL INVOICES (27 more for 40+ total)
      // ============================================

      // Additional DRAFT invoices (4 more)
      const draft2InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[16].id,
        title: "Annual Hot Water Service",
        description: "Scheduled maintenance for hot water system",
        status: "draft" as const,
        subtotal: "180.00",
        gstAmount: "18.00",
        total: "198.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draft2InvNum
      });

      const draft3InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[18].id,
        title: "Heritage Bathroom Quote Preparation",
        description: "Site inspection and quote preparation for heritage bathroom",
        status: "draft" as const,
        subtotal: "150.00",
        gstAmount: "15.00",
        total: "165.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draft3InvNum
      });

      const draft4InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[21].id,
        title: "Gas Appliance Inspection",
        description: "Annual gas compliance inspection",
        status: "draft" as const,
        subtotal: "220.00",
        gstAmount: "22.00",
        total: "242.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draft4InvNum
      });

      const draft5InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[23].id,
        title: "Accessibility Assessment",
        description: "NDIS bathroom accessibility assessment",
        status: "draft" as const,
        subtotal: "180.00",
        gstAmount: "18.00",
        total: "198.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        number: draft5InvNum
      });

      // Additional SENT invoices (8 more)
      const sent5InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[17].id,
        title: "Factory Drain Clearing",
        description: "Industrial drain clearing and inspection",
        status: "sent" as const,
        subtotal: "450.00",
        gstAmount: "45.00",
        total: "495.00",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: sent5InvNum
      });

      const sent6InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[19].id,
        title: "Tap Washer Replacement",
        description: "Replace worn tap washers throughout home",
        status: "sent" as const,
        subtotal: "120.00",
        gstAmount: "12.00",
        total: "132.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        number: sent6InvNum
      });

      const sent7InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[20].id,
        title: "Shower Leak Repair",
        description: "Fixed leaking shower and resealed screen",
        status: "sent" as const,
        subtotal: "280.00",
        gstAmount: "28.00",
        total: "308.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        number: sent7InvNum
      });

      const sent8InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[22].id,
        title: "Hot Water System Replacement",
        description: "New heat pump hot water system installation",
        status: "sent" as const,
        subtotal: "2800.00",
        gstAmount: "280.00",
        total: "3080.00",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        number: sent8InvNum
      });

      const sent9InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[25].id,
        title: "Restaurant Emergency Repair",
        description: "Emergency burst hot water line repair",
        status: "sent" as const,
        subtotal: "380.00",
        gstAmount: "38.00",
        total: "418.00",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        number: sent9InvNum
      });

      const sent10InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[28].id,
        title: "Elderly Care Bathroom",
        description: "Grab rails and safety fixtures installation",
        status: "sent" as const,
        subtotal: "850.00",
        gstAmount: "85.00",
        total: "935.00",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        number: sent10InvNum
      });

      const sent11InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[33].id,
        title: "Airbnb Quick Fix",
        description: "Emergency drain clearing before guest arrival",
        status: "sent" as const,
        subtotal: "180.00",
        gstAmount: "18.00",
        total: "198.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        number: sent11InvNum
      });

      const sent12InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[37].id,
        title: "Medical Centre Sink Install",
        description: "New handwash sink in treatment room",
        status: "sent" as const,
        subtotal: "680.00",
        gstAmount: "68.00",
        total: "748.00",
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        number: sent12InvNum
      });

      // Additional OVERDUE invoices (4 more)
      const overdue3InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[27].id,
        title: "Strata Hot Water Service",
        description: "Common area hot water system maintenance",
        status: "sent" as const,
        subtotal: "420.00",
        gstAmount: "42.00",
        total: "462.00",
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        number: overdue3InvNum
      });

      const overdue4InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[30].id,
        title: "Beachfront Unit Maintenance",
        description: "Annual plumbing inspection and minor repairs",
        status: "sent" as const,
        subtotal: "350.00",
        gstAmount: "35.00",
        total: "385.00",
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        number: overdue4InvNum
      });

      const overdue5InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[31].id,
        title: "CBD Office Repairs",
        description: "Fixed running toilets and leaking taps",
        status: "sent" as const,
        subtotal: "520.00",
        gstAmount: "52.00",
        total: "572.00",
        dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        number: overdue5InvNum
      });

      const overdue6InvNum = await storage.generateInvoiceNumber(demoUser.id);
      await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[34].id,
        title: "Marina Water Line",
        description: "Water line installation to boat mooring",
        status: "sent" as const,
        subtotal: "980.00",
        gstAmount: "98.00",
        total: "1078.00",
        dueDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
        number: overdue6InvNum
      });

      // Additional PAID invoices (11 more)
      const paid7InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice7 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[16].id,
        title: "Laundry Tap Repair",
        description: "Fixed dripping laundry tap",
        status: "paid" as const,
        subtotal: "120.00",
        gstAmount: "12.00",
        total: "132.00",
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        number: paid7InvNum
      });

      const paid8InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice8 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[18].id,
        title: "Bathroom Vanity Install",
        description: "New vanity basin and tapware installation",
        status: "paid" as const,
        subtotal: "680.00",
        gstAmount: "68.00",
        total: "748.00",
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        number: paid8InvNum
      });

      const paid9InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice9 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[19].id,
        title: "Gas Cooktop Connection",
        description: "New gas cooktop connection with compliance certificate",
        status: "paid" as const,
        subtotal: "280.00",
        gstAmount: "28.00",
        total: "308.00",
        dueDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        number: paid9InvNum
      });

      const paid10InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice10 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[24].id,
        title: "Blocked Sewer Line",
        description: "Sewer line clearing with CCTV inspection",
        status: "paid" as const,
        subtotal: "450.00",
        gstAmount: "45.00",
        total: "495.00",
        dueDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        number: paid10InvNum
      });

      const paid11InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice11 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[26].id,
        title: "New Build Final Fix",
        description: "Final fix plumbing for new construction",
        status: "paid" as const,
        subtotal: "2400.00",
        gstAmount: "240.00",
        total: "2640.00",
        dueDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        number: paid11InvNum
      });

      const paid12InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice12 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[29].id,
        title: "Commercial Kitchen Complete",
        description: "Full commercial kitchen plumbing installation",
        status: "paid" as const,
        subtotal: "5800.00",
        gstAmount: "580.00",
        total: "6380.00",
        dueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
        number: paid12InvNum
      });

      const paid13InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice13 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[35].id,
        title: "Resort Spa Repairs",
        description: "Fixed spa jets and replumbed circulation system",
        status: "paid" as const,
        subtotal: "1850.00",
        gstAmount: "185.00",
        total: "2035.00",
        dueDate: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 63 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
        number: paid13InvNum
      });

      const paid14InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice14 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[36].id,
        title: "Office Building Maintenance",
        description: "Quarterly plumbing inspection and minor repairs",
        status: "paid" as const,
        subtotal: "650.00",
        gstAmount: "65.00",
        total: "715.00",
        dueDate: new Date(Date.now() - 49 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        number: paid14InvNum
      });

      const paid15InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice15 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[38].id,
        title: "Development Site Rough-In",
        description: "Rough-in plumbing for 4-unit development - Stage 1",
        status: "paid" as const,
        subtotal: "8500.00",
        gstAmount: "850.00",
        total: "9350.00",
        dueDate: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 77 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000),
        number: paid15InvNum
      });

      const paid16InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice16 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[39].id,
        title: "Hotel Room Upgrades",
        description: "Bathroom upgrades for 8 hotel rooms",
        status: "paid" as const,
        subtotal: "4200.00",
        gstAmount: "420.00",
        total: "4620.00",
        dueDate: new Date(Date.now() - 63 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000),
        number: paid16InvNum
      });

      const paid17InvNum = await storage.generateInvoiceNumber(demoUser.id);
      const paidInvoice17 = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[20].id,
        title: "Bathroom Renovation Complete",
        description: "Full bathroom renovation plumbing",
        status: "paid" as const,
        subtotal: "3200.00",
        gstAmount: "320.00",
        total: "3520.00",
        dueDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
        number: paid17InvNum
      });

      console.log('✅ 40 Demo invoices created (6 draft, 12 sent, 6 overdue, 17 paid)');

      // ============================================
      // CREATE RECEIPTS FOR ALL PAID INVOICES (6 total)
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

      const receipt4 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice4.id,
        clientId: createdClients[6].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-004`,
        amount: "3080.00",
        gstAmount: "280.00",
        subtotal: "2800.00",
        description: "Payment for rough-in plumbing stage 1",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      });

      const receipt5 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice5.id,
        clientId: createdClients[8].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-005`,
        amount: "572.00",
        gstAmount: "52.00",
        subtotal: "520.00",
        description: "Payment for rental property maintenance",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000)
      });

      const receipt6 = await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice6.id,
        clientId: createdClients[14].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-006`,
        amount: "748.00",
        gstAmount: "68.00",
        subtotal: "680.00",
        description: "Payment for emergency burst pipe repair",
        paymentMethod: 'card',
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });

      // ============================================
      // ADDITIONAL RECEIPTS (19 more for 25+ total)
      // ============================================

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice7.id,
        clientId: createdClients[16].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-007`,
        amount: "132.00",
        gstAmount: "12.00",
        subtotal: "120.00",
        description: "Payment for laundry tap repair",
        paymentMethod: 'card',
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice8.id,
        clientId: createdClients[18].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-008`,
        amount: "748.00",
        gstAmount: "68.00",
        subtotal: "680.00",
        description: "Payment for bathroom vanity installation",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice9.id,
        clientId: createdClients[19].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-009`,
        amount: "308.00",
        gstAmount: "28.00",
        subtotal: "280.00",
        description: "Payment for gas cooktop connection",
        paymentMethod: 'cash',
        paidAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice10.id,
        clientId: createdClients[24].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-010`,
        amount: "495.00",
        gstAmount: "45.00",
        subtotal: "450.00",
        description: "Payment for blocked sewer line clearing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice11.id,
        clientId: createdClients[26].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-011`,
        amount: "2640.00",
        gstAmount: "240.00",
        subtotal: "2400.00",
        description: "Payment for new build final fix plumbing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice12.id,
        clientId: createdClients[29].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-012`,
        amount: "6380.00",
        gstAmount: "580.00",
        subtotal: "5800.00",
        description: "Payment for commercial kitchen fit-out",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice13.id,
        clientId: createdClients[35].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-013`,
        amount: "2035.00",
        gstAmount: "185.00",
        subtotal: "1850.00",
        description: "Payment for resort spa repairs",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice14.id,
        clientId: createdClients[36].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-014`,
        amount: "715.00",
        gstAmount: "65.00",
        subtotal: "650.00",
        description: "Payment for office building maintenance",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice15.id,
        clientId: createdClients[38].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-015`,
        amount: "9350.00",
        gstAmount: "850.00",
        subtotal: "8500.00",
        description: "Payment for development site rough-in plumbing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice16.id,
        clientId: createdClients[39].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-016`,
        amount: "4620.00",
        gstAmount: "420.00",
        subtotal: "4200.00",
        description: "Payment for hotel room upgrades",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice17.id,
        clientId: createdClients[20].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-017`,
        amount: "3520.00",
        gstAmount: "320.00",
        subtotal: "3200.00",
        description: "Payment for bathroom renovation complete",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000)
      });

      // Additional receipts for variety (partial payments, different methods)
      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice4.id,
        clientId: createdClients[6].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-018`,
        amount: "1540.00",
        gstAmount: "140.00",
        subtotal: "1400.00",
        description: "Progress payment 2 - rough-in plumbing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice11.id,
        clientId: createdClients[26].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-019`,
        amount: "1320.00",
        gstAmount: "120.00",
        subtotal: "1200.00",
        description: "Final payment - new build plumbing",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice15.id,
        clientId: createdClients[38].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-020`,
        amount: "4675.00",
        gstAmount: "425.00",
        subtotal: "4250.00",
        description: "Progress payment - development site stage 2",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice12.id,
        clientId: createdClients[29].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-021`,
        amount: "3190.00",
        gstAmount: "290.00",
        subtotal: "2900.00",
        description: "Deposit - commercial kitchen",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice16.id,
        clientId: createdClients[39].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-022`,
        amount: "2310.00",
        gstAmount: "210.00",
        subtotal: "2100.00",
        description: "Progress payment - hotel room batch 1",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice13.id,
        clientId: createdClients[35].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-023`,
        amount: "1017.50",
        gstAmount: "92.50",
        subtotal: "925.00",
        description: "Deposit - resort spa repairs",
        paymentMethod: 'card',
        paidAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice17.id,
        clientId: createdClients[20].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-024`,
        amount: "1760.00",
        gstAmount: "160.00",
        subtotal: "1600.00",
        description: "Deposit - bathroom renovation",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000)
      });

      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: paidInvoice14.id,
        clientId: createdClients[36].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-025`,
        amount: "357.50",
        gstAmount: "32.50",
        subtotal: "325.00",
        description: "Quarterly maintenance retainer",
        paymentMethod: 'bank_transfer',
        paidAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000)
      });

      console.log('✅ 25 Demo receipts created for paid invoices');
    
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
    const hasInvitedMembers = existingTeamMembers.some(m => m.inviteStatus === 'pending');
    
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
        useCustomPermissions: true,
        customPermissions: [
          WORKER_PERMISSIONS.COLLECT_PAYMENTS,
          WORKER_PERMISSIONS.VIEW_INVOICES,
          WORKER_PERMISSIONS.CREATE_QUOTES,
          WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
          WORKER_PERMISSIONS.TIME_TRACKING,
          WORKER_PERMISSIONS.GPS_CHECKIN,
          WORKER_PERMISSIONS.TEAM_CHAT,
          WORKER_PERMISSIONS.VIEW_CLIENTS,
        ],
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
        inviteStatus: 'pending' as const, // Pending invite - for testing invite flow
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
        inviteStatus: 'pending' as const, // Pending invite - for testing invite flow
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
      const teamMemberRecord: any = {
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
      };
      
      // Add custom permissions if defined for this team member
      if ('useCustomPermissions' in member) {
        teamMemberRecord.useCustomPermissions = member.useCustomPermissions;
        teamMemberRecord.customPermissions = member.customPermissions;
      }
      
      const teamMember = await storage.createTeamMember(teamMemberRecord);
      
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