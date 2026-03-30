import "./instrument";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createDemoUserAndData, fixTestUserPasswords, seedSmsDataForTestUsers, createDemoTeamMembers, startDemoDataRefreshScheduler } from "./demoData";
import { initializeStripe } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { storage } from "./storage";
import { setupWebSocket } from "./websocket";

process.on('uncaughtException', (error: Error) => {
  Sentry.captureException(error);
  console.error(JSON.stringify({
    level: 'fatal',
    type: 'uncaughtException',
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  }));
});

process.on('unhandledRejection', (reason: unknown) => {
  Sentry.captureException(reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  console.error(JSON.stringify({
    level: 'error',
    type: 'unhandledRejection',
    message,
    stack,
    timestamp: new Date().toISOString(),
  }));
});

let httpServer: ReturnType<typeof import('http').createServer> | null = null;

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  const forceTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceTimeout.unref();

  const closeServer = new Promise<void>((resolve) => {
    if (httpServer) {
      httpServer.close(() => resolve());
    } else {
      resolve();
    }
  });

  closeServer
    .then(() => {
      if ((storage as any).pool) {
        return (storage as any).pool.end();
      }
    })
    .then(() => {
      console.log('Graceful shutdown complete');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const app = express();

// Session configuration - require SESSION_SECRET and DATABASE_URL in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required in production for persistent session storage');
  }
}

// Configure session store based on environment
let sessionStore;
if (process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: false,
  });
  console.log('✅ Using PostgreSQL session store for persistence');
} else if (process.env.NODE_ENV === 'development') {
  sessionStore = undefined;
  console.log('⚠️ Using in-memory session store (development only)');
} else {
  throw new Error('PostgreSQL session store required for production - DATABASE_URL missing');
}

(async () => {
  // Initialize Stripe and get webhook UUID
  const { stripe, webhookUuid } = await initializeStripe();
  
  // Initialize Twilio for SMS notifications
  const { initializeTwilio, configureTwilioWebhook } = await import('./twilioClient');
  const twilioReady = await initializeTwilio();
  if (twilioReady) {
    const webhookBaseUrl = process.env.APP_DOMAIN 
      ? `https://${process.env.APP_DOMAIN}`
      : 'https://jobrunner.com.au';
    await configureTwilioWebhook(webhookBaseUrl);
  }
  
  // Register Stripe webhook route BEFORE express.json()
  // This is critical - webhook needs raw Buffer, not parsed JSON
  if (webhookUuid) {
    app.post(
      '/api/stripe/webhook/:uuid',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
          return res.status(400).json({ error: 'Missing stripe-signature' });
        }

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;

          if (!Buffer.isBuffer(req.body)) {
            console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
            return res.status(500).json({ error: 'Webhook processing error' });
          }

          const { uuid } = req.params;
          await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid, storage);

          res.status(200).json({ received: true });
        } catch (error: any) {
          console.error('Webhook error:', error.message);
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
    console.log('✅ Stripe webhook route configured');
  }

  app.post(
    '/api/vapi/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const { processWebhookEvent, verifyVapiWebhook } = await import('./vapiService');
        const signature = req.headers['x-vapi-signature'] as string | undefined;

        if (!Buffer.isBuffer(req.body)) {
          console.error('[Vapi Webhook] req.body is not a Buffer');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        if (!verifyVapiWebhook(req.body, signature)) {
          console.warn('[Vapi Webhook] Invalid signature - rejecting request');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const parsed = JSON.parse(req.body.toString('utf8'));
        const result = await processWebhookEvent(parsed);
        res.json(result);
      } catch (error: any) {
        console.error('[Vapi Webhook] Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );
  console.log('✅ Vapi webhook route configured');

  // Now apply JSON middleware for all other routes
  // Increase limit to 10MB for voice note and photo uploads (base64 encoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }));

  // Serve static public assets (logo, etc.) for emails
  app.use('/public', express.static('public'));

  // Detect if running on Replit (served via HTTPS even in development)
  const isReplit = !!process.env.REPL_ID;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Trust proxy first (must be before session middleware)
  if (isReplit || isProduction) {
    app.set('trust proxy', 1);
  }
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: isReplit || isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    },
    name: 'jobrunner.sid',
    proxy: isReplit || isProduction
  }));

  app.use((req, _res, next) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = randomUUID().substring(0, 8);
    }
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Demo data seeding - only run in development or when explicitly enabled for Apple review
  // Set ENABLE_DEMO_DATA=true in production only during App Store review periods
  const enableDemoData = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_DATA === 'true';
  if (enableDemoData) {
    // This creates/updates demo@jobrunner.com.au with password demo123
    await createDemoUserAndData();
    
    // Create demo team members with realistic Australian data and live locations
    await createDemoTeamMembers();
    console.log('[Demo] Demo data seeding enabled');
  }
  
  const server = await registerRoutes(app);
  httpServer = server;

  Sentry.setupExpressErrorHandler(app);

  // Set up WebSocket for real-time location tracking with session auth
  setupWebSocket(server, sessionStore);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start background schedulers after server is ready
    import('./reminderScheduler').then(({ startAllSchedulers }) => {
      startAllSchedulers();
    }).catch(error => {
      console.error('Failed to start schedulers:', error);
    });

    import('./retryScheduler').then(({ startRetryScheduler }) => {
      startRetryScheduler();
    }).catch(error => {
      console.error('Failed to start retry scheduler:', error);
    });

    // Start stale timer detection scheduler - runs every 30 minutes
    import('./staleTimerService').then(({ checkAndAutoStopStaleTimers }) => {
      const STALE_TIMER_INTERVAL = 30 * 60 * 1000; // 30 minutes
      setInterval(async () => {
        try {
          console.log('[Scheduler] Running stale timer detection...');
          const result = await checkAndAutoStopStaleTimers();
          if (result.stopped > 0 || result.errors > 0) {
            console.log(`[Scheduler] Stale timer check: ${result.stopped} stopped, ${result.errors} errors`);
          }
        } catch (error) {
          console.error('[Scheduler] Stale timer check failed:', error);
        }
      }, STALE_TIMER_INTERVAL);
      console.log('✅ Stale timer detection scheduler started (every 30 minutes)');
    }).catch(error => {
      console.error('Failed to start stale timer scheduler:', error);
    });
    
    // Start demo data refresh scheduler to keep team members "alive"
    if (enableDemoData) {
      startDemoDataRefreshScheduler();
    }
  });
})();
