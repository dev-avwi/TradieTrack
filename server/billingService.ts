import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';
import { PRICING } from '@shared/schema';

export interface CheckoutSessionResult {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}

export interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'trial';
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  seatCount?: number; // For team tier
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
    (p) => p.name === PRICING.pro.name && p.active
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRICING.pro.name,
      description: PRICING.pro.description,
      metadata: {
        platform: 'tradietrack',
        tier: 'pro',
      },
    });
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICING.pro.monthly,
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

// Get or create Team base price ($59/month) and seat price ($29/month)
async function getOrCreateTeamPrices(stripe: Stripe): Promise<{ basePriceId: string; seatPriceId: string }> {
  // Try to find existing prices
  const prices = await stripe.prices.list({
    lookup_keys: ['tradietrack_team_base_monthly', 'tradietrack_team_seat_monthly'],
    active: true,
    limit: 10,
  });

  let basePriceId = prices.data.find(p => p.lookup_key === 'tradietrack_team_base_monthly')?.id;
  let seatPriceId = prices.data.find(p => p.lookup_key === 'tradietrack_team_seat_monthly')?.id;

  // Get or create Team base product
  if (!basePriceId) {
    const products = await stripe.products.list({ active: true, limit: 100 });
    let baseProduct = products.data.find(p => p.name === PRICING.team.baseName && p.active);

    if (!baseProduct) {
      baseProduct = await stripe.products.create({
        name: PRICING.team.baseName,
        description: PRICING.team.description,
        metadata: {
          platform: 'tradietrack',
          tier: 'team',
          type: 'base',
        },
      });
    }

    const basePrice = await stripe.prices.create({
      product: baseProduct.id,
      unit_amount: PRICING.team.baseMonthly,
      currency: 'aud',
      recurring: { interval: 'month' },
      lookup_key: 'tradietrack_team_base_monthly',
      metadata: { tier: 'team', type: 'base' },
    });
    basePriceId = basePrice.id;
  }

  // Get or create Team seat product
  if (!seatPriceId) {
    const products = await stripe.products.list({ active: true, limit: 100 });
    let seatProduct = products.data.find(p => p.name === PRICING.team.seatName && p.active);

    if (!seatProduct) {
      seatProduct = await stripe.products.create({
        name: PRICING.team.seatName,
        description: 'Additional team member for TradieTrack Team plan',
        metadata: {
          platform: 'tradietrack',
          tier: 'team',
          type: 'seat',
        },
      });
    }

    const seatPrice = await stripe.prices.create({
      product: seatProduct.id,
      unit_amount: PRICING.team.seatMonthly,
      currency: 'aud',
      recurring: { interval: 'month' },
      lookup_key: 'tradietrack_team_seat_monthly',
      metadata: { tier: 'team', type: 'seat' },
    });
    seatPriceId = seatPrice.id;
  }

  return { basePriceId, seatPriceId };
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

// Create Team subscription checkout with base + additional seats
export async function createTeamSubscriptionCheckout(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  additionalSeats: number = 0,
  businessName?: string
): Promise<CheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    const { basePriceId, seatPriceId } = await getOrCreateTeamPrices(stripe);

    // Build line items: base + seats (if any)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: basePriceId, quantity: 1 },
    ];

    // Add seat line item only if additional seats > 0
    if (additionalSeats > 0) {
      lineItems.push({
        price: seatPriceId,
        quantity: additionalSeats,
        adjustable_quantity: {
          enabled: true,
          minimum: 0,
          maximum: 50,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
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
          tier: 'team',
          seatCount: String(additionalSeats),
          platform: 'tradietrack',
        },
      },
      metadata: {
        userId,
        type: 'subscription',
        tier: 'team',
        seatCount: String(additionalSeats),
      },
    });

    return {
      success: true,
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error: any) {
    console.error('Error creating team subscription checkout:', error);
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
  const seatCount = (businessSettings as any)?.seatCount || 0;

  if (!stripe || !subscriptionId) {
    const tier = user.subscriptionTier as 'free' | 'pro' | 'team' || 'free';
    return {
      tier,
      status: tier !== 'free' ? 'active' : 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      seatCount: tier === 'team' ? seatCount : undefined,
    };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
    
    // Determine tier from subscription metadata or stored value
    const subscriptionTier = subscription.metadata?.tier || user.subscriptionTier;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    
    let tier: 'free' | 'pro' | 'team' = 'free';
    if (isActive) {
      tier = subscriptionTier === 'team' ? 'team' : 'pro';
    }

    return {
      tier,
      status: subscription.status as 'active' | 'past_due' | 'canceled',
      currentPeriodEnd: new Date((subscription.current_period_end || 0) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      stripeSubscriptionId: subscriptionId,
      seatCount: tier === 'team' ? seatCount : undefined,
    };
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    const tier = user.subscriptionTier as 'free' | 'pro' | 'team' || 'free';
    return {
      tier,
      status: 'none',
      stripeCustomerId: businessSettings?.stripeCustomerId || undefined,
      seatCount: tier === 'team' ? seatCount : undefined,
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
