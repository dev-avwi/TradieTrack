import { Express } from 'express';
import { createNotification } from './notifications';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from './emailService';

export function setupStripeWebhooks(app: Express, stripe: any, storage: any) {
  if (!stripe) {
    console.log('⚠️ Stripe webhooks not available - Stripe not initialized');
    return;
  }

  // Stripe webhook endpoint (webhook signature verification)
  app.post('/api/webhooks/stripe', async (req: any, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set - webhook verification disabled');
      // In development, we can still process webhooks without verification
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).send('Webhook secret not configured');
      }
    }

    let event;

    try {
      // Verify webhook signature
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Development mode - use raw body
        event = req.body;
      }
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          console.log('✅ Checkout session completed:', session.id);

          // Get metadata from the checkout session
          const userId = session.metadata?.userId;
          const businessId = session.metadata?.businessId;
          const plan = session.metadata?.plan;

          if (!userId || !businessId) {
            console.warn('Missing userId or businessId in checkout session metadata');
            break;
          }

          // Update business settings with subscription info
          const businessSettings = await storage.getBusinessSettings(userId);
          if (businessSettings) {
            await storage.updateBusinessSettings(userId, {
              subscriptionTier: plan || 'pro',
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
            });

            // Create notification
            await createNotification(storage, {
              userId,
              type: 'payment_success',
              title: 'Payment Successful',
              message: `Your ${plan || 'Pro'} plan subscription is now active. Thank you!`,
              relatedType: 'subscription',
              relatedId: session.subscription as string,
            });

            // Send email
            try {
              const user = await storage.getUserById(userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, plan || 'Pro');
              }
            } catch (emailError) {
              console.error('Failed to send payment success email:', emailError);
            }
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          console.log('✅ Invoice payment succeeded:', invoice.id);

          // Find the business by Stripe customer ID
          const customerId = invoice.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // Create notification
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'payment_received',
              title: 'Payment Received',
              message: `Subscription payment of $${(invoice.amount_paid / 100).toFixed(2)} received successfully.`,
              relatedType: 'subscription',
              relatedId: invoice.subscription,
            });

            // Send receipt email
            try {
              const user = await storage.getUserById(businessSettings.userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, businessSettings.subscriptionTier || 'Pro');
              }
            } catch (emailError) {
              console.error('Failed to send payment receipt email:', emailError);
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.log('⚠️ Invoice payment failed:', invoice.id);

          // Find the business by Stripe customer ID
          const customerId = invoice.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // IMPORTANT: Do NOT suspend team members on payment_failed
            // Payment retries are transient - Stripe will retry automatically
            // Only suspend when subscription is definitively 'canceled' (handled in subscription.deleted)
            // Log the failure for monitoring but rely on subscription status webhooks for actual state changes
            console.log(`⚠️ Payment failed for user ${businessSettings.userId} - awaiting Stripe retry (no suspension)`);

            // Create notification to prompt user action
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'payment_failed',
              title: 'Payment Failed',
              message: 'Your subscription payment failed. Please update your payment method to avoid service interruption.',
              relatedType: 'subscription',
              relatedId: invoice.subscription,
            });

            // Send email
            try {
              const user = await storage.getUserById(businessSettings.userId);
              if (user && businessSettings.email) {
                await sendPaymentFailedEmail(user, businessSettings);
              }
            } catch (emailError) {
              console.error('Failed to send payment failed email:', emailError);
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          console.log('📝 Subscription updated:', subscription.id);

          const customerId = subscription.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            const previousStatus = businessSettings.subscriptionStatus;
            
            // Update subscription status
            await storage.updateBusinessSettings(businessSettings.userId, {
              subscriptionStatus: subscription.status,
            });

            // Handle status transitions for team member access
            if (subscription.status === 'past_due') {
              // Grace period - log warning but don't suspend yet
              console.log(`⚠️ Subscription ${subscription.id} is past_due for user ${businessSettings.userId} - grace period active`);
            } else if (subscription.status === 'active' && previousStatus === 'past_due') {
              // Subscription reactivated after being past_due - reactivate team members
              const reactivatedCount = await storage.reactivateTeamMembersByOwner(businessSettings.userId);
              console.log(`✅ Reactivated ${reactivatedCount} team members for user ${businessSettings.userId}`);
              
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'subscription_changed',
                title: 'Subscription Restored',
                message: 'Your subscription is now active and team member access has been restored.',
                relatedType: 'subscription',
                relatedId: subscription.id,
              });
            }

            // Create notification if subscription was canceled or paused
            if (subscription.status === 'canceled' || subscription.status === 'paused') {
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'subscription_changed',
                title: 'Subscription Updated',
                message: `Your subscription has been ${subscription.status}.`,
                relatedType: 'subscription',
                relatedId: subscription.id,
              });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          console.log('🗑️ Subscription deleted:', subscription.id);

          const customerId = subscription.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // Suspend all team members for this owner
            const suspendedCount = await storage.suspendTeamMembersByOwner(businessSettings.userId);
            console.log(`🔒 Suspended ${suspendedCount} team members for user ${businessSettings.userId}`);

            // Downgrade to free tier
            await storage.updateBusinessSettings(businessSettings.userId, {
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
            });

            // Create notification
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'subscription_canceled',
              title: 'Subscription Canceled',
              message: suspendedCount > 0 
                ? `Your subscription has been canceled and ${suspendedCount} team member(s) have been deactivated. You can reactivate anytime from Settings.`
                : 'Your subscription has been canceled. You can reactivate anytime from Settings.',
              relatedType: 'subscription',
              relatedId: subscription.id,
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  console.log('✅ Stripe webhooks configured at /api/webhooks/stripe');
}
