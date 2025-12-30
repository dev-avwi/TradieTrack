import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createDemoUserAndData, fixTestUserPasswords, seedSmsDataForTestUsers, createDemoTeamMembers } from "./demoData";
import { initializeStripe } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { storage } from "./storage";
import { setupWebSocket } from "./websocket";

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
  
  // Note: Twilio SMS notifications disabled for beta release
  
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

  // Now apply JSON middleware for all other routes
  // Increase limit to 10MB for voice note and photo uploads (base64 encoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
    name: 'tradietrack.sid',
    proxy: isReplit || isProduction
  }));

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

  // Demo data seeding - ALWAYS run to ensure demo account works for Apple review
  // This creates/updates demo@tradietrack.com.au with password demo123456
  await createDemoUserAndData();
  
  // Create demo team members with realistic Australian data and live locations
  await createDemoTeamMembers();
  
  const server = await registerRoutes(app);

  // Set up WebSocket for real-time location tracking with session auth
  setupWebSocket(server, sessionStore);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
  });
})();
