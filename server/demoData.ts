import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from './storage';

// ============================================
// DEMO USER CREDENTIALS
// ============================================
export const DEMO_USER = {
  email: 'demo@tradietrack.com.au',
  password: 'demo123',
  name: 'Mike Thompson',
  businessName: "Mike's Plumbing Services",
  phone: '+61407888123',
};

export const DEMO_WORKER = {
  email: 'demo.worker@tradietrack.com.au',
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

// Get a date X months ago, with an optional day offset within that month
function getMonthsAgo(months: number, dayOfMonth: number = 15): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setDate(Math.min(dayOfMonth, 28)); // Avoid issues with shorter months
  return date;
}

// Realistic invoice data spread across 12 months for a busy tradie
// Australian FY runs July-June, so we'll spread data across the current FY
// 17 paid invoices for receipts (+ 3 non-paid invoices = 20 total invoices, 20 receipts with 3 additional cash receipts)
const MONTHLY_PAID_INVOICES = [
  // Each month has 1-2 paid invoices representing typical tradie workload
  // Month 0 = current month, Month 1 = last month, etc.
  { month: 11, title: 'Commercial Kitchen Fit-Out', description: 'Full plumbing installation for cafe kitchen', subtotal: 4850, payDay: 18 },
  { month: 10, title: 'Bathroom Renovation - Stage 1', description: 'Rough-in plumbing for master ensuite', subtotal: 3200, payDay: 12 },
  { month: 10, title: 'Gas Cooktop Installation', description: 'Connected new 5-burner gas cooktop', subtotal: 380, payDay: 22 },
  { month: 9, title: 'Blocked Sewer Main', description: 'High-pressure jetter service - tree roots removed', subtotal: 650, payDay: 8 },
  { month: 9, title: 'Rainwater Tank Connection', description: 'Connected 5000L rainwater tank to toilet and laundry', subtotal: 1850, payDay: 28 },
  { month: 8, title: 'Emergency After Hours - Burst Pipe', description: 'Weekend callout for burst copper pipe under house', subtotal: 680, payDay: 3 },
  { month: 7, title: 'New Build - Final Fix', description: 'Final fix plumbing for 4-bed residence', subtotal: 5200, payDay: 10 },
  { month: 7, title: 'Dishwasher Installation', description: 'Connected new Miele dishwasher', subtotal: 180, payDay: 24 },
  { month: 6, title: 'TMV Compliance Testing', description: 'Thermostatic mixing valve testing and certification', subtotal: 320, payDay: 5 },
  { month: 5, title: 'Gas Heater Service', description: 'Annual gas heater service and CO testing', subtotal: 195, payDay: 11 },
  { month: 5, title: 'Toilet Suite Replacement', description: 'Removed old separate and installed new close-coupled suite', subtotal: 485, payDay: 22 },
  { month: 4, title: 'Commercial Backflow Testing', description: 'Annual backflow prevention device testing - 3 devices', subtotal: 540, payDay: 7 },
  { month: 3, title: 'Shower Regrouting & Waterproofing', description: 'Complete shower base waterproofing and tile regrout', subtotal: 890, payDay: 14 },
  { month: 2, title: 'Hot Water System Service', description: 'Annual service on solar hot water system', subtotal: 245, payDay: 9 },
  { month: 2, title: 'Outdoor Shower Installation', description: 'Installed poolside outdoor shower with hot/cold mixing', subtotal: 720, payDay: 21 },
  { month: 1, title: 'Vanity Installation', description: 'Installed new bathroom vanity with tapware', subtotal: 680, payDay: 16 },
  { month: 0, title: 'Kitchen Tap Replacement', description: 'Replaced mixer tap with pull-out spray model', subtotal: 385, payDay: 3 },
];

// Counter for deterministic IDs - ensures same data in dev and production
let xeroIdCounter = 100001;
let tokenCounter = 1;

function generateXeroId(prefix: string): string {
  // Use deterministic IDs so dev and production have identical data
  return `${prefix}-${xeroIdCounter++}`;
}

function generatePaymentToken(): string {
  // Use deterministic tokens so dev and production have identical data
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const baseToken = `DEMO_TOKEN_${String(tokenCounter++).padStart(4, '0')}`;
  // Pad to 32 chars
  return baseToken.padEnd(32, 'X');
}

// Reset counters for consistent seeding
export function resetDemoCounters() {
  xeroIdCounter = 100001;
  tokenCounter = 1;
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
// HELPER: Ensure business settings and team exist without recreating data
// ============================================
async function ensureDemoBusinessAndTeam(demoUser: any) {
  // Ensure business settings exist and have GST enabled
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
      gstEnabled: true,
      qbccLicense: 'QBCC 1234567',
      insurancePolicy: 'QBE-PLB-987654',
    });
    console.log('✅ Business settings created');
  } else if (!businessSettings.gstEnabled) {
    await storage.updateBusinessSettings(demoUser.id, { gstEnabled: true });
    console.log('✅ Business settings updated: GST enabled');
  }

  // Ensure demo worker exists
  let workerUser = await storage.getUserByEmail(DEMO_WORKER.email);
  if (!workerUser) {
    const hashedWorkerPassword = await bcrypt.hash(DEMO_WORKER.password, 10);
    workerUser = await storage.createUser({
      email: DEMO_WORKER.email,
      password: hashedWorkerPassword,
      name: DEMO_WORKER.name,
      phone: DEMO_WORKER.phone,
      role: DEMO_WORKER.role,
      emailVerified: true,
    });
    console.log('✅ Demo worker user created');
  }

  // Ensure team member relationship exists
  const existingTeam = await storage.getTeamMembers(demoUser.id);
  const workerTeamMember = existingTeam.find(m => m.memberId === workerUser?.id);
  if (!workerTeamMember && workerUser) {
    await storage.createTeamMember({
      ownerId: demoUser.id,
      memberId: workerUser.id,
      role: 'worker',
      inviteStatus: 'accepted',
      isActive: true,
    });
    console.log('✅ Demo worker added to team');
  }

  // Seed default safety forms if not already present
  try {
    const existingForms = await storage.getCustomForms(demoUser.id);
    const defaultForms = existingForms.filter(f => f.isDefault);
    if (defaultForms.length === 0) {
      await storage.seedDefaultSafetyForms(demoUser.id);
      console.log('✅ Demo safety forms seeded');
    }
  } catch (err) {
    console.error('Failed to seed demo safety forms:', err);
  }
}

// ============================================
// REFRESH DEMO DATES: Update scheduled jobs to be current with today's date
// ============================================
export async function refreshDemoDates(demoUserId: string) {
  try {
    console.log('[DemoRefresh] Refreshing demo dates to keep data current...');
    
    const jobs = await storage.getJobs(demoUserId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let scheduledCount = 0;
    let inProgressCount = 0;
    
    for (const job of jobs) {
      // Update scheduled jobs to be in the near future (today + 0-5 days)
      if (job.status === 'scheduled' && job.scheduledAt) {
        const scheduledDate = new Date(job.scheduledAt);
        // Only update if the scheduled date is in the past
        if (scheduledDate < today) {
          // Spread scheduled jobs across today and the next few days
          const daysOffset = scheduledCount % 6; // 0-5 days from now
          const newScheduledAt = new Date();
          newScheduledAt.setDate(newScheduledAt.getDate() + daysOffset);
          // Keep original time of day
          newScheduledAt.setHours(
            scheduledDate.getHours() || 9,
            scheduledDate.getMinutes() || 0,
            0, 0
          );
          
          await storage.updateJob(job.id, demoUserId, {
            scheduledAt: newScheduledAt,
          });
          scheduledCount++;
        }
      }
      
      // Update in_progress jobs to have started today or yesterday
      if (job.status === 'in_progress') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(8, 0, 0, 0);
        
        // Set startedAt to yesterday for some, today for others
        const startOffset = inProgressCount % 2; // 0 or 1 days ago
        const newStartedAt = new Date();
        newStartedAt.setDate(newStartedAt.getDate() - startOffset);
        newStartedAt.setHours(8 + (inProgressCount % 3), 0, 0, 0);
        
        await storage.updateJob(job.id, demoUserId, {
          startedAt: newStartedAt,
          scheduledAt: newStartedAt,
        });
        inProgressCount++;
      }
    }
    
    console.log(`[DemoRefresh] Updated ${scheduledCount} scheduled jobs and ${inProgressCount} in-progress jobs`);
  } catch (error) {
    console.error('[DemoRefresh] Error refreshing demo dates:', error);
  }
}

// ============================================
// MAIN DEMO DATA CREATION
// ============================================

export async function createDemoUserAndData() {
  // Reset counters for deterministic IDs
  resetDemoCounters();
  
  try {
    let demoUser = await storage.getUserByEmail(DEMO_USER.email);

    if (!demoUser) {
      const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);
      demoUser = await storage.createUser({
        email: DEMO_USER.email,
        password: hashedPassword,
        name: DEMO_USER.name,
        phone: DEMO_USER.phone,
        emailVerified: true, // Demo user should be pre-verified
      });
      console.log('✅ Demo user created:', demoUser.email);
    } else {
      // Ensure demo user has correct password and email verified set
      const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);
      await storage.updateUser(demoUser.id, { 
        password: hashedPassword,
        emailVerified: true 
      });
      console.log('ℹ️ Demo user already exists:', demoUser.email);
      console.log('✅ Demo user password reset to default');
    }

    // Check for existing demo data - PRESERVE it to maintain consistent IDs across web/mobile
    const existingClients = await storage.getClients(demoUser.id);
    if (existingClients.length > 0) {
      console.log(`✅ Demo data already exists for ${demoUser.email} - preserving existing data for consistent IDs`);
      
      // Ensure business settings, team members exist but don't recreate clients/invoices/jobs/quotes
      // This keeps IDs stable across server restarts for mobile app compatibility
      await ensureDemoBusinessAndTeam(demoUser);
      
      // NOTE: Demo date refresh disabled to preserve user-modified data
      // The dates should only be set during initial demo data creation, not on every restart
      // await refreshDemoDates(demoUser.id);
      
      // Always refresh activity logs to show current data
      await createDemoActivityLogs(demoUser.id);
      
      return demoUser;
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
        gstEnabled: true,
        qbccLicense: 'QBCC 1234567',
        insurancePolicy: 'QBE-PLB-987654',
      });
      console.log('✅ Business settings created');
    } else if (!businessSettings.gstEnabled) {
      // Ensure GST is enabled for existing demo business settings
      await storage.updateBusinessSettings(demoUser.id, { gstEnabled: true });
      console.log('✅ Business settings updated: GST enabled');
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
    // CREATE 30 JOBS (with varied statuses)
    // Status distribution: 4 pending, 8 scheduled (4 today + 4 upcoming), 4 in_progress, 6 done, 5 invoiced, 3 cancelled
    // ============================================
    const createdJobs = [];

    // PENDING JOBS (4)
    const pendingJobs = [
      { clientIdx: 0, title: 'Leaking Kitchen Tap', description: 'Customer reports kitchen mixer tap dripping constantly', address: clientsData[0].address },
      { clientIdx: 1, title: 'Toilet Running Continuously', description: 'Toilet cistern not filling properly, water keeps running', address: clientsData[1].address },
      { clientIdx: 2, title: 'Blocked Bathroom Drain', description: 'Shower drain draining slowly, needs investigation', address: clientsData[2].address },
      { clientIdx: 3, title: 'Hot Water System Quote', description: 'Customer wants quote for new hot water system replacement', address: clientsData[3].address },
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

    // SCHEDULED JOBS (8) - 4 today, 4 upcoming in next days
    const scheduledJobs = [
      // 4 JOBS TODAY
      { clientIdx: 0, title: 'Annual Hot Water Service', description: 'Annual service and maintenance check', address: clientsData[0].address, scheduledAt: getTodayAt(9, 0), scheduledTime: '09:00' },
      { clientIdx: 1, title: 'Bathroom Tap Replacement', description: 'Replace old bathroom taps with new mixers', address: clientsData[1].address, scheduledAt: getTodayAt(11, 30), scheduledTime: '11:30' },
      { clientIdx: 2, title: 'Emergency Valve Check', description: 'Check and test emergency shutoff valves', address: clientsData[2].address, scheduledAt: getTodayAt(14, 0), scheduledTime: '14:00' },
      { clientIdx: 5, title: 'Dishwasher Installation', description: 'Install new Bosch dishwasher, connect to water and waste', address: clientsData[5].address, scheduledAt: getTodayAt(16, 0), scheduledTime: '16:00' },
      // 4 JOBS UPCOMING (next few days)
      { clientIdx: 6, title: 'Garden Tap Installation', description: 'Install new outdoor tap near garden shed', address: clientsData[6].address, scheduledAt: getDaysFromNow(1), scheduledTime: '09:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 7, title: 'Shower Head Replacement', description: 'Replace old shower head with water-saving model', address: clientsData[7].address, scheduledAt: getDaysFromNow(2), scheduledTime: '14:00' },
      { clientIdx: 8, title: 'Pipe Inspection', description: 'CCTV camera inspection of sewer line', address: clientsData[8].address, scheduledAt: getDaysFromNow(3), scheduledTime: '08:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 9, title: 'Water Pressure Check', description: 'Investigate low water pressure complaints', address: clientsData[9].address, scheduledAt: getDaysFromNow(4), scheduledTime: '11:00' },
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

    // IN_PROGRESS JOBS (4)
    const inProgressJobs = [
      { clientIdx: 3, title: 'Bathroom Renovation Plumbing', description: 'Full bathroom rough-in for renovation', address: clientsData[3].address, startedAt: getDaysAgo(2) },
      { clientIdx: 4, title: 'Hot Water System Replacement', description: 'Replacing old electric HWS with heat pump', address: clientsData[4].address, startedAt: getDaysAgo(1) },
      { clientIdx: 5, title: 'Kitchen Sink Installation', description: 'Installing new undermount kitchen sink', address: clientsData[5].address, startedAt: getDaysAgo(0) },
      { clientIdx: 6, title: 'Gas Line Extension', description: 'Extending gas line to new BBQ area', address: clientsData[6].address, startedAt: getDaysAgo(3), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
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

    // DONE JOBS (6) - completed but not yet invoiced
    const doneJobs = [
      { clientIdx: 0, title: 'Tap Washer Replacement', description: 'Replaced washers on 3 taps', address: clientsData[0].address, completedAt: getDaysAgo(1) },
      { clientIdx: 1, title: 'Toilet Cistern Repair', description: 'Replaced flush valve and fill valve', address: clientsData[1].address, completedAt: getDaysAgo(2) },
      { clientIdx: 2, title: 'Drain Unblocking', description: 'Cleared blocked laundry drain', address: clientsData[2].address, completedAt: getDaysAgo(3) },
      { clientIdx: 3, title: 'Gas Appliance Service', description: 'Annual service of gas heater', address: clientsData[3].address, completedAt: getDaysAgo(4) },
      { clientIdx: 4, title: 'Shower Mixer Replacement', description: 'Installed new thermostatic shower mixer', address: clientsData[4].address, completedAt: getDaysAgo(5), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 5, title: 'Outdoor Tap Repair', description: 'Fixed leaking garden tap', address: clientsData[5].address, completedAt: getDaysAgo(6) },
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

    // INVOICED JOBS (5) - with complete journey dates (scheduled -> started -> completed -> invoiced)
    const invoicedJobs = [
      { clientIdx: 8, title: 'Emergency Pipe Repair', description: 'Repaired burst pipe under house', address: clientsData[8].address, scheduledAt: getDaysAgo(12), startedAt: getDaysAgo(11), completedAt: getDaysAgo(10), invoicedAt: getDaysAgo(9) },
      { clientIdx: 9, title: 'Hot Water Thermostat', description: 'Replaced faulty thermostat on HWS', address: clientsData[9].address, scheduledAt: getDaysAgo(14), startedAt: getDaysAgo(13), completedAt: getDaysAgo(12), invoicedAt: getDaysAgo(11) },
      { clientIdx: 0, title: 'Bathroom Fit-Out Complete', description: 'Final fix plumbing for bathroom reno', address: clientsData[0].address, scheduledAt: getDaysAgo(17), startedAt: getDaysAgo(16), completedAt: getDaysAgo(15), invoicedAt: getDaysAgo(14) },
      { clientIdx: 1, title: 'Kitchen Plumbing Upgrade', description: 'Upgraded kitchen plumbing for renovation', address: clientsData[1].address, scheduledAt: getDaysAgo(20), startedAt: getDaysAgo(19), completedAt: getDaysAgo(18), invoicedAt: getDaysAgo(17) },
      { clientIdx: 2, title: 'Gas Compliance Certificate', description: 'Annual gas safety inspection', address: clientsData[2].address, scheduledAt: getDaysAgo(22), startedAt: getDaysAgo(21), completedAt: getDaysAgo(20), invoicedAt: getDaysAgo(19) },
    ];

    for (const job of invoicedJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'invoiced',
        scheduledAt: job.scheduledAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        invoicedAt: job.invoicedAt,
        estimatedDuration: 90,
      });
      createdJobs.push(createdJob);
    }

    // CANCELLED JOBS (3)
    const cancelledJobs = [
      { clientIdx: 6, title: 'Pool Pump Repair', description: 'Customer cancelled - sold the house', address: clientsData[6].address, cancellationReason: 'Customer sold property before work could commence' },
      { clientIdx: 7, title: 'Solar Hot Water Install', description: 'Customer went with competitor quote', address: clientsData[7].address, cancellationReason: 'Customer accepted lower quote from competitor' },
      { clientIdx: 8, title: 'Grease Trap Replacement', description: 'Commercial job - restaurant closed', address: clientsData[8].address, cancellationReason: 'Restaurant permanently closed' },
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

    console.log(`✅ ${createdJobs.length} Demo jobs created (4 pending, 8 scheduled [4 today], 4 in_progress, 6 done, 5 invoiced, 3 cancelled)`);

    // ============================================
    // CREATE QUOTES (25 total: 4 draft, 9 sent, 7 accepted, 5 rejected)
    // With line items for proper preview display
    // ============================================

    // Helper function to create quote with line items
    const createQuoteWithLineItems = async (
      quoteData: Parameters<typeof storage.createQuote>[0],
      lineItems: Array<{ description: string; quantity: string; unitPrice: string; total: string }>
    ) => {
      const quote = await storage.createQuote(quoteData);
      for (let i = 0; i < lineItems.length; i++) {
        await storage.createQuoteLineItem({
          quoteId: quote.id,
          description: lineItems[i].description,
          quantity: lineItems[i].quantity,
          unitPrice: lineItems[i].unitPrice,
          total: lineItems[i].total,
          sortOrder: i,
        });
      }
      return quote;
    };

    // DRAFT QUOTES (4)
    const draft1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
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
    }, [
      { description: 'Rough-in plumbing - shower, toilet, vanity', quantity: '1', unitPrice: '1800.00', total: '1800.00' },
      { description: 'Supply and install new toilet', quantity: '1', unitPrice: '650.00', total: '650.00' },
      { description: 'Supply and install vanity basin mixer', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Labour - fit-out and connections', quantity: '4', unitPrice: '100.00', total: '400.00' },
    ]);

    const draft2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
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
    }, [
      { description: 'Reclaim 315L Heat Pump Hot Water System', quantity: '1', unitPrice: '3200.00', total: '3200.00' },
      { description: 'Removal and disposal of old hot water system', quantity: '1', unitPrice: '250.00', total: '250.00' },
      { description: 'Plumbing connections and commissioning', quantity: '1', unitPrice: '650.00', total: '650.00' },
      { description: 'Electrical connection (by licensed electrician)', quantity: '1', unitPrice: '400.00', total: '400.00' },
    ]);

    const draft3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Granny Flat Plumbing Package',
      description: 'Complete plumbing for new granny flat build',
      status: 'draft' as const,
      subtotal: '8500.00',
      gstAmount: '850.00',
      total: '9350.00',
      validUntil: getDaysFromNow(30),
      number: draft3Num,
    }, [
      { description: 'Rough-in plumbing (bathroom, kitchen, laundry)', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Hot water system supply and install', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Fit-out and fixtures', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
    ]);

    const draft4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Pool Plumbing Installation',
      description: 'New pool plumbing including pump and filtration connections',
      status: 'draft' as const,
      subtotal: '2800.00',
      gstAmount: '280.00',
      total: '3080.00',
      validUntil: getDaysFromNow(30),
      number: draft4Num,
    }, [
      { description: 'Pool pump and filter connections', quantity: '1', unitPrice: '1800.00', total: '1800.00' },
      { description: 'Backwash line installation', quantity: '1', unitPrice: '600.00', total: '600.00' },
      { description: 'Testing and commissioning', quantity: '1', unitPrice: '400.00', total: '400.00' },
    ]);

    // SENT QUOTES (9)
    const sent1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
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
    }, [
      { description: 'Relocate sink waste and water supply', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Install dishwasher connection', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Supply and install kitchen mixer tap', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Miscellaneous fittings and materials', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const sent2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[5].id,
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
    }, [
      { description: 'Run 15m gas line from meter to BBQ area', quantity: '1', unitPrice: '580.00', total: '580.00' },
      { description: 'Gas bayonet fitting with isolation valve', quantity: '1', unitPrice: '220.00', total: '220.00' },
      { description: 'Pressure test and compliance certificate', quantity: '1', unitPrice: '180.00', total: '180.00' },
    ]);

    const sent3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Ensuite Addition Plumbing',
      description: 'Complete plumbing for new ensuite bathroom',
      status: 'sent' as const,
      subtotal: '5600.00',
      gstAmount: '560.00',
      total: '6160.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(7),
      number: sent3Num,
    }, [
      { description: 'Rough-in plumbing for ensuite (shower, toilet, vanity)', quantity: '1', unitPrice: '2400.00', total: '2400.00' },
      { description: 'Supply and install frameless shower screen', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
      { description: 'Wall-hung vanity and basin package', quantity: '1', unitPrice: '1100.00', total: '1100.00' },
      { description: 'Wall-hung toilet with concealed cistern', quantity: '1', unitPrice: '900.00', total: '900.00' },
    ]);

    const sent4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Commercial Kitchen Fit-Out',
      description: 'Full plumbing for new cafe kitchen',
      status: 'sent' as const,
      subtotal: '12500.00',
      gstAmount: '1250.00',
      total: '13750.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(4),
      number: sent4Num,
    }, [
      { description: 'Grease trap supply and installation', quantity: '1', unitPrice: '3500.00', total: '3500.00' },
      { description: 'Commercial sink connections (3 sinks)', quantity: '3', unitPrice: '1200.00', total: '3600.00' },
      { description: 'Gas connections for cooking equipment', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Hot water system upgrade', quantity: '1', unitPrice: '2600.00', total: '2600.00' },
    ]);

    const sent5Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Stormwater Drainage System',
      description: 'New stormwater drainage for property',
      status: 'sent' as const,
      subtotal: '4200.00',
      gstAmount: '420.00',
      total: '4620.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(6),
      number: sent5Num,
    }, [
      { description: 'Excavation and trenching', quantity: '1', unitPrice: '1500.00', total: '1500.00' },
      { description: 'PVC stormwater pipe supply and install', quantity: '30', unitPrice: '45.00', total: '1350.00' },
      { description: 'Stormwater pits (2)', quantity: '2', unitPrice: '450.00', total: '900.00' },
      { description: 'Connection to council drain', quantity: '1', unitPrice: '450.00', total: '450.00' },
    ]);

    const sent6Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[9].id,
      title: 'Rainwater Tank System',
      description: 'Supply and install 10,000L rainwater tank with pump',
      status: 'sent' as const,
      subtotal: '5800.00',
      gstAmount: '580.00',
      total: '6380.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(2),
      number: sent6Num,
    }, [
      { description: '10,000L poly rainwater tank', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Tank pump and pressure controller', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
      { description: 'Connection to downpipes', quantity: '1', unitPrice: '800.00', total: '800.00' },
      { description: 'Connection to toilets and laundry', quantity: '1', unitPrice: '1000.00', total: '1000.00' },
    ]);

    const sent7Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Spa Bath Installation',
      description: 'Install new spa bath with plumbing connections',
      status: 'sent' as const,
      subtotal: '1950.00',
      gstAmount: '195.00',
      total: '2145.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(8),
      number: sent7Num,
    }, [
      { description: 'Spa bath plumbing rough-in', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Waste and overflow connections', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Hot and cold water supply', quantity: '1', unitPrice: '650.00', total: '650.00' },
    ]);

    const sent8Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Backflow Prevention Upgrade',
      description: 'Install testable backflow prevention devices',
      status: 'sent' as const,
      subtotal: '1450.00',
      gstAmount: '145.00',
      total: '1595.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(1),
      number: sent8Num,
    }, [
      { description: 'Reduced pressure zone device', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Installation and testing', quantity: '1', unitPrice: '400.00', total: '400.00' },
      { description: 'Compliance certification', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const sent9Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Water Softener Installation',
      description: 'Whole house water softener system',
      status: 'sent' as const,
      subtotal: '3200.00',
      gstAmount: '320.00',
      total: '3520.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(9),
      number: sent9Num,
    }, [
      { description: 'Water softener unit', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Installation and plumbing', quantity: '1', unitPrice: '750.00', total: '750.00' },
      { description: 'Bypass valve installation', quantity: '1', unitPrice: '250.00', total: '250.00' },
    ]);

    // ACCEPTED QUOTES (7)
    const accepted1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
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
    }, [
      { description: 'Run hot and cold water lines to outdoor area', quantity: '1', unitPrice: '550.00', total: '550.00' },
      { description: 'Outdoor shower mixer and head (marine grade)', quantity: '1', unitPrice: '380.00', total: '380.00' },
      { description: 'Drainage connection to stormwater', quantity: '1', unitPrice: '270.00', total: '270.00' },
    ]);

    const accepted2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
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
    }, [
      { description: 'Relocate washing machine taps and waste', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Supply and install stainless steel laundry trough', quantity: '1', unitPrice: '580.00', total: '580.00' },
      { description: 'Install new laundry mixer tap', quantity: '1', unitPrice: '320.00', total: '320.00' },
      { description: 'Connect to existing drainage', quantity: '1', unitPrice: '300.00', total: '300.00' },
    ]);

    const accepted3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Gas Heater Installation',
      description: 'Supply and install new gas heater',
      status: 'accepted' as const,
      subtotal: '2400.00',
      gstAmount: '240.00',
      total: '2640.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(12),
      acceptedAt: getDaysAgo(8),
      acceptedBy: 'David Chen',
      number: accepted3Num,
    }, [
      { description: 'Gas heater unit supply', quantity: '1', unitPrice: '1600.00', total: '1600.00' },
      { description: 'Gas connection and flue installation', quantity: '1', unitPrice: '600.00', total: '600.00' },
      { description: 'Compliance certificate', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const accepted4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Toilet Suite Upgrade',
      description: 'Replace 3 toilet suites throughout house',
      status: 'accepted' as const,
      subtotal: '2850.00',
      gstAmount: '285.00',
      total: '3135.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(11),
      acceptedAt: getDaysAgo(6),
      acceptedBy: 'Sarah Mitchell',
      number: accepted4Num,
    }, [
      { description: 'Close-coupled toilet suites (3)', quantity: '3', unitPrice: '750.00', total: '2250.00' },
      { description: 'Removal of old toilets', quantity: '3', unitPrice: '100.00', total: '300.00' },
      { description: 'Installation labour', quantity: '3', unitPrice: '100.00', total: '300.00' },
    ]);

    const accepted5Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Kitchen Mixer Replacement',
      description: 'Supply and install new pull-out kitchen mixer',
      status: 'accepted' as const,
      subtotal: '580.00',
      gstAmount: '58.00',
      total: '638.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(5),
      acceptedAt: getDaysAgo(3),
      acceptedBy: 'Peter Johnson',
      number: accepted5Num,
    }, [
      { description: 'Grohe pull-out kitchen mixer', quantity: '1', unitPrice: '420.00', total: '420.00' },
      { description: 'Installation and testing', quantity: '1', unitPrice: '160.00', total: '160.00' },
    ]);

    const accepted6Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Shower Screen Door Seal',
      description: 'Replace shower base and reseal',
      status: 'accepted' as const,
      subtotal: '1100.00',
      gstAmount: '110.00',
      total: '1210.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(9),
      acceptedAt: getDaysAgo(5),
      acceptedBy: 'Amanda White',
      number: accepted6Num,
    }, [
      { description: 'Remove existing tiles and waterproofing', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Apply new waterproofing membrane', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Retile shower base', quantity: '1', unitPrice: '300.00', total: '300.00' },
    ]);

    const accepted7Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[9].id,
      title: 'Downpipe Replacement',
      description: 'Replace damaged downpipes on house',
      status: 'accepted' as const,
      subtotal: '890.00',
      gstAmount: '89.00',
      total: '979.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(7),
      acceptedAt: getDaysAgo(4),
      acceptedBy: 'Chris Taylor',
      number: accepted7Num,
    }, [
      { description: 'Remove old downpipes', quantity: '1', unitPrice: '200.00', total: '200.00' },
      { description: 'Supply and install new PVC downpipes', quantity: '4', unitPrice: '120.00', total: '480.00' },
      { description: 'Connection to stormwater', quantity: '1', unitPrice: '210.00', total: '210.00' },
    ]);

    // REJECTED QUOTES (5)
    const rejected1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Whole House Repipe',
      description: 'Replace all copper pipes with PEX throughout house',
      status: 'rejected' as const,
      subtotal: '12000.00',
      gstAmount: '1200.00',
      total: '13200.00',
      validUntil: getDaysAgo(5),
      sentAt: getDaysAgo(20),
      number: rejected1Num,
    }, [
      { description: 'Remove existing copper piping throughout house', quantity: '1', unitPrice: '2500.00', total: '2500.00' },
      { description: 'Install new PEX piping system (whole house)', quantity: '1', unitPrice: '6500.00', total: '6500.00' },
      { description: 'New main water shutoff valve', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Pressure test and compliance', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Make good - patch walls and ceilings', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
    ]);

    const rejected2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Solar Hot Water System',
      description: 'Supply and install rooftop solar hot water system',
      status: 'rejected' as const,
      subtotal: '8500.00',
      gstAmount: '850.00',
      total: '9350.00',
      validUntil: getDaysAgo(10),
      sentAt: getDaysAgo(30),
      number: rejected2Num,
    }, [
      { description: 'Solar collector panels (2 x 2m)', quantity: '2', unitPrice: '1800.00', total: '3600.00' },
      { description: 'Solar storage tank 315L', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Mounting frame and hardware', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Plumbing connections and pump', quantity: '1', unitPrice: '950.00', total: '950.00' },
      { description: 'Installation labour (full day)', quantity: '1', unitPrice: '900.00', total: '900.00' },
    ]);

    const rejected3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Sewer Line Replacement',
      description: 'Replace old terracotta sewer line with PVC',
      status: 'rejected' as const,
      subtotal: '6500.00',
      gstAmount: '650.00',
      total: '7150.00',
      validUntil: getDaysAgo(15),
      sentAt: getDaysAgo(25),
      number: rejected3Num,
    }, [
      { description: 'Excavation and trenching (25m)', quantity: '1', unitPrice: '2500.00', total: '2500.00' },
      { description: 'PVC sewer pipe supply and install', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Connection to main sewer', quantity: '1', unitPrice: '800.00', total: '800.00' },
      { description: 'Backfill and restoration', quantity: '1', unitPrice: '1000.00', total: '1000.00' },
    ]);

    const rejected4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Luxury Bathroom Package',
      description: 'High-end bathroom renovation with premium fixtures',
      status: 'rejected' as const,
      subtotal: '18500.00',
      gstAmount: '1850.00',
      total: '20350.00',
      validUntil: getDaysAgo(8),
      sentAt: getDaysAgo(22),
      number: rejected4Num,
    }, [
      { description: 'Complete strip-out and waterproofing', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Premium freestanding bath', quantity: '1', unitPrice: '5500.00', total: '5500.00' },
      { description: 'Walk-in shower with rain head', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Dual vanity with stone top', quantity: '1', unitPrice: '4000.00', total: '4000.00' },
    ]);

    const rejected5Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Grey Water System',
      description: 'Install grey water recycling system',
      status: 'rejected' as const,
      subtotal: '7200.00',
      gstAmount: '720.00',
      total: '7920.00',
      validUntil: getDaysAgo(12),
      sentAt: getDaysAgo(28),
      number: rejected5Num,
    }, [
      { description: 'Grey water treatment system', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Diversion plumbing from bathroom/laundry', quantity: '1', unitPrice: '1500.00', total: '1500.00' },
      { description: 'Garden irrigation connections', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
    ]);

    console.log('✅ 25 Demo quotes created (4 draft, 9 sent, 7 accepted, 5 rejected)');

    // ============================================
    // CREATE INVOICES (20 total: 1 draft, 1 sent, 1 overdue, 17 paid)
    // ============================================

    // DRAFT INVOICE (1)
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

    // SENT INVOICE (1) - with online payment enabled
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

    // OVERDUE INVOICE (1) - also has online payment enabled
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

    // PAID INVOICES - Spread across 12 months for realistic reporting
    const paymentMethods = ['bank_transfer', 'card', 'cash', 'eftpos'] as const;
    const createdPaidInvoices: { invoice: any; invoiceData: typeof MONTHLY_PAID_INVOICES[0] }[] = [];
    
    for (let i = 0; i < MONTHLY_PAID_INVOICES.length; i++) {
      const invoiceData = MONTHLY_PAID_INVOICES[i];
      const gstAmount = invoiceData.subtotal * 0.1; // 10% GST
      const total = invoiceData.subtotal + gstAmount;
      const paidAt = getMonthsAgo(invoiceData.month, invoiceData.payDay);
      const sentAt = new Date(paidAt);
      sentAt.setDate(sentAt.getDate() - 14); // Sent 2 weeks before payment
      const dueAt = new Date(paidAt);
      dueAt.setDate(dueAt.getDate() + 7); // Due 1 week after payment (already paid)
      
      const invNum = await storage.generateInvoiceNumber(demoUser.id);
      const clientIndex = i % createdClients.length;
      
      const invoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[clientIndex].id,
        title: invoiceData.title,
        description: invoiceData.description,
        status: 'paid' as const,
        subtotal: invoiceData.subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: total.toFixed(2),
        dueDate: dueAt,
        sentAt: sentAt,
        paidAt: paidAt,
        number: invNum,
      });
      
      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: invoiceData.title,
        quantity: '1.00',
        unitPrice: invoiceData.subtotal.toFixed(2),
        total: invoiceData.subtotal.toFixed(2),
        sortOrder: 1
      });
      
      createdPaidInvoices.push({ invoice, invoiceData });
    }

    console.log(`✅ ${3 + MONTHLY_PAID_INVOICES.length} Demo invoices created (1 draft, 1 sent, 1 overdue, ${MONTHLY_PAID_INVOICES.length} paid across 12 months)`);

    // ============================================
    // CREATE RECEIPTS (20 total: 17 from paid invoices + 3 cash receipts)
    // ============================================

    for (let i = 0; i < createdPaidInvoices.length; i++) {
      const { invoice, invoiceData } = createdPaidInvoices[i];
      const gstAmount = invoiceData.subtotal * 0.1;
      const total = invoiceData.subtotal + gstAmount;
      const paidAt = getMonthsAgo(invoiceData.month, invoiceData.payDay);
      const clientIndex = i % createdClients.length;
      
      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: invoice.id,
        clientId: createdClients[clientIndex].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(3, '0')}`,
        amount: total.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: invoiceData.subtotal.toFixed(2),
        description: `Payment for ${invoiceData.title.toLowerCase()}`,
        paymentMethod: paymentMethods[i % paymentMethods.length],
        paidAt: paidAt,
      });
    }

    // Additional cash receipts (3) for small jobs without formal invoices
    const cashReceiptsData = [
      { clientIdx: 7, description: 'Cash payment for emergency tap washer', subtotal: 75, daysAgo: 15 },
      { clientIdx: 8, description: 'Cash payment for blocked drain clearing', subtotal: 120, daysAgo: 22 },
      { clientIdx: 9, description: 'Cash payment for toilet repair', subtotal: 95, daysAgo: 30 },
    ];

    for (let i = 0; i < cashReceiptsData.length; i++) {
      const receiptData = cashReceiptsData[i];
      const gstAmount = receiptData.subtotal * 0.1;
      const total = receiptData.subtotal + gstAmount;
      
      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: null,
        clientId: createdClients[receiptData.clientIdx].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-${String(MONTHLY_PAID_INVOICES.length + i + 1).padStart(3, '0')}`,
        amount: total.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: receiptData.subtotal.toFixed(2),
        description: receiptData.description,
        paymentMethod: 'cash',
        paidAt: getDaysAgo(receiptData.daysAgo),
      });
    }

    console.log(`✅ 20 Demo receipts created (17 from paid invoices + 3 cash receipts)`);

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
    const existingJobTemplates = templates.filter(t => t.type === 'job');
    const needsSeeding = templates.length < 15 || existingJobTemplates.length < 10;
    
    if (needsSeeding) {
      console.log('🔄 Seeding tradie templates...');
      try {
        const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');

        let templateCount = 0;
        let itemCount = 0;
        let rateCardCount = 0;

        // Get existing family keys to avoid duplicates
        const existingFamilyKeys = new Set(templates.map(t => `${t.type}-${t.familyKey}`));

        for (const template of tradieQuoteTemplates) {
          const key = `${template.type}-${template.familyKey}`;
          if (existingFamilyKeys.has(key)) continue;
          
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

        console.log(`✅ Templates seeded: ${templateCount} new templates, ${itemCount} line items, ${rateCardCount} rate cards`);
      } catch (error) {
        console.error('Error seeding templates:', error);
      }
    } else {
      console.log(`✅ Templates already exist: ${templates.length} templates (${existingJobTemplates.length} job templates)`);
    }

    // ============================================
    // CREATE ACTIVITY LOGS for Recent Activity
    // ============================================
    await createDemoActivityLogs(demoUser.id);

    return demoUser;
  } catch (error) {
    console.error('Error setting up demo data:', error);
    return null;
  }
}

// Helper function to seed templates for any user
export async function seedTemplatesForUser(userId: string) {
  try {
    const templates = await storage.getDocumentTemplates(userId);
    const existingJobTemplates = templates.filter(t => t.type === 'job');
    
    if (existingJobTemplates.length >= 10) {
      return; // User already has enough job templates
    }
    
    console.log(`🔄 Seeding templates for user ${userId}...`);
    const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');
    
    let templateCount = 0;
    const existingFamilyKeys = new Set(templates.map(t => `${t.type}-${t.familyKey}`));
    
    for (const template of tradieQuoteTemplates) {
      const key = `${template.type}-${template.familyKey}`;
      if (existingFamilyKeys.has(key)) continue;
      
      try {
        await storage.createDocumentTemplate({
          type: template.type,
          familyKey: template.familyKey,
          name: template.name,
          tradeType: template.tradeType,
          userId: userId,
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
    
    if (templateCount > 0) {
      console.log(`✅ Seeded ${templateCount} templates for user`);
    }
  } catch (error) {
    console.error('Error seeding templates for user:', error);
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
    
    // Seed templates for test user if missing
    await seedTemplatesForUser(testUser.id);

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
      // Use deterministic battery levels based on index for consistency between dev and production
      const batteryLevels = [85, 72, 91, 68, 78, 65, 82, 55, 88, 75];
      const batteryLevel = batteryLevels[i % batteryLevels.length];
      
      await storage.upsertTradieStatus({
        userId: memberUser.id,
        businessOwnerId: demoUser.id,
        currentLatitude: location.lat.toString(),
        currentLongitude: location.lng.toString(),
        currentAddress: location.address,
        activityStatus: location.status,
        lastSeenAt: new Date(),
        lastLocationUpdate: new Date(),
        batteryLevel,
        isCharging: batteryLevel > 80,
      });
      console.log(`📍 Set location for ${memberInfo.name}: ${location.address}`);
    }

    const finalTeam = await storage.getTeamMembers(demoUser.id);
    console.log(`✅ Demo team has ${finalTeam.length} members with location data`);
  } catch (error) {
    console.error('Error creating demo team members:', error);
  }
}

// Keep demo team members "alive" by periodically updating their activity timestamps
// This simulates real mobile app usage and keeps web/mobile data in sync
// Uses deterministic values so dev and production stay in sync
export async function refreshDemoTeamActivity() {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) return;

    const teamMembers = await storage.getTeamMembers(demoUser.id);
    const activeMembers = teamMembers.filter(m => m.inviteStatus === 'accepted' && m.isActive);

    // Cairns QLD area - deterministic locations for each team member slot
    const memberLocations = [
      { lat: -16.9186, lng: 145.7781, status: 'working', battery: 85, speed: 0 },
      { lat: -16.9246, lng: 145.7621, status: 'driving', battery: 72, speed: 12 },
      { lat: -16.9073, lng: 145.7478, status: 'online', battery: 91, speed: 0 },
      { lat: -16.9361, lng: 145.7514, status: 'working', battery: 68, speed: 0 },
      { lat: -16.9120, lng: 145.7680, status: 'working', battery: 78, speed: 0 },
      { lat: -16.9200, lng: 145.7550, status: 'online', battery: 65, speed: 0 },
      { lat: -16.9280, lng: 145.7700, status: 'driving', battery: 82, speed: 14 },
      { lat: -16.9150, lng: 145.7600, status: 'idle', battery: 55, speed: 0 },
    ];

    // Fixed number of active members (8) for consistency between dev and production
    const activeCount = Math.min(8, activeMembers.length);

    // Sort by member ID for deterministic ordering
    const sortedMembers = [...activeMembers].sort((a, b) => 
      (a.memberId || '').localeCompare(b.memberId || '')
    );

    for (let i = 0; i < sortedMembers.length; i++) {
      const member = sortedMembers[i];
      if (!member.memberId) continue;

      const location = memberLocations[i % memberLocations.length];
      const isOnline = i < activeCount;

      const activityStatus = isOnline ? location.status : 'offline';

      await storage.upsertTradieStatus({
        userId: member.memberId,
        businessOwnerId: demoUser.id,
        currentLatitude: location.lat.toString(),
        currentLongitude: location.lng.toString(),
        currentAddress: location.status === 'working' ? 'On job site' : undefined,
        activityStatus,
        speed: location.speed.toString(),
        heading: activityStatus === 'driving' ? '180' : undefined,
        lastSeenAt: isOnline ? new Date() : new Date(Date.now() - 30 * 60 * 1000),
        lastLocationUpdate: isOnline ? new Date() : undefined,
        batteryLevel: location.battery,
        isCharging: location.battery > 80,
      });
    }

    console.log(`[DemoRefresh] Updated ${activeCount} active team members`);
  } catch (error) {
    console.error('[DemoRefresh] Error refreshing demo team activity:', error);
  }
}

// Start the demo data refresh scheduler (every 5 minutes)
export function startDemoDataRefreshScheduler() {
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  console.log('[DemoScheduler] Starting demo data refresh scheduler...');
  
  // Initial refresh immediately
  refreshDemoTeamActivity();
  
  // Then refresh every 5 minutes
  setInterval(() => {
    refreshDemoTeamActivity();
  }, REFRESH_INTERVAL);
  
  console.log('[DemoScheduler] Demo data refresh scheduler running every 5 minutes');
}

// ============================================
// FORCE RESET: Delete all demo data and recreate
// ============================================
export async function forceResetDemoData(): Promise<{ success: boolean; message: string }> {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      return { success: false, message: 'Demo user not found' };
    }

    console.log('[DemoReset] Force resetting all demo data...');

    // Delete existing data in correct order (foreign key constraints)
    const existingReceipts = await storage.getReceipts(demoUser.id);
    for (const receipt of existingReceipts) {
      await storage.deleteReceipt(receipt.id, demoUser.id);
    }
    
    const existingJobs = await storage.getJobs(demoUser.id);
    for (const job of existingJobs) {
      await storage.deleteJob(job.id, demoUser.id);
    }

    const existingQuotes = await storage.getQuotes(demoUser.id);
    for (const quote of existingQuotes) {
      await storage.deleteQuote(quote.id, demoUser.id);
    }

    const existingInvoices = await storage.getInvoices(demoUser.id);
    for (const invoice of existingInvoices) {
      await storage.deleteInvoice(invoice.id, demoUser.id);
    }

    const existingClients = await storage.getClients(demoUser.id);
    for (const client of existingClients) {
      await storage.deleteClient(client.id, demoUser.id);
    }

    // Also delete existing activity logs
    const deletedLogsCount = await storage.deleteActivityLogs(demoUser.id);
    console.log(`[DemoReset] Deleted ${deletedLogsCount} activity logs`);

    console.log('[DemoReset] Existing demo data deleted, recreating...');

    // Reset counters for deterministic IDs
    resetDemoCounters();
    
    // Now call the main function which will create fresh data since there are no clients
    // This also creates activity logs at the end, so no need to call createDemoActivityLogs separately
    await createDemoUserAndData();

    return { success: true, message: 'Demo data reset complete. All clients, jobs, quotes, invoices, and receipts have been recreated with new IDs.' };
  } catch (error: any) {
    console.error('[DemoReset] Error resetting demo data:', error);
    return { success: false, message: error.message || 'Failed to reset demo data' };
  }
}

// ============================================
// CREATE ACTIVITY LOGS: Generate Recent Activity items from existing data
// ============================================
export async function createDemoActivityLogs(userId: string): Promise<void> {
  try {
    console.log('[DemoActivity] Creating activity logs for Recent Activity...');
    
    // Get recent jobs, quotes, and invoices
    const jobs = await storage.getJobs(userId);
    const quotes = await storage.getQuotes(userId);
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    // Create a client lookup map
    const clientMap = new Map(clients.map(c => [c.id, c]));
    
    const activityItems: Array<{
      userId: string;
      type: string;
      title: string;
      description: string;
      entityType: string;
      entityId: string;
      metadata: any;
      createdAt: Date;
    }> = [];
    
    // Add recent jobs (completed, scheduled, in progress)
    const recentJobs = jobs
      .filter(j => j.status !== 'cancelled')
      .sort((a, b) => {
        const dateA = a.completedAt || a.scheduledAt || a.createdAt;
        const dateB = b.completedAt || b.scheduledAt || b.createdAt;
        return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
      })
      .slice(0, 8);
    
    for (const job of recentJobs) {
      const client = clientMap.get(job.clientId!);
      let type = 'job';
      let title = job.title;
      let eventDate = job.createdAt || new Date();
      
      if (job.status === 'done' || job.status === 'invoiced') {
        type = 'job_completed';
        title = `Job Completed: ${job.title}`;
        eventDate = job.completedAt || job.createdAt || new Date();
      } else if (job.status === 'scheduled') {
        type = 'job_scheduled';
        title = `Job Scheduled: ${job.title}`;
        eventDate = job.scheduledAt || job.createdAt || new Date();
      } else if (job.status === 'in_progress') {
        type = 'job_started';
        title = `Job Started: ${job.title}`;
        eventDate = job.startedAt || job.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `For ${client.name}` : '',
        entityType: 'job',
        entityId: job.id,
        metadata: { clientName: client?.name, status: job.status },
        createdAt: eventDate,
      });
    }
    
    // Add journey activities for invoiced jobs (showing full workflow)
    const invoicedJobsWithJourney = jobs
      .filter(j => j.status === 'invoiced' && j.scheduledAt && j.startedAt && j.completedAt)
      .slice(0, 3); // Just show 3 complete journeys
    
    for (const job of invoicedJobsWithJourney) {
      const client = clientMap.get(job.clientId!);
      
      // Add scheduled activity
      if (job.scheduledAt) {
        activityItems.push({
          userId,
          type: 'job_scheduled',
          title: `Job Scheduled: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'scheduled', journey: true },
          createdAt: job.scheduledAt,
        });
      }
      
      // Add started activity
      if (job.startedAt) {
        activityItems.push({
          userId,
          type: 'job_started',
          title: `Job Started: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'in_progress', journey: true },
          createdAt: job.startedAt,
        });
      }
      
      // Add completed activity  
      if (job.completedAt) {
        activityItems.push({
          userId,
          type: 'job_completed',
          title: `Job Completed: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'done', journey: true },
          createdAt: job.completedAt,
        });
      }
    }
    
    // Add recent quotes
    const recentQuotes = quotes
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6);
    
    for (const quote of recentQuotes) {
      const client = clientMap.get(quote.clientId!);
      let type = 'quote';
      let title = `Quote #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
      let eventDate = quote.createdAt || new Date();
      
      if (quote.status === 'accepted') {
        type = 'quote_accepted';
        title = `Quote Accepted: #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
        eventDate = quote.acceptedAt || quote.createdAt || new Date();
      } else if (quote.status === 'sent') {
        type = 'quote_sent';
        title = `Quote Sent: #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
        eventDate = quote.sentAt || quote.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `To ${client.name} - $${quote.total}` : `$${quote.total}`,
        entityType: 'quote',
        entityId: quote.id,
        metadata: { clientName: client?.name, total: quote.total, status: quote.status },
        createdAt: eventDate,
      });
    }
    
    // Add recent invoices
    const recentInvoices = invoices
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6);
    
    for (const invoice of recentInvoices) {
      const client = clientMap.get(invoice.clientId!);
      let type = 'invoice';
      let title = `Invoice #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
      let eventDate = invoice.createdAt || new Date();
      
      if (invoice.status === 'paid') {
        type = 'invoice_paid';
        title = `Invoice Paid: #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
        eventDate = invoice.paidAt || invoice.createdAt || new Date();
      } else if (invoice.status === 'sent') {
        type = 'invoice_sent';
        title = `Invoice Sent: #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
        eventDate = invoice.sentAt || invoice.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `To ${client.name} - $${invoice.total}` : `$${invoice.total}`,
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: { clientName: client?.name, total: invoice.total, status: invoice.status },
        createdAt: eventDate,
      });
    }
    
    // Sort by date descending and take the most recent 15
    activityItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const topActivities = activityItems.slice(0, 15);
    
    // Create activity logs
    for (const activity of topActivities) {
      await storage.createActivityLog({
        userId: activity.userId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        entityType: activity.entityType,
        entityId: activity.entityId,
        metadata: activity.metadata,
      });
    }
    
    console.log(`[DemoActivity] Created ${topActivities.length} activity logs for Recent Activity`);
  } catch (error) {
    console.error('[DemoActivity] Error creating activity logs:', error);
  }
}

// ============================================
// REFRESH FOR SCREENSHOTS: Update dates for App Store screenshots
// ============================================
export async function refreshDemoDataForScreenshots(): Promise<{ success: boolean; message: string; updated: any }> {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      return { success: false, message: 'Demo user not found', updated: {} };
    }

    console.log('[DemoScreenshots] Refreshing demo data for App Store screenshots...');
    
    const jobs = await storage.getJobs(demoUser.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updated = {
      todaysJobs: 0,
      thisWeekJobs: 0,
      upcomingJobs: 0,
      activityLogs: 0,
    };
    
    // Sort scheduled jobs by ID for consistency
    const scheduledJobs = jobs
      .filter(j => j.status === 'scheduled')
      .sort((a, b) => a.id.localeCompare(b.id));
    
    // Distribute scheduled jobs across today and next 2 weeks
    const scheduleTimes = [
      { day: 0, hour: 9, minute: 0 },   // Today 9:00 AM
      { day: 0, hour: 11, minute: 30 }, // Today 11:30 AM
      { day: 0, hour: 14, minute: 0 },  // Today 2:00 PM
      { day: 1, hour: 10, minute: 0 },  // Tomorrow 10:00 AM
      { day: 1, hour: 14, minute: 30 }, // Tomorrow 2:30 PM
      { day: 2, hour: 9, minute: 0 },   // Day 2
      { day: 3, hour: 11, minute: 0 },  // Day 3
      { day: 4, hour: 9, minute: 30 },  // Day 4
      { day: 7, hour: 10, minute: 0 },  // Next week
      { day: 8, hour: 14, minute: 0 },  // Next week
      { day: 10, hour: 9, minute: 0 },  // Next week
      { day: 14, hour: 11, minute: 30 },// 2 weeks
    ];
    
    for (let i = 0; i < scheduledJobs.length && i < scheduleTimes.length; i++) {
      const job = scheduledJobs[i];
      const slot = scheduleTimes[i];
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + slot.day);
      newDate.setHours(slot.hour, slot.minute, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: newDate,
        scheduledTime: `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`,
      });
      
      if (slot.day === 0) updated.todaysJobs++;
      else if (slot.day <= 7) updated.thisWeekJobs++;
      else updated.upcomingJobs++;
    }
    
    // Update in-progress jobs to have started recently
    const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
    for (let i = 0; i < inProgressJobs.length; i++) {
      const job = inProgressJobs[i];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (i % 3)); // Started 0-2 days ago
      startDate.setHours(8 + (i % 4), 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        startedAt: startDate,
        scheduledAt: startDate,
      });
    }
    
    // Update completed/invoiced jobs with complete journey dates (scheduled -> started -> completed -> invoiced)
    const doneJobs = jobs.filter(j => j.status === 'done');
    for (let i = 0; i < doneJobs.length && i < 5; i++) {
      const job = doneJobs[i];
      const daysAgo = i + 1; // 1-5 days ago
      
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - (daysAgo + 2));
      scheduledDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const startedDate = new Date();
      startedDate.setDate(startedDate.getDate() - (daysAgo + 1));
      startedDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - daysAgo);
      completedDate.setHours(15 + (i % 3), 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: scheduledDate,
        startedAt: startedDate,
        completedAt: completedDate,
      });
    }
    
    // Update invoiced jobs with complete journey including invoice date
    const invoicedJobs = jobs.filter(j => j.status === 'invoiced');
    for (let i = 0; i < invoicedJobs.length && i < 8; i++) {
      const job = invoicedJobs[i];
      const baseDays = (i + 1) * 3; // 3, 6, 9, 12, 15, 18, 21, 24 days ago
      
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - (baseDays + 3));
      scheduledDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const startedDate = new Date();
      startedDate.setDate(startedDate.getDate() - (baseDays + 2));
      startedDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - (baseDays + 1));
      completedDate.setHours(15 + (i % 3), 0, 0, 0);
      
      const invoicedDate = new Date();
      invoicedDate.setDate(invoicedDate.getDate() - baseDays);
      invoicedDate.setHours(10, 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: scheduledDate,
        startedAt: startedDate,
        completedAt: completedDate,
        invoicedAt: invoicedDate,
      });
    }
    
    // Recreate activity logs with current dates
    // Delete existing logs first
    const deletedCount = await storage.deleteActivityLogs(demoUser.id);
    console.log(`[DemoScreenshots] Deleted ${deletedCount} existing activity logs`);
    
    // Create fresh activity logs
    await createDemoActivityLogs(demoUser.id);
    updated.activityLogs = 15;
    
    console.log(`[DemoScreenshots] Updated jobs: ${updated.todaysJobs} today, ${updated.thisWeekJobs} this week, ${updated.upcomingJobs} upcoming`);
    
    return { 
      success: true, 
      message: `Demo data refreshed for screenshots: ${updated.todaysJobs} jobs today, ${updated.thisWeekJobs} this week, ${updated.upcomingJobs} upcoming. Activity logs updated.`,
      updated
    };
  } catch (error: any) {
    console.error('[DemoScreenshots] Error refreshing demo data:', error);
    return { success: false, message: error.message || 'Failed to refresh demo data', updated: {} };
  }
}

// ============================================
// SEED DEMO DATA FOR NEW USERS (Onboarding)
// Creates sample data so new users can explore the app with real examples
// ============================================
export async function seedUserDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`[DemoSeed] Seeding demo data for user ${userId}...`);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Check if already seeded
    if (user.hasDemoData) {
      console.log(`[DemoSeed] User ${userId} already has demo data, skipping`);
      return { success: true, message: 'Demo data already exists' };
    }
    
    // ============================================
    // CREATE 5 SAMPLE CLIENTS
    // ============================================
    const sampleClients = [
      { name: 'Sarah Mitchell', email: 'sarah.mitchell@example.com', phone: '+61412345678', address: '15 Smith Street, Sydney NSW 2000' },
      { name: 'David Wilson', email: 'david.wilson@example.com', phone: '+61423456789', address: '28 Park Avenue, Melbourne VIC 3000' },
      { name: 'Emma Thompson', email: 'emma.t@example.com', phone: '+61434567890', address: '7 Beach Road, Brisbane QLD 4000' },
      { name: 'James Brown', email: 'james.brown@example.com', phone: '+61445678901', address: '92 Main Street, Perth WA 6000' },
      { name: 'Lisa Chen', email: 'lisa.chen@example.com', phone: '+61456789012', address: '45 River Drive, Adelaide SA 5000' },
    ];

    const createdClients = [];
    for (const clientData of sampleClients) {
      const client = await storage.createClient({
        userId,
        ...clientData,
      });
      createdClients.push(client);
    }
    console.log(`[DemoSeed] Created ${createdClients.length} sample clients`);

    // ============================================
    // CREATE 6 SAMPLE JOBS (different statuses)
    // ============================================
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sampleJobs = [
      { client: 0, title: 'Kitchen Tap Repair', description: 'Customer reports dripping tap in kitchen. Need to replace washer or entire tap assembly.', status: 'pending', address: sampleClients[0].address },
      { client: 1, title: 'Hot Water System Service', description: 'Annual service and safety check on electric hot water system.', status: 'scheduled', address: sampleClients[1].address, scheduledAt: tomorrow },
      { client: 2, title: 'Bathroom Renovation', description: 'Complete bathroom rough-in for renovation. Relocate toilet, vanity and shower.', status: 'in_progress', address: sampleClients[2].address },
      { client: 3, title: 'Blocked Drain', description: 'Slow draining kitchen sink. May need high pressure jetting.', status: 'done', address: sampleClients[3].address },
      { client: 4, title: 'Gas Heater Installation', description: 'Install new Rinnai gas heater with flue kit. Need gas compliance certificate.', status: 'invoiced', address: sampleClients[4].address },
      { client: 0, title: 'Outdoor Tap Installation', description: 'Install new garden tap near shed for irrigation system.', status: 'scheduled', address: sampleClients[0].address, scheduledAt: nextWeek },
    ];

    const createdJobs = [];
    for (const job of sampleJobs) {
      const createdJob = await storage.createJob({
        userId,
        clientId: createdClients[job.client].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: job.status as any,
        scheduledAt: job.scheduledAt,
        estimatedDuration: 60,
      });
      createdJobs.push(createdJob);
    }
    console.log(`[DemoSeed] Created ${createdJobs.length} sample jobs`);

    // ============================================
    // CREATE 3 SAMPLE QUOTES
    // ============================================
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const sampleQuotes = [
      { 
        client: 0, 
        job: 0, 
        title: 'Kitchen Tap Replacement Quote',
        items: [
          { description: 'Mixer tap - chrome finish', quantity: 1, unitPrice: 185, total: 185 },
          { description: 'Labour - installation', quantity: 1, unitPrice: 150, total: 150 },
          { description: 'Callout fee', quantity: 1, unitPrice: 80, total: 80 },
        ],
        status: 'sent',
        subtotal: 415,
        gst: 41.50,
        total: 456.50,
      },
      { 
        client: 2, 
        job: 2, 
        title: 'Bathroom Renovation Quote',
        items: [
          { description: 'Rough-in plumbing - toilet, vanity, shower', quantity: 1, unitPrice: 1800, total: 1800 },
          { description: 'Materials - pipes, fittings, valves', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Hot water connection', quantity: 1, unitPrice: 350, total: 350 },
        ],
        status: 'accepted',
        subtotal: 2600,
        gst: 260,
        total: 2860,
      },
      { 
        client: 4, 
        job: 4, 
        title: 'Gas Heater Installation Quote',
        items: [
          { description: 'Rinnai Energysaver 561FT', quantity: 1, unitPrice: 1450, total: 1450 },
          { description: 'Flue kit and installation', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Gas compliance certificate', quantity: 1, unitPrice: 120, total: 120 },
        ],
        status: 'accepted',
        subtotal: 2020,
        gst: 202,
        total: 2222,
      },
    ];

    const createdQuotes = [];
    for (const quote of sampleQuotes) {
      const createdQuote = await storage.createQuote({
        userId,
        clientId: createdClients[quote.client].id,
        jobId: createdJobs[quote.job]?.id,
        title: quote.title,
        items: quote.items,
        status: quote.status as any,
        subtotal: quote.subtotal.toString(),
        gst: quote.gst.toString(),
        total: quote.total.toString(),
        validUntil,
      });
      createdQuotes.push(createdQuote);
    }
    console.log(`[DemoSeed] Created ${createdQuotes.length} sample quotes`);

    // ============================================
    // CREATE 2 SAMPLE INVOICES
    // ============================================
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const sampleInvoices = [
      { 
        client: 3, 
        job: 3, 
        title: 'Blocked Drain - Completed',
        items: [
          { description: 'High pressure drain jetting', quantity: 1, unitPrice: 320, total: 320 },
          { description: 'CCTV inspection', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Callout fee', quantity: 1, unitPrice: 80, total: 80 },
        ],
        status: 'sent',
        subtotal: 580,
        gst: 58,
        total: 638,
      },
      { 
        client: 4, 
        job: 4, 
        title: 'Gas Heater Installation - Invoice',
        items: [
          { description: 'Rinnai Energysaver 561FT', quantity: 1, unitPrice: 1450, total: 1450 },
          { description: 'Flue kit and installation', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Gas compliance certificate', quantity: 1, unitPrice: 120, total: 120 },
        ],
        status: 'paid',
        subtotal: 2020,
        gst: 202,
        total: 2222,
      },
    ];

    const createdInvoices = [];
    for (const invoice of sampleInvoices) {
      const createdInvoice = await storage.createInvoice({
        userId,
        clientId: createdClients[invoice.client].id,
        jobId: createdJobs[invoice.job]?.id,
        title: invoice.title,
        items: invoice.items,
        status: invoice.status as any,
        subtotal: invoice.subtotal.toString(),
        gst: invoice.gst.toString(),
        total: invoice.total.toString(),
        dueDate,
      });
      createdInvoices.push(createdInvoice);
    }
    console.log(`[DemoSeed] Created ${createdInvoices.length} sample invoices`);

    // Store the IDs of all demo records for safe cleanup later
    const demoDataIds = {
      clients: createdClients.map(c => c.id),
      jobs: createdJobs.map(j => j.id),
      quotes: createdQuotes.map(q => q.id),
      invoices: createdInvoices.map(i => i.id),
    };

    // Mark user as having demo data and store the demo record IDs
    await storage.updateUser(userId, { 
      hasDemoData: true,
      demoDataIds: demoDataIds as any,
    });
    
    console.log(`[DemoSeed] Demo data seeding complete for user ${userId}`);
    console.log(`[DemoSeed] Stored demo IDs: ${JSON.stringify(demoDataIds)}`);
    return { success: true, message: 'Sample data created successfully! You now have clients, jobs, quotes, and invoices to explore.' };
  } catch (error: any) {
    console.error('[DemoSeed] Error seeding demo data:', error);
    return { success: false, message: error.message || 'Failed to seed demo data' };
  }
}

// ============================================
// CLEAR DEMO DATA FOR USER (Start Fresh)
// Removes ONLY sample data records that were created during onboarding
// Uses stored demo record IDs for precise deletion
// ============================================

interface DemoDataIds {
  clients: string[];
  jobs: string[];
  quotes: string[];
  invoices: string[];
}

export async function clearUserDemoData(userId: string): Promise<{ 
  success: boolean; 
  message: string; 
  deleted: { clients: number; jobs: number; quotes: number; invoices: number };
}> {
  try {
    console.log(`[DemoClear] Clearing demo data for user ${userId}...`);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, message: 'User not found', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    if (!user.hasDemoData) {
      console.log(`[DemoClear] User ${userId} has no demo data to clear`);
      return { success: true, message: 'No sample data to clear', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    // Get the stored demo data IDs
    const demoDataIds = user.demoDataIds as DemoDataIds | null;
    
    if (!demoDataIds) {
      console.log(`[DemoClear] User ${userId} has hasDemoData=true but no demoDataIds stored (legacy)`);
      // For legacy users who have hasDemoData but no IDs stored, just mark as cleared
      await storage.updateUser(userId, { hasDemoData: false, demoDataIds: null });
      return { success: true, message: 'Demo data flag cleared (no tracked IDs)', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    console.log(`[DemoClear] Found demo IDs to delete: ${JSON.stringify(demoDataIds)}`);
    
    const deleted = { clients: 0, jobs: 0, quotes: 0, invoices: 0 };
    
    // Delete in order: invoices -> quotes -> jobs -> clients (due to foreign keys)
    // Only delete records that match the stored demo IDs
    for (const invoiceId of demoDataIds.invoices || []) {
      try {
        await storage.deleteInvoice(invoiceId, userId);
        deleted.invoices++;
      } catch (e) {
        console.log(`[DemoClear] Invoice ${invoiceId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.invoices} demo invoices`);
    
    for (const quoteId of demoDataIds.quotes || []) {
      try {
        await storage.deleteQuote(quoteId, userId);
        deleted.quotes++;
      } catch (e) {
        console.log(`[DemoClear] Quote ${quoteId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.quotes} demo quotes`);
    
    for (const jobId of demoDataIds.jobs || []) {
      try {
        await storage.deleteJob(jobId, userId);
        deleted.jobs++;
      } catch (e) {
        console.log(`[DemoClear] Job ${jobId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.jobs} demo jobs`);
    
    for (const clientId of demoDataIds.clients || []) {
      try {
        await storage.deleteClient(clientId, userId);
        deleted.clients++;
      } catch (e) {
        console.log(`[DemoClear] Client ${clientId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.clients} demo clients`);
    
    // Mark user as no longer having demo data and clear stored IDs
    await storage.updateUser(userId, { hasDemoData: false, demoDataIds: null });
    
    console.log(`[DemoClear] Demo data cleared for user ${userId}`);
    return { 
      success: true, 
      message: 'Sample data cleared! You now have a fresh start.',
      deleted
    };
  } catch (error: any) {
    console.error('[DemoClear] Error clearing demo data:', error);
    return { success: false, message: error.message || 'Failed to clear demo data', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
  }
}
