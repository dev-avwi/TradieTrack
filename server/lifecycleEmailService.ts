import { db } from './storage';
import { users, jobs, quotes, invoices, clients } from '@shared/schema';
import { eq, sql, and, gt, isNull, isNotNull, count } from 'drizzle-orm';
import { sendSystemEmail } from './emailService';
import { logger } from './logger';

interface LifecycleEmailsSent {
  welcome_day1?: string;
  nudge_day3?: string;
  nudge_day7?: string;
  nudge_day14?: string;
  nudge_day30?: string;
  churn_risk_day21?: string;
  win_back_day45?: string;
}

interface UserWithMilestones {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date | null;
  lifecycleEmailsSent: LifecycleEmailsSent;
  lastLifecycleEmailAt: Date | null;
  subscriptionTier: string | null;
  jobCount: number;
  quoteCount: number;
  invoiceCount: number;
  clientCount: number;
}

const LIFECYCLE_EMAILS = [
  {
    key: 'nudge_day3',
    daysSinceSignup: 3,
    minDaysSinceLastEmail: 2,
    condition: (user: UserWithMilestones) => user.clientCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, let's add your first client`,
    body: (user: UserWithMilestones) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">G'day ${getFirstName(user)} 👋</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          You signed up for JobRunner a few days ago — nice one! The quickest way to see the value is to add your first client and create a job.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          It takes about 30 seconds:
        </p>
        <ol style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
          <li>Open JobRunner and tap <strong>Clients</strong></li>
          <li>Add a client name and phone number</li>
          <li>Create a job for that client</li>
        </ol>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Once you've got a job in there, everything else — quotes, invoices, scheduling — flows from that.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://jobrunner.com.au" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Open JobRunner</a>
        </div>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          Stuck? Reply to this email and I'll personally help you get set up.<br/>
          — The JobRunner Team
        </p>
      </div>
    `,
  },
  {
    key: 'nudge_day7',
    daysSinceSignup: 7,
    minDaysSinceLastEmail: 3,
    condition: (user: UserWithMilestones) => user.quoteCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, send your first quote in under a minute`,
    body: (user: UserWithMilestones) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Hey ${getFirstName(user)},</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          You've been on JobRunner for a week now. The tradies who get the most value are the ones who send their first quote early — it's the moment the app starts saving you real time.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Here's what makes JobRunner quotes different:
        </p>
        <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
          <li><strong>Professional PDF</strong> — branded with your logo and ABN</li>
          <li><strong>One-tap send</strong> — email or SMS straight to the client</li>
          <li><strong>Track status</strong> — see when they view and accept it</li>
          <li><strong>Convert to invoice</strong> — one click when the job's done</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://jobrunner.com.au" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Create a Quote</a>
        </div>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          Need a hand? Just reply to this email.<br/>
          — The JobRunner Team
        </p>
      </div>
    `,
  },
  {
    key: 'nudge_day14',
    daysSinceSignup: 14,
    minDaysSinceLastEmail: 5,
    condition: (user: UserWithMilestones) => user.invoiceCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, get paid faster with JobRunner invoices`,
    body: (user: UserWithMilestones) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Hey ${getFirstName(user)},</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Two weeks in and you haven't sent an invoice yet — that's where the real magic happens.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          JobRunner invoices let your clients pay online with a card. No more chasing bank transfers. The average tradie gets paid 3 days faster with online invoicing.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          <strong>Pro tip:</strong> If you've already got a quote in the system, you can convert it to an invoice with one tap.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://jobrunner.com.au" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Send Your First Invoice</a>
        </div>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          Questions about getting paid through JobRunner? Reply to this email — happy to walk you through it.<br/>
          — The JobRunner Team
        </p>
      </div>
    `,
  },
  {
    key: 'churn_risk_day21',
    daysSinceSignup: 21,
    minDaysSinceLastEmail: 5,
    condition: (user: UserWithMilestones) => user.jobCount <= 1 && user.quoteCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, is JobRunner right for your business?`,
    body: (user: UserWithMilestones) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Hey ${getFirstName(user)},</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          I noticed you signed up for JobRunner three weeks ago but haven't used it much yet. No worries — I wanted to check in and see if there's anything stopping you from getting started.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Common things I hear from tradies:
        </p>
        <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
          <li><strong>"I'm too busy right now"</strong> — Fair enough. The app is always here when you're ready. It takes 5 minutes to set up properly.</li>
          <li><strong>"I'm not sure how to use it"</strong> — Reply to this email and I'll personally walk you through it.</li>
          <li><strong>"It's missing something I need"</strong> — Tell me what and I'll see what we can do.</li>
        </ul>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Either way, your account is here whenever you need it. No pressure.
        </p>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          — The JobRunner Team
        </p>
      </div>
    `,
  },
  {
    key: 'nudge_day30',
    daysSinceSignup: 30,
    minDaysSinceLastEmail: 7,
    condition: (user: UserWithMilestones) => user.jobCount >= 3 && user.subscriptionTier === 'free',
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, you're getting real value from JobRunner`,
    body: (user: UserWithMilestones) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Nice work, ${getFirstName(user)}!</h2>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          You've created ${user.jobCount} jobs in JobRunner this month — that's solid. You're clearly using it for real work.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          On the free plan you're limited to 25 jobs per month. As your business grows, the Pro plan ($39/month) gives you:
        </p>
        <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
          <li>Unlimited jobs, quotes, and invoices</li>
          <li>Custom branding on all documents</li>
          <li>AI-powered quote assistance</li>
          <li>Advanced reporting and insights</li>
          <li>Priority support</li>
        </ul>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          You can upgrade any time from the app — no lock-in, cancel whenever.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://jobrunner.com.au" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">See Pro Plan</a>
        </div>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          — The JobRunner Team
        </p>
      </div>
    `,
  },
];

function getFirstName(user: UserWithMilestones): string {
  if (!user.firstName) return 'mate';
  const parts = user.firstName.trim().split(' ');
  return parts[0] || 'mate';
}

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

async function getUsersWithMilestones(): Promise<UserWithMilestones[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
      lifecycleEmailsSent: users.lifecycleEmailsSent,
      lastLifecycleEmailAt: users.lastLifecycleEmailAt,
      subscriptionTier: users.subscriptionTier,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.email),
        eq(users.emailVerified, true),
        isNotNull(users.createdAt),
        gt(users.createdAt, sixtyDaysAgo)
      )
    );

  const result: UserWithMilestones[] = [];

  for (const user of allUsers) {
    if (!user.email || user.email.includes('demo@') || user.email.includes('admin@avweb')) continue;

    const [jobResult] = await db.select({ value: count() }).from(jobs).where(eq(jobs.userId, user.id));
    const [quoteResult] = await db.select({ value: count() }).from(quotes).where(eq(quotes.userId, user.id));
    const [invoiceResult] = await db.select({ value: count() }).from(invoices).where(eq(invoices.userId, user.id));
    const [clientResult] = await db.select({ value: count() }).from(clients).where(eq(clients.userId, user.id));

    result.push({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      lifecycleEmailsSent: (user.lifecycleEmailsSent as LifecycleEmailsSent) ?? {},
      lastLifecycleEmailAt: user.lastLifecycleEmailAt,
      subscriptionTier: user.subscriptionTier,
      jobCount: jobResult?.value || 0,
      quoteCount: quoteResult?.value || 0,
      invoiceCount: invoiceResult?.value || 0,
      clientCount: clientResult?.value || 0,
    });
  }

  return result;
}

async function sendLifecycleEmail(user: UserWithMilestones, emailConfig: typeof LIFECYCLE_EMAILS[0]): Promise<boolean> {
  try {
    await sendSystemEmail({
      to: user.email,
      subject: emailConfig.subject(user),
      html: emailConfig.body(user),
    });

    const updatedSent = { ...(user.lifecycleEmailsSent ?? {}), [emailConfig.key]: new Date().toISOString() };
    await db
      .update(users)
      .set({
        lifecycleEmailsSent: updatedSent,
        lastLifecycleEmailAt: new Date(),
      })
      .where(eq(users.id, user.id));

    logger.info(`[Lifecycle] Sent ${emailConfig.key} to ${user.email}`);
    return true;
  } catch (error) {
    logger.error(`[Lifecycle] Failed to send ${emailConfig.key} to ${user.email}:`, error);
    return false;
  }
}

export async function processLifecycleEmails(): Promise<void> {
  try {
    const usersToProcess = await getUsersWithMilestones();
    let sent = 0;

    for (const user of usersToProcess) {
      const userAge = daysSince(user.createdAt);
      const daysSinceLastEmail = user.lastLifecycleEmailAt ? daysSince(user.lastLifecycleEmailAt) : 999;

      for (const emailConfig of LIFECYCLE_EMAILS) {
        if (user.lifecycleEmailsSent[emailConfig.key as keyof LifecycleEmailsSent]) continue;
        if (userAge < emailConfig.daysSinceSignup) continue;
        if (daysSinceLastEmail < emailConfig.minDaysSinceLastEmail) continue;
        if (!emailConfig.condition(user)) continue;

        const success = await sendLifecycleEmail(user, emailConfig);
        if (success) {
          sent++;
          break;
        }
      }
    }

    if (sent > 0) {
      logger.info(`[Lifecycle] Processed ${usersToProcess.length} users, sent ${sent} emails`);
    }
  } catch (error) {
    logger.error('[Lifecycle] Error processing lifecycle emails:', error);
  }
}

export function startLifecycleEmailScheduler(): void {
  const INTERVAL = 6 * 60 * 60 * 1000;

  console.log('[Lifecycle] Starting lifecycle email scheduler...');
  processLifecycleEmails();
  setInterval(processLifecycleEmails, INTERVAL);
  console.log('[Lifecycle] Lifecycle email scheduler running every 6 hours');
}
