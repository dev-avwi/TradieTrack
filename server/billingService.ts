import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';

const PRO_PRICE_AUD = 3900;

export interface CheckoutSessionResult {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}

export interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'trial';
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface BillingPortalResult {
  success: boolean;
  url?: string;
  error?: string;
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  email: string,
  businessName?: string
): Promise<string> {
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);
  
  if (businessSettings?.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(businessSettings.stripeCustomerId);
      return businessSettings.stripeCustomerId;
    } catch (e) {
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: businessName || businessSettings?.businessName || email,
    metadata: {
      userId,
      platform: 'tradietrack',
    },
  });

  if (businessSettings) {
    await storage.updateBusinessSettings(userId, {
      stripeCustomerId: customer.id,
    });
  }

  return customer.id;
}

async function getOrCreateProPrice(stripe: Stripe): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: ['tradietrack_pro_monthly'],
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });

  let product = products.data.find(
    (p) => p.name === 'TradieTrack Pro' && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: 'TradieTrack Pro',
      description: 'Unlimited jobs, invoices, quotes. Full features for trade businesses.',
      metadata: {
        platform: 'tradietrack',
        tier: 'pro',
      },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRO_PRICE_AUD,
    currency: 'aud',
    recurring: {
      interval: 'month',
    },
    lookup_key: 'tradietrack_pro_monthly',
    metadata: {
      tier: 'pro',
    },
  });

  return price.id;
}

export async function createSubscriptionCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  businessName?: string
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const priceId = await getOrCreateProPrice(stripe);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'pro',
          platform: 'tradietrack',
        },
      },
      metadata: {
        userId,
        type: 'subscription',
        tier: 'pro',
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: any) {
    console.error('Error creating subscription checkout:', error);
    return { success: false, error: error.message || 'Failed to create checkout session' };
  }
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<BillingPortalResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    const customerId = businessSettings?.stripeCustomerId;

    if (!customerId) {
      return { success: false, error: 'No billing account found' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      success: true,
      url: session.url,
    };
  } catch (error: any) {
    console.error('Error creating billing portal session:', error);
    return { success: false, error: error.message || 'Failed to create portal session' };
  }
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const stripe = await getUncachableStripeClient();
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);

  if (!user) {
    return { tier: 'free', status: 'none' };
  }

  if (user.trialStatus === 'active' && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd > new Date()) {
      return {
        tier: 'trial',
        status: 'active',
        currentPeriodEnd: trialEnd,
      };
    }
  }

  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!stripe || !subscriptionId) {
    return {
      tier: (user.subscriptionTier as 'free' | 'pro') || 'free',
      status: user.subscriptionTier === 'pro' ? 'active' : 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
    };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

    return {
      tier: subscription.status === 'active' || subscription.status === 'trialing' ? 'pro' : 'free',
      status: subscription.status as 'active' | 'past_due' | 'canceled',
      currentPeriodEnd: new Date((subscription.current_period_end || 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      stripeSubscriptionId: subscriptionId,
    };
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return {
      tier: (user.subscriptionTier as 'free' | 'pro') || 'free',
      status: 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
    };
  }
}

export async function cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No active subscription found' };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: error.message || 'Failed to cancel subscription' };
  }
}

export async function resumeSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  const businessSettings = await storage.getBusinessSettings(userId);
  const subscriptionId = businessSettings?.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: false, error: 'No subscription found' };
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return { success: false, error: error.message || 'Failed to resume subscription' };
  }
}

export async function handleSubscriptionWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.log('No userId in subscription metadata');
        return;
      }

      const isActive = subscription.status === 'active' || subscription.status === 'trialing';

      await storage.updateUser(userId, {
        subscriptionTier: isActive ? 'pro' : 'free',
        trialStatus: isActive && subscription.status === 'trialing' ? 'active' : undefined,
      });

      const businessSettings = await storage.getBusinessSettings(userId);
      if (businessSettings) {
        const sub = subscription as any;
        await storage.updateBusinessSettings(userId, {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date((sub.current_period_end || 0) * 1000),
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.log('No userId in subscription metadata');
        return;
      }

      await storage.updateUser(userId, {
        subscriptionTier: 'free',
      });

      const businessSettings = await storage.getBusinessSettings(userId);
      if (businessSettings) {
        await storage.updateBusinessSettings(userId, {
          subscriptionStatus: 'canceled',
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoiceData = event.data.object as any;
      const subscriptionId = invoiceData.subscription;
      if (subscriptionId && typeof subscriptionId === 'string') {
        const subscription = await (await getUncachableStripeClient())?.subscriptions.retrieve(
          subscriptionId
        );
        if (subscription?.metadata?.userId) {
          await storage.updateUser(subscription.metadata.userId, {
            subscriptionTier: 'pro',
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoiceData = event.data.object as any;
      const subscriptionId = invoiceData.subscription;
      if (subscriptionId && typeof subscriptionId === 'string') {
        const subscription = await (await getUncachableStripeClient())?.subscriptions.retrieve(
          subscriptionId
        );
        if (subscription?.metadata?.userId) {
          const businessSettings = await storage.getBusinessSettings(subscription.metadata.userId);
          if (businessSettings) {
            await storage.updateBusinessSettings(subscription.metadata.userId, {
              subscriptionStatus: 'past_due',
            });
          }
        }
      }
      break;
    }
  }
}

export async function getPublishableKey(): Promise<string | null> {
  return await getStripePublishableKey();
}
