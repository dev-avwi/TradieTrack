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

// Get or create Team base price ($49/month) and seat price ($29/month)
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
  businessName?: string,
  trialDays: number = 14
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
      payment_method_collection: 'always',
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
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
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
  businessName?: string,
  trialDays: number = 14
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
      payment_method_collection: 'always',
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
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
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

// Create a trial subscription directly (for API-based signups)
export interface TrialSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  customerId?: string;
  trialEndsAt?: Date;
  error?: string;
}

export async function createTrialSubscription(
  userId: string,
  email: string,
  paymentMethodId: string,
  tier: 'pro' | 'team' = 'pro',
  businessName?: string
): Promise<TrialSubscriptionResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, userId, email, businessName);
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Get the price ID based on tier
    let priceId: string;
    if (tier === 'team') {
      const { basePriceId } = await getOrCreateTeamPrices(stripe);
      priceId = basePriceId;
    } else {
      priceId = await getOrCreateProPrice(stripe);
    }

    // Create subscription with 14-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      metadata: {
        userId,
        tier,
        platform: 'tradietrack',
      },
    });

    const trialEnd = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000) 
      : undefined;

    // Update user and business settings
    await storage.updateUser(userId, {
      subscriptionTier: tier,
      trialStatus: 'active',
      trialStartedAt: new Date(),
      trialEndsAt: trialEnd,
    });

    const businessSettings = await storage.getBusinessSettings(userId);
    if (businessSettings) {
      await storage.updateBusinessSettings(userId, {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        subscriptionStatus: subscription.status,
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        nextBillingDate: trialEnd,
      });
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      customerId,
      trialEndsAt: trialEnd,
    };
  } catch (error: any) {
    console.error('Error creating trial subscription:', error);
    return { success: false, error: error.message || 'Failed to create trial subscription' };
  }
}

// Get payment method details for a user
export interface PaymentMethodDetails {
  success: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  error?: string;
}

export async function getPaymentMethodDetails(userId: string): Promise<PaymentMethodDetails> {
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

    // Get the customer to find default payment method
    const customer = await stripe.customers.retrieve(customerId);
    
    if ('deleted' in customer && customer.deleted) {
      return { success: false, error: 'Customer account not found' };
    }

    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethodId) {
      // Try to get from subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return { success: false, error: 'No payment method on file' };
      }

      const sub = subscriptions.data[0];
      const pmId = sub.default_payment_method;
      
      if (!pmId) {
        return { success: false, error: 'No payment method on file' };
      }

      const paymentMethod = await stripe.paymentMethods.retrieve(
        typeof pmId === 'string' ? pmId : pmId.id
      );

      if (paymentMethod.type === 'card' && paymentMethod.card) {
        return {
          success: true,
          last4: paymentMethod.card.last4,
          brand: paymentMethod.card.brand,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year,
        };
      }

      return { success: false, error: 'No card payment method found' };
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(
      typeof defaultPaymentMethodId === 'string' 
        ? defaultPaymentMethodId 
        : defaultPaymentMethodId.id
    );

    if (paymentMethod.type === 'card' && paymentMethod.card) {
      return {
        success: true,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
      };
    }

    return { success: false, error: 'No card payment method found' };
  } catch (error: any) {
    console.error('Error getting payment method details:', error);
    return { success: false, error: error.message || 'Failed to get payment method' };
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
  const stripe = await getUncachableStripeClient();
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier || 'pro';

      if (!userId) {
        console.log('No userId in subscription metadata');
        return;
      }

      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      const isTrialing = subscription.status === 'trialing';
      const sub = subscription as any;
      
      // Calculate next billing date and trial end
      const currentPeriodEnd = sub.current_period_end 
        ? new Date(sub.current_period_end * 1000) 
        : undefined;
      const trialEnd = sub.trial_end 
        ? new Date(sub.trial_end * 1000) 
        : undefined;

      // Update user with subscription and trial info
      await storage.updateUser(userId, {
        subscriptionTier: isActive ? tier : 'free',
        trialStatus: isTrialing ? 'active' : (isActive ? 'converted' : undefined),
        trialStartedAt: isTrialing && event.type === 'customer.subscription.created' ? new Date() : undefined,
        trialEndsAt: trialEnd,
      });

      const businessSettings = await storage.getBusinessSettings(userId);
      if (businessSettings) {
        // Prepare business settings update
        const businessUpdate: any = {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd,
          nextBillingDate: isTrialing ? trialEnd : currentPeriodEnd,
        };

        // Add trial tracking if trialing
        if (isTrialing) {
          businessUpdate.trialStartDate = event.type === 'customer.subscription.created' ? new Date() : undefined;
          businessUpdate.trialEndDate = trialEnd;
        }

        // If subscription just became active (converted from trial), mark conversion
        if (subscription.status === 'active' && !isTrialing) {
          businessUpdate.trialConverted = true;
        }

        // Try to get and store payment method details
        if (stripe) {
          try {
            const customerId = typeof subscription.customer === 'string' 
              ? subscription.customer 
              : subscription.customer.id;
            
            const customer = await stripe.customers.retrieve(customerId);
            
            if (!('deleted' in customer && customer.deleted)) {
              const defaultPmId = (customer as Stripe.Customer).invoice_settings?.default_payment_method 
                || subscription.default_payment_method;
              
              if (defaultPmId) {
                const pmId = typeof defaultPmId === 'string' ? defaultPmId : defaultPmId.id;
                const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
                
                if (paymentMethod.type === 'card' && paymentMethod.card) {
                  businessUpdate.paymentMethodLast4 = paymentMethod.card.last4;
                  businessUpdate.paymentMethodBrand = paymentMethod.card.brand;
                  businessUpdate.defaultPaymentMethodId = pmId;
                }
              }
            }
          } catch (pmError) {
            console.error('Error fetching payment method in webhook:', pmError);
          }
        }

        await storage.updateBusinessSettings(userId, businessUpdate);
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

// Initialize all Stripe products and prices for TradieTrack subscription tiers
export async function initializeStripeProducts(): Promise<{
  success: boolean;
  products: {
    pro?: { productId: string; priceId: string };
    teamBase?: { productId: string; priceId: string };
    teamSeat?: { productId: string; priceId: string };
  };
  error?: string;
}> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, products: {}, error: 'Stripe not configured' };
  }

  try {
    const products: {
      pro?: { productId: string; priceId: string };
      teamBase?: { productId: string; priceId: string };
      teamSeat?: { productId: string; priceId: string };
    } = {};

    // Create Pro product and price
    const proPriceId = await getOrCreateProPrice(stripe);
    const proPrice = await stripe.prices.retrieve(proPriceId);
    products.pro = {
      productId: typeof proPrice.product === 'string' ? proPrice.product : proPrice.product.id,
      priceId: proPriceId,
    };

    // Create Team products and prices
    const { basePriceId, seatPriceId } = await getOrCreateTeamPrices(stripe);
    
    const basePrice = await stripe.prices.retrieve(basePriceId);
    products.teamBase = {
      productId: typeof basePrice.product === 'string' ? basePrice.product : basePrice.product.id,
      priceId: basePriceId,
    };

    const seatPrice = await stripe.prices.retrieve(seatPriceId);
    products.teamSeat = {
      productId: typeof seatPrice.product === 'string' ? seatPrice.product : seatPrice.product.id,
      priceId: seatPriceId,
    };

    console.log('✅ Stripe products initialized:', products);
    return { success: true, products };
  } catch (error: any) {
    console.error('Failed to initialize Stripe products:', error);
    return { success: false, products: {}, error: error.message };
  }
}

export interface UpgradeToTeamResult {
  success: boolean;
  subscriptionId?: string;
  trialEndsAt?: Date;
  error?: string;
}

export interface DowngradeToProResult {
  success: boolean;
  error?: string;
}

export async function downgradeTeamToPro(userId: string): Promise<DowngradeToProResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    
    if (!businessSettings?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }

    const currentSubscription = await stripe.subscriptions.retrieve(businessSettings.stripeSubscriptionId);
    
    if (currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return { success: false, error: 'Current subscription is not active' };
    }

    const currentTier = currentSubscription.metadata?.tier || businessSettings.subscriptionTier;
    if (currentTier !== 'team') {
      return { success: false, error: 'Current subscription is not a Team plan' };
    }

    const proPriceId = await getOrCreateProPrice(stripe);

    const items = currentSubscription.items.data;
    
    // Build update: Delete ALL existing items (base + seats) and add only Pro price
    // This properly handles multi-seat subscriptions by clearing everything
    const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] = [];
    
    // Mark ALL existing items for deletion
    for (const item of items) {
      itemUpdates.push({
        id: item.id,
        deleted: true,
      });
    }
    
    // Add the Pro price as a new item
    itemUpdates.push({
      price: proPriceId,
      quantity: 1,
    });

    const updatedSubscription = await stripe.subscriptions.update(
      businessSettings.stripeSubscriptionId,
      {
        items: itemUpdates,
        proration_behavior: 'none',
        metadata: {
          ...currentSubscription.metadata,
          tier: 'pro',
          seatCount: '0',
          downgradedFromTeam: 'true',
          downgradeDate: new Date().toISOString(),
        },
      }
    );

    await storage.updateUser(userId, {
      subscriptionTier: 'pro',
    });

    await storage.updateBusinessSettings(userId, {
      subscriptionTier: 'pro',
      seatCount: 0,
      subscriptionStatus: updatedSubscription.status,
    });

    const suspendedCount = await storage.suspendTeamMembersByOwner(userId);
    console.log(`[downgradeTeamToPro] Suspended ${suspendedCount} team members for user ${userId}`);

    return { success: true };
  } catch (error: any) {
    console.error('Error downgrading to Pro:', error);
    return { success: false, error: error.message || 'Failed to downgrade subscription' };
  }
}

/**
 * Upgrades a Pro subscription to Team with a trial period.
 * 
 * Seat count semantics:
 * - seats = 0: Just the owner (Team base price includes 1 user, no additional seat line items)
 * - seats = 1: Owner + 1 additional team member (adds 1 seat line item)
 * - seats = N: Owner + N additional team members (adds N seat line items)
 * 
 * The Team base price ($59/mo) always includes the owner seat.
 * Additional seats are $29/mo each.
 */
export async function upgradeProToTeamTrial(
  userId: string,
  seats: number = 0, // Default to 0 = just owner, no additional seats
  trialDays: number = 7
): Promise<UpgradeToTeamResult> {
  const stripe = await getUncachableStripeClient();
  if (!stripe) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const businessSettings = await storage.getBusinessSettings(userId);
    
    if (!businessSettings?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found to upgrade' };
    }

    if (!businessSettings?.stripeCustomerId) {
      return { success: false, error: 'No billing account found' };
    }

    const currentSubscription = await stripe.subscriptions.retrieve(businessSettings.stripeSubscriptionId);
    
    if (currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return { success: false, error: 'Current subscription is not active' };
    }

    const currentTier = currentSubscription.metadata?.tier || 'pro';
    if (currentTier === 'team') {
      return { success: false, error: 'Already on Team plan' };
    }

    const { basePriceId, seatPriceId } = await getOrCreateTeamPrices(stripe);

    const trialEndTimestamp = Math.floor(Date.now() / 1000) + (trialDays * 24 * 60 * 60);

    // Build subscription items:
    // - Replace current Pro item with Team base (includes owner)
    // - Only add seat line items if additional seats > 0
    const subscriptionItems: Stripe.SubscriptionUpdateParams.Item[] = [
      {
        id: currentSubscription.items.data[0].id,
        price: basePriceId,
      },
    ];

    // Add additional seat line items only if seats > 0
    // seats represents ADDITIONAL members beyond the owner
    if (seats > 0) {
      subscriptionItems.push({
        price: seatPriceId,
        quantity: seats,
      });
    }

    const updatedSubscription = await stripe.subscriptions.update(
      businessSettings.stripeSubscriptionId,
      {
        items: subscriptionItems,
        trial_end: trialEndTimestamp,
        proration_behavior: 'none',
        metadata: {
          ...currentSubscription.metadata,
          tier: 'team',
          seatCount: String(seats), // Additional seats beyond owner
          upgradedFromPro: 'true',
          upgradeTrialStart: new Date().toISOString(),
        },
      }
    );

    const trialEndsAt = new Date(trialEndTimestamp * 1000);

    await storage.updateUser(userId, {
      subscriptionTier: 'team',
      trialStatus: 'active',
      trialStartedAt: new Date(),
      trialEndsAt: trialEndsAt,
    });

    await storage.updateBusinessSettings(userId, {
      subscriptionTier: 'team',
      subscriptionStatus: updatedSubscription.status,
      trialStartDate: new Date(),
      trialEndDate: trialEndsAt,
    });

    return {
      success: true,
      subscriptionId: updatedSubscription.id,
      trialEndsAt,
    };
  } catch (error: any) {
    console.error('Error upgrading to team trial:', error);
    return { success: false, error: error.message || 'Failed to upgrade subscription' };
  }
}
