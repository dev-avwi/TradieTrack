import * as Sentry from "@sentry/node";
import rateLimit from "express-rate-limit";
import { db } from "../storage";
import { storage } from "../storage";
import { sql } from "drizzle-orm";
import { AuthService } from "../auth";
import { getUserContext, requireOnboarding } from "../permissions";

const isDevelopment = process.env.NODE_ENV !== 'production';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many payment requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const messageSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages sent. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    return req.path.startsWith('/assets') || req.path.startsWith('/public') || req.path === '/api/health';
  },
});

export const requireAuth = async (req: any, res: any, next: any) => {
  let userId = req.session?.userId;
  let isDemoSession = req.session?.isDemo === true;
  let demoDataUserId = req.session?.demoDataUserId;

  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      try {
        const result = await db.execute(
          sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
        );
        if (result.rows && result.rows.length > 0) {
          const sessionData = result.rows[0].sess as any;
          userId = sessionData?.userId;
          isDemoSession = sessionData?.isDemo === true;
          demoDataUserId = sessionData?.demoDataUserId;
        }
      } catch (err) {
        console.error('Session token lookup error:', err);
      }
    }
  }

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.session?.impersonating && req.session?.impersonationExpiresAt) {
    if (Date.now() > req.session.impersonationExpiresAt) {
      const adminId = req.session.originalAdminUserId;
      req.session.userId = adminId;
      delete req.session.impersonating;
      delete req.session.originalAdminUserId;
      delete req.session.impersonationExpiresAt;
      await new Promise<void>((resolve) => {
        req.session.save(() => resolve());
      });
      userId = adminId;
    }
  }

  const effectiveUserId = (isDemoSession && demoDataUserId) ? demoDataUserId : userId;
  const user = await AuthService.getUserById(effectiveUserId);
  if (!user) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    return res.status(401).json({ error: "User not found" });
  }

  req.userId = user.id;
  req.user = user;
  req.isDemo = isDemoSession;

  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.fullName,
  });
  Sentry.setTag("businessName", user.businessName || "unknown");

  if (isDemoSession) {
    const method = req.method.toUpperCase();
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const path = req.originalUrl.toLowerCase();
      const readOnlyExceptions = ['/api/auth/logout', '/api/admin/reset-demo-data'];
      if (!readOnlyExceptions.some(ex => path.startsWith(ex))) {
        return res.status(403).json({
          error: "This is a read-only demo. Create your free account to start managing real jobs!",
          isDemo: true
        });
      }
    }
  }

  next();
};

export const requireProSubscription = (req: any, res: any, next: any) => {
  const { IS_BETA } = require('../freemiumService');
  if (IS_BETA) {
    return next();
  }
  if (req.user?.betaLifetimeAccess) {
    return next();
  }
  const tier = req.user?.subscriptionTier;
  if (tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'beta') {
    return next();
  }
  return res.status(403).json({ error: "This feature requires a Pro subscription" });
};

export const requirePaidTierForSms = async (req: any, res: any, next: any) => {
  try {
    const { IS_BETA } = require('../freemiumService');
    if (IS_BETA) return next();

    const userContext = await getUserContext(req.userId);
    const ownerId = userContext?.effectiveUserId || req.userId;
    req.effectiveUserId = ownerId;
    const owner = await storage.getUser(ownerId);
    if (!owner) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (owner.betaLifetimeAccess) return next();

    const tier = owner.subscriptionTier;
    if (tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'beta') {
      return next();
    }

    return res.status(402).json({
      error: 'SMS sending requires a Pro plan or higher. Upgrade to send SMS to clients.',
      type: 'SUBSCRIPTION_LIMIT',
      feature: 'sms',
    });
  } catch (err) {
    console.error('requirePaidTierForSms error:', err);
    return res.status(500).json({ error: 'Failed to verify SMS access' });
  }
};

export const requireDevelopment = (req: any, res: any, next: any) => {
  if (!isDevelopment) {
    return res.status(403).json({ error: "This endpoint is only available in development mode" });
  }
  next();
};

export const onboardingExemptPrefixes = [
  '/api/auth',
  '/api/onboarding',
  '/api/billing',
  '/api/subscription',
  '/api/subscribe',
  '/api/business-settings',
  '/api/user',
  '/api/usage-status',
  '/api/admin',
  '/api/stripe',
  '/api/demo',
  '/api/push',
  '/api/notifications',
  '/api/health',
  '/api/team/invite/accept',
  '/api/team/invite-code/redeem',
  '/api/mobile',
  '/api/check-email',
  '/api/visitor',
];

export function setupOnboardingGuard(app: any) {
  app.use('/api', async (req: any, res: any, next: any) => {
    const path = req.originalUrl.split('?')[0];
    if (onboardingExemptPrefixes.some(prefix => path.startsWith(prefix))) {
      return next();
    }

    let resolvedUserId = req.session?.userId;
    if (!resolvedUserId) {
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        try {
          const result = await db.execute(
            sql`SELECT sess FROM session WHERE sid = ${sessionToken} AND expire > NOW()`
          );
          if (result.rows && result.rows.length > 0) {
            resolvedUserId = (result.rows[0].sess as any)?.userId;
          }
        } catch {}
      }
    }

    if (!resolvedUserId) {
      return next();
    }

    req._onboardingUserId = resolvedUserId;
    requireOnboarding()(req, res, next);
  });
}
