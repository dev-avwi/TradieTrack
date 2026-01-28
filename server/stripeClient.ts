import Stripe from 'stripe';
import { runMigrations, StripeSync } from 'stripe-replit-sync';

let connectionSettings: any;
let stripeSync: StripeSync | null = null;
let stripeInitialized = false;
let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;
let isTestMode: boolean | null = null;

/**
 * Get Stripe credentials from multiple sources (standalone deployment support)
 * Priority:
 * 1. Direct environment variables (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLIC_KEY)
 * 2. Replit managed connector (most reliable in Replit environment)
 * 3. Testing keys (only as fallback for e2e tests)
 */
async function getCredentials() {
  // Return cached credentials if available
  if (cachedCredentials) {
    return cachedCredentials;
  }
  
  // Priority 1: Check for direct environment variables (standalone deployment)
  const directSecretKey = process.env.STRIPE_SECRET_KEY;
  const directPublishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;
  
  if (directSecretKey && directPublishableKey) {
    // Detect if we're using test mode keys
    const usingTestKeys = directSecretKey.startsWith('sk_test_') || directPublishableKey.startsWith('pk_test_');
    isTestMode = usingTestKeys;
    
    if (usingTestKeys) {
      console.log('⚠️ Using Stripe TEST MODE keys - payments will be simulated');
    } else {
      console.log('✅ Using Stripe LIVE MODE keys');
    }
    console.log('✅ Using direct Stripe environment variables');
    cachedCredentials = {
      publishableKey: directPublishableKey,
      secretKey: directSecretKey,
    };
    return cachedCredentials;
  }

  // Priority 2: Try Replit managed connector (preferred in Replit environment)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (xReplitToken && hostname) {
    const connectorName = 'stripe';
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const targetEnvironment = isProduction ? 'production' : 'development';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      });

      const data = await response.json();
      connectionSettings = data.items?.[0];

      if (connectionSettings?.settings?.publishable && connectionSettings?.settings?.secret) {
        // Detect test mode for connector keys
        const connectorPublishable = connectionSettings.settings.publishable;
        const connectorSecret = connectionSettings.settings.secret;
        const usingTestKeys = connectorSecret.startsWith('sk_test_') || connectorPublishable.startsWith('pk_test_');
        isTestMode = usingTestKeys;
        
        if (usingTestKeys) {
          console.log('⚠️ Replit connector returning TEST MODE keys');
        } else {
          console.log('✅ Replit connector returning LIVE MODE keys');
        }
        console.log('✅ Using Replit managed Stripe connector');
        cachedCredentials = {
          publishableKey: connectorPublishable,
          secretKey: connectorSecret,
        };
        return cachedCredentials;
      } else {
        console.log(`⚠️ Stripe ${targetEnvironment} connection not found via Replit connector, checking fallback...`);
      }
    } catch (error) {
      console.error('Failed to fetch Stripe credentials from Replit connector:', error);
    }
  }
  
  // Priority 3: Check for testing keys (only as fallback for e2e tests)
  const testingSecretKey = process.env.TESTING_STRIPE_SECRET_KEY;
  const testingPublishableKey = process.env.TESTING_VITE_STRIPE_PUBLIC_KEY;
  
  if (testingSecretKey && testingPublishableKey) {
    // Validate that testing keys are correct type (secret should start with sk_, publishable with pk_)
    if (testingSecretKey.startsWith('sk_') && testingPublishableKey.startsWith('pk_')) {
      // Testing keys are always test mode
      isTestMode = testingSecretKey.startsWith('sk_test_') || testingPublishableKey.startsWith('pk_test_');
      console.log(`⚠️ Using testing Stripe keys (${isTestMode ? 'TEST MODE' : 'LIVE MODE'}) - fallback`);
      cachedCredentials = {
        publishableKey: testingPublishableKey,
        secretKey: testingSecretKey,
      };
      return cachedCredentials;
    } else {
      console.log('⚠️ Testing Stripe keys appear to be swapped or invalid (secret should start with sk_, publishable with pk_)');
    }
  }
  
  console.log('⚠️ No Stripe credentials available');
  return null;
}

export async function getUncachableStripeClient(): Promise<Stripe | null> {
  const credentials = await getCredentials();
  if (!credentials) return null;

  return new Stripe(credentials.secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function getStripePublishableKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.publishableKey || null;
}

export async function getStripeSecretKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.secretKey || null;
}

export async function getStripeSync(): Promise<StripeSync | null> {
  if (!stripeSync) {
    const secretKey = await getStripeSecretKey();
    if (!secretKey) return null;

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

export async function initializeStripe(): Promise<{ stripe: Stripe | null; webhookUuid: string | null }> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('⚠️ DATABASE_URL not found - Stripe sync disabled');
    return { stripe: null, webhookUuid: null };
  }

  try {
    const stripe = await getUncachableStripeClient();
    if (!stripe) {
      console.log('⚠️ Stripe credentials not available - using mock payment service');
      return { stripe: null, webhookUuid: null };
    }

    console.log('✅ Stripe initialized for payments');

    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('✅ Stripe schema ready');

    const sync = await getStripeSync();
    if (!sync) {
      return { stripe, webhookUuid: null };
    }

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await sync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: [
          'checkout.session.completed',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'account.updated', // Stripe Connect account status changes
        ],
        description: 'TradieTrack payment webhooks',
      }
    );
    console.log(`✅ Webhook configured: ${webhook.url}`);

    console.log('Syncing Stripe data in background...');
    sync.syncBackfill()
      .then(() => console.log('✅ Stripe data synced'))
      .catch((err) => console.error('Error syncing Stripe data:', err));

    stripeInitialized = true;
    return { stripe, webhookUuid: uuid };
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    return { stripe: null, webhookUuid: null };
  }
}

export function isStripeInitialized(): boolean {
  return stripeInitialized;
}

/**
 * Check if Stripe is running in test mode based on the API keys
 * Returns null if credentials haven't been loaded yet
 */
export async function isStripeInTestMode(): Promise<boolean> {
  // If we haven't determined yet, trigger credential loading
  if (isTestMode === null) {
    await getCredentials();
  }
  return isTestMode === true;
}
