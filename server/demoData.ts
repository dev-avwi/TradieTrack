import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from './storage';

// ============================================
// DEMO USER CREDENTIALS
// ============================================
export const DEMO_USER = {
  email: 'demo@tradietrack.app',
  password: 'demo123',
  name: 'Demo User',
  businessName: 'Demo Plumbing & Gas',
  phone: '+61407888123',
};

export const DEMO_WORKER = {
  email: 'demo.worker@tradietrack.app',
  password: 'worker123',
  name: 'Jake Morrison',
  phone: '+61412555888',
  role: 'worker' as const,
};

export const TEST_USERS = [
  {
    email: 'mike@northqldplumbing.com.au',
    password: 'mikesullivan',
    name: 'Mike Sullivan',
    businessName: 'North QLD Plumbing & Gas',
    phone: '+61407123456',
  },
  {
    email: 'admin@tradietrack.app',
    password: 'admin123',
    name: 'Admin User',
    businessName: 'TradieTrack Demo',
    phone: '+61400000001',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTodayAt(hours: number, minutes: number = 0): Date {
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  return today;
}

function getDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function generateXeroId(prefix: string): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomNum}`;
}

function generatePaymentToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(32);
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

export async function fixTestUserPasswords() {
  for (const testUser of TEST_USERS) {
    const user = await storage.getUserByEmail(testUser.email);
    if (user) {
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      console.log(`✅ Fixed password for ${testUser.email}`);
    }
  }
}

// ============================================
// MAIN DEMO DATA CREATION
// ============================================

export async function createDemoUserAndData() {
  try {
    let demoUser = await storage.getUserByEmail(DEMO_USER.email);

    if (!demoUser) {
      const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);
      demoUser = await storage.createUser({
        email: DEMO_USER.email,
        password: hashedPassword,
        name: DEMO_USER.name,
        phone: DEMO_USER.phone,
      });
      console.log('✅ Demo user created:', demoUser.email);
    } else {
      console.log('ℹ️ Demo user already exists:', demoUser.email);
    }

    // Check for existing demo data
    const existingClients = await storage.getClients(demoUser.id);
    if (existingClients.length > 0) {
      console.log(`ℹ️ Demo data already exists for ${demoUser.email} - deleting and recreating`);

      // Delete existing data in correct order (foreign key constraints)
      const existingJobs = await storage.getJobs(demoUser.id);
      for (const job of existingJobs) {
        await storage.deleteJob(job.id);
      }

      const existingQuotes = await storage.getQuotes(demoUser.id);
      for (const quote of existingQuotes) {
        await storage.deleteQuote(quote.id);
      }

      const existingInvoices = await storage.getInvoices(demoUser.id);
      for (const invoice of existingInvoices) {
        await storage.deleteInvoice(invoice.id);
      }

      for (const client of existingClients) {
        await storage.deleteClient(client.id);
      }

      console.log('🗑️ Existing demo data deleted');
    }

    // ============================================
    // CREATE BUSINESS SETTINGS
    // ============================================
    let businessSettings = await storage.getBusinessSettings(demoUser.id);
    if (!businessSettings) {
      businessSettings = await storage.createBusinessSettings({
        userId: demoUser.id,
        businessName: DEMO_USER.businessName,
        businessAddress: '42 Grafton Street, Cairns QLD 4870',
        businessPhone: DEMO_USER.phone,
        businessEmail: 'info@demoplumbing.com.au',
        abn: '12 345 678 901',
        bankName: 'Commonwealth Bank',
        bsb: '064-123',
        accountNumber: '12345678',
        accountName: 'Demo Plumbing & Gas Pty Ltd',
        gstRegistered: true,
        qbccLicense: 'QBCC 1234567',
        insurancePolicy: 'QBE-PLB-987654',
      });
      console.log('✅ Business settings created');
    }

    // ============================================
    // CREATE DEMO WORKER (TEAM MEMBER)
    // ============================================
    let workerUser = await storage.getUserByEmail(DEMO_WORKER.email);
    if (!workerUser) {
      const hashedWorkerPassword = await bcrypt.hash(DEMO_WORKER.password, 10);
      workerUser = await storage.createUser({
        email: DEMO_WORKER.email,
        password: hashedWorkerPassword,
        name: DEMO_WORKER.name,
        phone: DEMO_WORKER.phone,
        role: DEMO_WORKER.role,
        businessOwnerId: demoUser.id,
      });
      console.log('✅ Demo worker created:', workerUser.email);
    }

    // ============================================
    // CREATE 10 CLIENTS (Australian names, Cairns QLD addresses)
    // ============================================
    const clientsData = [
      { name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com.au', phone: '+61412345678', address: '15 Sheridan Street, Cairns City QLD 4870' },
      { name: 'David O\'Connor', email: 'david.oconnor@gmail.com', phone: '+61423456789', address: '28 Mulgrave Road, Parramatta Park QLD 4870' },
      { name: 'Emma Thompson', email: 'emma.t@outlook.com.au', phone: '+61434567890', address: '7 Lake Street, Cairns QLD 4870' },
      { name: 'James Wilson', email: 'james.wilson@bigpond.com', phone: '+61445678901', address: '92 Martyn Street, Parramatta Park QLD 4870' },
      { name: 'Lisa Chen', email: 'lisa.chen@email.com', phone: '+61456789012', address: '45 Florence Street, Edge Hill QLD 4870' },
      { name: 'Michael Brown', email: 'michael.brown@work.com.au', phone: '+61467890123', address: '12 Collins Avenue, Edge Hill QLD 4870' },
      { name: 'Rachel Green', email: 'rachel.g@email.com', phone: '+61478901234', address: '33 Anderson Street, Manunda QLD 4870' },
      { name: 'Peter Johnson', email: 'peter.johnson@business.com.au', phone: '+61489012345', address: '78 Kenny Street, Portsmith QLD 4870' },
      { name: 'Amanda White', email: 'amanda.white@email.com', phone: '+61490123456', address: '56 Digger Street, Cairns North QLD 4870' },
      { name: 'Chris Taylor', email: 'chris.taylor@company.com.au', phone: '+61401234567', address: '19 Wharf Street, Cairns City QLD 4870' },
    ];

    const createdClients = [];
    for (const clientData of clientsData) {
      const client = await storage.createClient({
        userId: demoUser.id,
        ...clientData,
      });
      createdClients.push(client);
    }
    console.log(`✅ ${createdClients.length} Demo clients created`);

    // ============================================
    // CREATE 40 JOBS (with varied statuses)
    // Status distribution: 5 pending, 8 scheduled, 6 in_progress, 8 done, 8 invoiced, 5 cancelled
    // ============================================
    const createdJobs = [];

    // PENDING JOBS (5)
    const pendingJobs = [
      { clientIdx: 0, title: 'Leaking Kitchen Tap', description: 'Customer reports kitchen mixer tap dripping constantly', address: clientsData[0].address },
      { clientIdx: 1, title: 'Toilet Running Continuously', description: 'Toilet cistern not filling properly, water keeps running', address: clientsData[1].address },
      { clientIdx: 2, title: 'Blocked Bathroom Drain', description: 'Shower drain draining slowly, needs investigation', address: clientsData[2].address },
      { clientIdx: 3, title: 'Hot Water System Quote', description: 'Customer wants quote for new hot water system replacement', address: clientsData[3].address },
      { clientIdx: 4, title: 'Gas Stove Connection', description: 'New gas cooktop needs connecting to existing gas line', address: clientsData[4].address },
    ];

    for (const job of pendingJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'pending',
        estimatedDuration: 60,
      });
      createdJobs.push(createdJob);
    }

    // SCHEDULED JOBS (8) - some today for AI optimizer
    const scheduledJobs = [
      { clientIdx: 0, title: 'Annual Hot Water Service', description: 'Annual service and maintenance check', address: clientsData[0].address, scheduledAt: getTodayAt(9, 0), scheduledTime: '09:00' },
      { clientIdx: 1, title: 'Bathroom Tap Replacement', description: 'Replace old bathroom taps with new mixers', address: clientsData[1].address, scheduledAt: getTodayAt(11, 30), scheduledTime: '11:30' },
      { clientIdx: 2, title: 'Emergency Valve Check', description: 'Check and test emergency shutoff valves', address: clientsData[2].address, scheduledAt: getTodayAt(14, 0), scheduledTime: '14:00' },
      { clientIdx: 5, title: 'Dishwasher Installation', description: 'Install new Bosch dishwasher, connect to water and waste', address: clientsData[5].address, scheduledAt: getDaysFromNow(1), scheduledTime: '10:00' },
      { clientIdx: 6, title: 'Garden Tap Installation', description: 'Install new outdoor tap near garden shed', address: clientsData[6].address, scheduledAt: getDaysFromNow(2), scheduledTime: '09:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 7, title: 'Shower Head Replacement', description: 'Replace old shower head with water-saving model', address: clientsData[7].address, scheduledAt: getDaysFromNow(3), scheduledTime: '14:00' },
      { clientIdx: 8, title: 'Pipe Inspection', description: 'CCTV camera inspection of sewer line', address: clientsData[8].address, scheduledAt: getDaysFromNow(4), scheduledTime: '08:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 9, title: 'Water Pressure Check', description: 'Investigate low water pressure complaints', address: clientsData[9].address, scheduledAt: getDaysFromNow(5), scheduledTime: '11:00' },
    ];

    for (const job of scheduledJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'scheduled',
        scheduledAt: job.scheduledAt,
        scheduledTime: job.scheduledTime,
        estimatedDuration: 90,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // IN_PROGRESS JOBS (6)
    const inProgressJobs = [
      { clientIdx: 3, title: 'Bathroom Renovation Plumbing', description: 'Full bathroom rough-in for renovation', address: clientsData[3].address, startedAt: getDaysAgo(2) },
      { clientIdx: 4, title: 'Hot Water System Replacement', description: 'Replacing old electric HWS with heat pump', address: clientsData[4].address, startedAt: getDaysAgo(1) },
      { clientIdx: 5, title: 'Kitchen Sink Installation', description: 'Installing new undermount kitchen sink', address: clientsData[5].address, startedAt: getDaysAgo(0) },
      { clientIdx: 6, title: 'Gas Line Extension', description: 'Extending gas line to new BBQ area', address: clientsData[6].address, startedAt: getDaysAgo(3), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 7, title: 'Drainage Repair', description: 'Repairing damaged stormwater drain', address: clientsData[7].address, startedAt: getDaysAgo(1) },
      { clientIdx: 8, title: 'Water Filter Installation', description: 'Installing whole-house water filtration system', address: clientsData[8].address, startedAt: getDaysAgo(0) },
    ];

    for (const job of inProgressJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'in_progress',
        startedAt: job.startedAt,
        estimatedDuration: 120,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // DONE JOBS (8) - completed but not yet invoiced
    const doneJobs = [
      { clientIdx: 0, title: 'Tap Washer Replacement', description: 'Replaced washers on 3 taps', address: clientsData[0].address, completedAt: getDaysAgo(1) },
      { clientIdx: 1, title: 'Toilet Cistern Repair', description: 'Replaced flush valve and fill valve', address: clientsData[1].address, completedAt: getDaysAgo(2) },
      { clientIdx: 2, title: 'Drain Unblocking', description: 'Cleared blocked laundry drain', address: clientsData[2].address, completedAt: getDaysAgo(3) },
      { clientIdx: 3, title: 'Gas Appliance Service', description: 'Annual service of gas heater', address: clientsData[3].address, completedAt: getDaysAgo(4) },
      { clientIdx: 4, title: 'Shower Mixer Replacement', description: 'Installed new thermostatic shower mixer', address: clientsData[4].address, completedAt: getDaysAgo(5), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 5, title: 'Outdoor Tap Repair', description: 'Fixed leaking garden tap', address: clientsData[5].address, completedAt: getDaysAgo(6) },
      { clientIdx: 6, title: 'Pressure Relief Valve', description: 'Replaced PRV on hot water system', address: clientsData[6].address, completedAt: getDaysAgo(7) },
      { clientIdx: 7, title: 'Vanity Installation', description: 'Installed new bathroom vanity with tapware', address: clientsData[7].address, completedAt: getDaysAgo(8) },
    ];

    for (const job of doneJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'done',
        completedAt: job.completedAt,
        estimatedDuration: 60,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // INVOICED JOBS (8)
    const invoicedJobs = [
      { clientIdx: 8, title: 'Emergency Pipe Repair', description: 'Repaired burst pipe under house', address: clientsData[8].address, completedAt: getDaysAgo(10), invoicedAt: getDaysAgo(9) },
      { clientIdx: 9, title: 'Hot Water Thermostat', description: 'Replaced faulty thermostat on HWS', address: clientsData[9].address, completedAt: getDaysAgo(12), invoicedAt: getDaysAgo(11) },
      { clientIdx: 0, title: 'Bathroom Fit-Out Complete', description: 'Final fix plumbing for bathroom reno', address: clientsData[0].address, completedAt: getDaysAgo(15), invoicedAt: getDaysAgo(14) },
      { clientIdx: 1, title: 'Kitchen Plumbing Upgrade', description: 'Upgraded kitchen plumbing for renovation', address: clientsData[1].address, completedAt: getDaysAgo(18), invoicedAt: getDaysAgo(17) },
      { clientIdx: 2, title: 'Gas Compliance Certificate', description: 'Annual gas safety inspection', address: clientsData[2].address, completedAt: getDaysAgo(20), invoicedAt: getDaysAgo(19) },
      { clientIdx: 3, title: 'Septic Tank Pump-Out', description: 'Pumped out and serviced septic system', address: clientsData[3].address, completedAt: getDaysAgo(22), invoicedAt: getDaysAgo(21) },
      { clientIdx: 4, title: 'Roof Plumbing Repair', description: 'Fixed leaking roof flashing', address: clientsData[4].address, completedAt: getDaysAgo(25), invoicedAt: getDaysAgo(24) },
      { clientIdx: 5, title: 'Rainwater Tank Connection', description: 'Connected rainwater tank to toilets', address: clientsData[5].address, completedAt: getDaysAgo(28), invoicedAt: getDaysAgo(27) },
    ];

    for (const job of invoicedJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'invoiced',
        completedAt: job.completedAt,
        invoicedAt: job.invoicedAt,
        estimatedDuration: 90,
      });
      createdJobs.push(createdJob);
    }

    // CANCELLED JOBS (5)
    const cancelledJobs = [
      { clientIdx: 6, title: 'Pool Pump Repair', description: 'Customer cancelled - sold the house', address: clientsData[6].address, cancellationReason: 'Customer sold property before work could commence' },
      { clientIdx: 7, title: 'Solar Hot Water Install', description: 'Customer went with competitor quote', address: clientsData[7].address, cancellationReason: 'Customer accepted lower quote from competitor' },
      { clientIdx: 8, title: 'Grease Trap Replacement', description: 'Commercial job - restaurant closed', address: clientsData[8].address, cancellationReason: 'Restaurant permanently closed' },
      { clientIdx: 9, title: 'Water Heater Upgrade', description: 'Customer postponed indefinitely', address: clientsData[9].address, cancellationReason: 'Customer postponed due to financial reasons' },
      { clientIdx: 0, title: 'Backflow Prevention', description: 'Council requirements changed', address: clientsData[0].address, cancellationReason: 'Work no longer required per updated council regulations' },
    ];

    for (const job of cancelledJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'cancelled',
        cancellationReason: job.cancellationReason,
        estimatedDuration: 120,
      });
      createdJobs.push(createdJob);
    }

    console.log(`✅ ${createdJobs.length} Demo jobs created (5 pending, 8 scheduled, 6 in_progress, 8 done, 8 invoiced, 5 cancelled)`);

    // ============================================
    // CREATE QUOTES (9 total: 2 draft, 3 sent, 2 accepted, 2 rejected)
    // ============================================

    // DRAFT QUOTES (2)
    const draft1Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Bathroom Renovation Plumbing',
      description: 'Complete plumbing rough-in and fit-out for master bathroom renovation',
      status: 'draft' as const,
      subtotal: '3200.00',
      gstAmount: '320.00',
      total: '3520.00',
      validUntil: getDaysFromNow(30),
      number: draft1Num,
    });

    const draft2Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Hot Water System Replacement',
      description: 'Supply and install new 315L heat pump hot water system',
      status: 'draft' as const,
      subtotal: '4500.00',
      gstAmount: '450.00',
      total: '4950.00',
      validUntil: getDaysFromNow(30),
      number: draft2Num,
    });

    // SENT QUOTES (3) - 2 with Xero import
    const sent1Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Kitchen Plumbing Upgrade',
      description: 'Relocate sink and install new dishwasher connection',
      status: 'sent' as const,
      subtotal: '1850.00',
      gstAmount: '185.00',
      total: '2035.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(3),
      number: sent1Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    });

    const sent2Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Gas BBQ Connection',
      description: 'Run new gas line from meter to outdoor BBQ area',
      status: 'sent' as const,
      subtotal: '980.00',
      gstAmount: '98.00',
      total: '1078.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(5),
      number: sent2Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    });

    const sent3Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Ensuite Addition Plumbing',
      description: 'Complete plumbing for new ensuite bathroom',
      status: 'sent' as const,
      subtotal: '5600.00',
      gstAmount: '560.00',
      total: '6160.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(7),
      number: sent3Num,
    });

    // ACCEPTED QUOTES (2)
    const accepted1Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Outdoor Shower Installation',
      description: 'Install outdoor shower near pool area',
      status: 'accepted' as const,
      subtotal: '1200.00',
      gstAmount: '120.00',
      total: '1320.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(10),
      acceptedAt: getDaysAgo(7),
      acceptedBy: 'Michael Brown',
      number: accepted1Num,
    });

    const accepted2Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Laundry Renovation Plumbing',
      description: 'Relocate washing machine and add new trough',
      status: 'accepted' as const,
      subtotal: '1650.00',
      gstAmount: '165.00',
      total: '1815.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(14),
      acceptedAt: getDaysAgo(10),
      acceptedBy: 'Rachel Green',
      number: accepted2Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    });

    // REJECTED QUOTES (2)
    const rejected1Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Whole House Repipe',
      description: 'Replace all copper pipes with PEX throughout house',
      status: 'rejected' as const,
      subtotal: '12000.00',
      gstAmount: '1200.00',
      total: '13200.00',
      validUntil: getDaysAgo(5),
      sentAt: getDaysAgo(20),
      number: rejected1Num,
    });

    const rejected2Num = await storage.generateQuoteNumber(demoUser.id);
    await storage.createQuote({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Solar Hot Water System',
      description: 'Supply and install rooftop solar hot water system',
      status: 'rejected' as const,
      subtotal: '8500.00',
      gstAmount: '850.00',
      total: '9350.00',
      validUntil: getDaysAgo(10),
      sentAt: getDaysAgo(30),
      number: rejected2Num,
    });

    console.log('✅ 9 Demo quotes created (2 draft, 3 sent, 2 accepted, 2 rejected)');

    // ============================================
    // CREATE INVOICES (11 total: 2 draft, 3 sent, 2 overdue, 4 paid)
    // ============================================

    // DRAFT INVOICES (2)
    const draftInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const draftInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Tap Washer Replacement',
      description: 'Replaced washers on 3 taps throughout house',
      status: 'draft' as const,
      subtotal: '180.00',
      gstAmount: '18.00',
      total: '198.00',
      dueDate: getDaysFromNow(14),
      number: draftInv1Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice1.id, description: 'Tap Washers (3 sets)', quantity: '3.00', unitPrice: '15.00', total: '45.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice1.id, description: 'Labour (1.5 hours)', quantity: '1.50', unitPrice: '90.00', total: '135.00', sortOrder: 2 });

    const draftInv2Num = await storage.generateInvoiceNumber(demoUser.id);
    const draftInvoice2 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Toilet Cistern Repair',
      description: 'Replaced flush valve and fill valve',
      status: 'draft' as const,
      subtotal: '245.00',
      gstAmount: '24.50',
      total: '269.50',
      dueDate: getDaysFromNow(14),
      number: draftInv2Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice2.id, description: 'Flush Valve Kit', quantity: '1.00', unitPrice: '85.00', total: '85.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice2.id, description: 'Fill Valve', quantity: '1.00', unitPrice: '40.00', total: '40.00', sortOrder: 2 });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice2.id, description: 'Labour (1 hour)', quantity: '1.00', unitPrice: '120.00', total: '120.00', sortOrder: 3 });

    // SENT INVOICES (3) - 2 with Xero import - all have online payment enabled
    const sentInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const sentInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Drain Unblocking Service',
      description: 'Cleared blocked laundry drain with high-pressure jetter',
      status: 'sent' as const,
      subtotal: '320.00',
      gstAmount: '32.00',
      total: '352.00',
      dueDate: getDaysFromNow(21),
      sentAt: getDaysAgo(5),
      number: sentInv1Num,
      isXeroImport: true,
      xeroInvoiceId: generateXeroId('INV'),
      xeroContactId: generateXeroId('CON'),
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice1.id, description: 'High-Pressure Jetter Service', quantity: '1.00', unitPrice: '280.00', total: '280.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice1.id, description: 'Call-Out Fee', quantity: '1.00', unitPrice: '40.00', total: '40.00', sortOrder: 2 });

    const sentInv2Num = await storage.generateInvoiceNumber(demoUser.id);
    const sentInvoice2 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Gas Heater Service',
      description: 'Annual service and safety check of gas heater',
      status: 'sent' as const,
      subtotal: '165.00',
      gstAmount: '16.50',
      total: '181.50',
      dueDate: getDaysFromNow(14),
      sentAt: getDaysAgo(3),
      number: sentInv2Num,
      isXeroImport: true,
      xeroInvoiceId: generateXeroId('INV'),
      xeroContactId: generateXeroId('CON'),
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice2.id, description: 'Gas Heater Service', quantity: '1.00', unitPrice: '165.00', total: '165.00', sortOrder: 1 });

    const sentInv3Num = await storage.generateInvoiceNumber(demoUser.id);
    const sentInvoice3 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Shower Mixer Replacement',
      description: 'Installed new thermostatic shower mixer',
      status: 'sent' as const,
      subtotal: '485.00',
      gstAmount: '48.50',
      total: '533.50',
      dueDate: getDaysFromNow(14),
      sentAt: getDaysAgo(2),
      number: sentInv3Num,
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice3.id, description: 'Thermostatic Shower Mixer', quantity: '1.00', unitPrice: '325.00', total: '325.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice3.id, description: 'Labour (1.5 hours)', quantity: '1.50', unitPrice: '106.67', total: '160.00', sortOrder: 2 });

    // OVERDUE INVOICES (2) - also have online payment enabled
    const overdueInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const overdueInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Outdoor Tap Repair',
      description: 'Fixed leaking garden tap and replaced washers',
      status: 'sent' as const,
      subtotal: '135.00',
      gstAmount: '13.50',
      total: '148.50',
      dueDate: getDaysAgo(14),
      sentAt: getDaysAgo(35),
      number: overdueInv1Num,
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: overdueInvoice1.id, description: 'Garden Tap Repair', quantity: '1.00', unitPrice: '135.00', total: '135.00', sortOrder: 1 });

    const overdueInv2Num = await storage.generateInvoiceNumber(demoUser.id);
    const overdueInvoice2 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Pressure Relief Valve Replacement',
      description: 'Replaced PRV on hot water system',
      status: 'sent' as const,
      subtotal: '220.00',
      gstAmount: '22.00',
      total: '242.00',
      dueDate: getDaysAgo(7),
      sentAt: getDaysAgo(28),
      number: overdueInv2Num,
      isXeroImport: true,
      xeroInvoiceId: generateXeroId('INV'),
      xeroContactId: generateXeroId('CON'),
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: overdueInvoice2.id, description: 'Pressure Relief Valve', quantity: '1.00', unitPrice: '80.00', total: '80.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: overdueInvoice2.id, description: 'Labour (1 hour)', quantity: '1.00', unitPrice: '140.00', total: '140.00', sortOrder: 2 });

    // PAID INVOICES (4)
    const paidInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const paidInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Vanity Installation',
      description: 'Installed new bathroom vanity with tapware',
      status: 'paid' as const,
      subtotal: '680.00',
      gstAmount: '68.00',
      total: '748.00',
      dueDate: getDaysAgo(25),
      sentAt: getDaysAgo(40),
      paidAt: getDaysAgo(22),
      number: paidInv1Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice1.id, description: 'Vanity Installation', quantity: '1.00', unitPrice: '680.00', total: '680.00', sortOrder: 1 });

    const paidInv2Num = await storage.generateInvoiceNumber(demoUser.id);
    const paidInvoice2 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Emergency Pipe Repair',
      description: 'Repaired burst pipe under house - after hours callout',
      status: 'paid' as const,
      subtotal: '520.00',
      gstAmount: '52.00',
      total: '572.00',
      dueDate: getDaysAgo(30),
      sentAt: getDaysAgo(45),
      paidAt: getDaysAgo(28),
      number: paidInv2Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: 'After Hours Call-Out', quantity: '1.00', unitPrice: '150.00', total: '150.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: 'Pipe Repair Materials', quantity: '1.00', unitPrice: '120.00', total: '120.00', sortOrder: 2 });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice2.id, description: 'Labour (2 hours)', quantity: '2.00', unitPrice: '125.00', total: '250.00', sortOrder: 3 });

    const paidInv3Num = await storage.generateInvoiceNumber(demoUser.id);
    const paidInvoice3 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[9].id,
      title: 'Hot Water Thermostat Replacement',
      description: 'Replaced faulty thermostat on hot water system',
      status: 'paid' as const,
      subtotal: '195.00',
      gstAmount: '19.50',
      total: '214.50',
      dueDate: getDaysAgo(35),
      sentAt: getDaysAgo(50),
      paidAt: getDaysAgo(33),
      number: paidInv3Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice3.id, description: 'Thermostat', quantity: '1.00', unitPrice: '75.00', total: '75.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice3.id, description: 'Labour (1 hour)', quantity: '1.00', unitPrice: '120.00', total: '120.00', sortOrder: 2 });

    const paidInv4Num = await storage.generateInvoiceNumber(demoUser.id);
    const paidInvoice4 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Bathroom Fit-Out Complete',
      description: 'Final fix plumbing for bathroom renovation',
      status: 'paid' as const,
      subtotal: '2400.00',
      gstAmount: '240.00',
      total: '2640.00',
      dueDate: getDaysAgo(40),
      sentAt: getDaysAgo(55),
      paidAt: getDaysAgo(38),
      number: paidInv4Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: paidInvoice4.id, description: 'Final Fix Plumbing - Bathroom', quantity: '1.00', unitPrice: '2400.00', total: '2400.00', sortOrder: 1 });

    console.log('✅ 11 Demo invoices created (2 draft, 3 sent, 2 overdue, 4 paid)');

    // ============================================
    // CREATE RECEIPTS (3 for paid invoices)
    // ============================================

    await storage.createReceipt({
      userId: demoUser.id,
      invoiceId: paidInvoice1.id,
      clientId: createdClients[7].id,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}-001`,
      amount: '748.00',
      gstAmount: '68.00',
      subtotal: '680.00',
      description: 'Payment for vanity installation',
      paymentMethod: 'bank_transfer',
      paidAt: getDaysAgo(22),
    });

    await storage.createReceipt({
      userId: demoUser.id,
      invoiceId: paidInvoice2.id,
      clientId: createdClients[8].id,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}-002`,
      amount: '572.00',
      gstAmount: '52.00',
      subtotal: '520.00',
      description: 'Payment for emergency pipe repair',
      paymentMethod: 'card',
      paidAt: getDaysAgo(28),
    });

    await storage.createReceipt({
      userId: demoUser.id,
      invoiceId: paidInvoice4.id,
      clientId: createdClients[0].id,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}-003`,
      amount: '2640.00',
      gstAmount: '240.00',
      subtotal: '2400.00',
      description: 'Payment for bathroom fit-out',
      paymentMethod: 'bank_transfer',
      paidAt: getDaysAgo(38),
    });

    console.log('✅ 3 Demo receipts created for paid invoices');

    // ============================================
    // CREATE SMS CONVERSATIONS (for demo)
    // ============================================
    const existingSmsConversations = await storage.getSmsConversationsByBusiness(demoUser.id);
    if (existingSmsConversations.length === 0) {
      const smsConversations = [
        {
          businessOwnerId: demoUser.id,
          clientId: createdClients[0].id,
          clientPhone: clientsData[0].phone,
          clientName: clientsData[0].name,
          lastMessageAt: new Date(),
          unreadCount: 1,
        },
        {
          businessOwnerId: demoUser.id,
          clientId: null,
          clientPhone: '+61499888777',
          clientName: 'Unknown Caller',
          lastMessageAt: getDaysAgo(1),
          unreadCount: 1,
        },
      ];

      const createdConversations = [];
      for (const convData of smsConversations) {
        const conv = await storage.createSmsConversation(convData);
        createdConversations.push(conv);
      }

      const smsMessages = [
        {
          conversationId: createdConversations[0].id,
          direction: 'inbound' as const,
          body: 'Hi, can you come out tomorrow to look at my leaking kitchen tap? It\'s gotten worse overnight.',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'job_request' as const,
          suggestedJobTitle: 'Leaking Kitchen Tap',
          suggestedDescription: 'Customer reports kitchen tap leak has worsened. Requesting urgent visit.',
        },
        {
          conversationId: createdConversations[1].id,
          direction: 'inbound' as const,
          body: 'G\'day mate, got a burst pipe in the laundry! Water everywhere. Can you come ASAP? I\'m at 67 Grove Street Whitfield.',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'job_request' as const,
          suggestedJobTitle: 'Emergency Burst Pipe',
          suggestedDescription: 'Emergency - burst pipe in laundry causing flooding. Location: 67 Grove Street Whitfield.',
        },
      ];

      for (const msgData of smsMessages) {
        await storage.createSmsMessage(msgData);
      }

      console.log('✅ Demo SMS conversations created');
    }

    // ============================================
    // SEED TEMPLATES (if needed)
    // ============================================
    const templates = await storage.getDocumentTemplates(demoUser.id);
    if (templates.length < 15) {
      console.log('🔄 Seeding tradie templates...');
      try {
        const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');

        let templateCount = 0;
        let itemCount = 0;
        let rateCardCount = 0;

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
              defaultLineItems: template.defaultLineItems,
            });
            templateCount++;
          } catch (error) {
            // Template might already exist
          }
        }

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
              tags: [],
            });
            itemCount++;
          } catch (error) {
            // Line item might already exist
          }
        }

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
              userId: demoUser.id,
            });
            rateCardCount++;
          } catch (error) {
            // Rate card might already exist
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

// Seed SMS data for test users
export async function seedSmsDataForTestUsers() {
  try {
    const testUser = await storage.getUserByEmail('mike@northqldplumbing.com.au');
    if (!testUser) {
      console.log('No test user found for SMS demo data');
      return;
    }

    const existingSmsConversations = await storage.getSmsConversationsByBusiness(testUser.id);
    if (existingSmsConversations.length > 0) {
      console.log(`✅ Test user already has ${existingSmsConversations.length} SMS conversations`);
      return;
    }

    const clients = await storage.getClients(testUser.id);
    const firstClient = clients[0];

    const smsConversations = [
      {
        businessOwnerId: testUser.id,
        clientId: firstClient?.id || null,
        clientPhone: '+61412345678',
        clientName: firstClient?.name || 'Sarah Johnson',
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
    ];

    const createdConversations = [];
    for (const convData of smsConversations) {
      const conv = await storage.createSmsConversation(convData);
      createdConversations.push(conv);
    }

    const smsMessages = [
      {
        conversationId: createdConversations[0].id,
        direction: 'inbound' as const,
        body: 'Hi, can you come look at my hot water system? It\'s not heating properly.',
        status: 'delivered' as const,
        isJobRequest: true,
        intentConfidence: 'high' as const,
        intentType: 'quote_request' as const,
        suggestedJobTitle: 'Hot Water System Inspection',
        suggestedDescription: 'Customer reports hot water system not heating properly.',
      },
    ];

    for (const msgData of smsMessages) {
      await storage.createSmsMessage(msgData);
    }

    console.log('✅ Test user SMS demo data seeded');
  } catch (error) {
    console.error('Error seeding SMS data for test users:', error);
  }
}

// Create demo team members with location data
export async function createDemoTeamMembers() {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      console.log('No demo user found for team creation');
      return;
    }

    console.log('🔧 Setting up demo team members...');

    // Cairns QLD area locations for demo team members
    const cairnsLocations = [
      { lat: -16.9186, lng: 145.7781, address: 'Cairns City QLD 4870', status: 'working' },
      { lat: -16.9246, lng: 145.7621, address: 'Parramatta Park QLD 4870', status: 'driving' },
      { lat: -16.9073, lng: 145.7478, address: 'Edge Hill QLD 4870', status: 'online' },
      { lat: -16.9361, lng: 145.7514, address: 'Manunda QLD 4870', status: 'working' },
      { lat: -16.9147, lng: 145.7568, address: 'Cairns North QLD 4870', status: 'online' },
    ];

    // Get or create a worker role
    const existingRoles = await storage.getUserRoles();
    let workerRole = existingRoles.find(r => r.name.toLowerCase() === 'worker' || r.name.toLowerCase() === 'field worker');
    if (!workerRole) {
      workerRole = await storage.createUserRole({
        name: 'Worker',
        permissions: ['read_jobs', 'update_job_status', 'create_time_entries', 'read_clients'],
        description: 'Field worker with job access',
        isActive: true,
      });
      console.log('✅ Created Worker role for team members');
    }

    // Team member data
    const teamMemberData = [
      { name: 'Jake Morrison', email: DEMO_WORKER.email, phone: DEMO_WORKER.phone },
      { name: 'Tom Richards', email: 'tom@demoplumbing.com.au', phone: '+61412111222' },
      { name: 'Sam Cooper', email: 'sam@demoplumbing.com.au', phone: '+61412333444' },
      { name: 'Kate Williams', email: 'kate@demoplumbing.com.au', phone: '+61412555666' },
    ];

    // Check existing team members
    const existingTeam = await storage.getTeamMembers(demoUser.id);
    console.log(`ℹ️ Found ${existingTeam.length} existing team members`);

    for (let i = 0; i < teamMemberData.length; i++) {
      const memberInfo = teamMemberData[i];
      const location = cairnsLocations[i % cairnsLocations.length];
      const nameParts = memberInfo.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // Create or get user account
      let memberUser = await storage.getUserByEmail(memberInfo.email);
      if (!memberUser) {
        const hashedPassword = await bcrypt.hash('worker123', 10);
        memberUser = await storage.createUser({
          email: memberInfo.email,
          password: hashedPassword,
          name: memberInfo.name,
          firstName,
          lastName,
          phone: memberInfo.phone,
          role: 'worker',
          businessOwnerId: demoUser.id,
        });
        console.log(`✅ Created user: ${memberUser.name}`);
      }

      // Check if team member record exists
      const existingMember = existingTeam.find(m => m.memberId === memberUser!.id || m.email === memberInfo.email);
      if (!existingMember) {
        // Create team member record
        await storage.createTeamMember({
          businessOwnerId: demoUser.id,
          memberId: memberUser.id,
          roleId: workerRole.id,
          email: memberInfo.email,
          firstName,
          lastName,
          phone: memberInfo.phone,
          inviteStatus: 'accepted',
          inviteAcceptedAt: new Date(),
          isActive: true,
          allowLocationSharing: true,
          locationEnabledByOwner: true,
        });
        console.log(`✅ Registered team member: ${memberInfo.name}`);
      }

      // Create or update tradieStatus with location data for map display
      await storage.upsertTradieStatus({
        userId: memberUser.id,
        businessOwnerId: demoUser.id,
        currentLatitude: location.lat.toString(),
        currentLongitude: location.lng.toString(),
        currentAddress: location.address,
        activityStatus: location.status,
        lastSeenAt: new Date(),
        lastLocationUpdate: new Date(),
        batteryLevel: Math.floor(Math.random() * 40) + 60, // 60-100%
        isCharging: Math.random() > 0.7,
      });
      console.log(`📍 Set location for ${memberInfo.name}: ${location.address}`);
    }

    const finalTeam = await storage.getTeamMembers(demoUser.id);
    console.log(`✅ Demo team has ${finalTeam.length} members with location data`);
  } catch (error) {
    console.error('Error creating demo team members:', error);
  }
}
