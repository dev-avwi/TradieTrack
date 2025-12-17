import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { createNotification } from './notifications';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendReceiptEmail } from './emailService';
import { processPaymentReceivedAutomation } from './automationService';
import { markInvoicePaidInXero } from './xeroService';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string, storage: any): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    if (!sync) {
      throw new Error('Stripe sync not initialized');
    }

    await sync.processWebhook(payload, signature, uuid);

    const stripe = await getUncachableStripeClient();
    if (!stripe) return;

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      await getWebhookSecretFromUuid(uuid)
    );

    await handleStripeEvent(event, storage);
  }

  static async processWebhookDirect(event: any, storage: any): Promise<void> {
    await handleStripeEvent(event, storage);
  }
}

async function getWebhookSecretFromUuid(uuid: string): Promise<string> {
  const sync = await getStripeSync();
  if (!sync) throw new Error('Stripe sync not initialized');
  
  const webhooks = await sync.listManagedWebhooks();
  const webhook = webhooks.find((w: any) => w.metadata?.uuid === uuid);
  if (!webhook || !webhook.secret) throw new Error('Webhook not found for UUID');
  
  return webhook.secret as string;
}

async function handleStripeEvent(event: any, storage: any) {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('✅ Checkout session completed:', session.id);

        const invoiceId = session.metadata?.invoiceId;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (invoiceId && userId) {
          const invoice = await storage.getInvoice(invoiceId, userId);
          if (invoice) {
            await storage.updateInvoice(invoiceId, userId, {
              status: 'paid',
              paidAt: new Date().toISOString(),
              paymentMethod: 'stripe',
              stripePaymentIntentId: session.payment_intent,
            });

            // Update linked job status if applicable (best effort, don't fail if this errors)
            if (invoice.jobId) {
              try {
                const job = await storage.getJob(invoice.jobId, userId);
                if (job && job.status !== 'invoiced') {
                  await storage.updateJob(invoice.jobId, userId, { status: 'invoiced' });
                }
              } catch (jobError) {
                console.log("Job status update skipped:", jobError);
              }
            }

            // Trigger automation rules for payment received (async, non-blocking)
            processPaymentReceivedAutomation(userId, invoiceId)
              .catch(err => console.error('[Automations] Error processing payment received:', err));

            // Sync payment status to Xero (async, non-blocking)
            markInvoicePaidInXero(userId, invoiceId)
              .catch(err => console.warn('[Xero] Error syncing payment to Xero:', err));

            await createNotification(storage, {
              userId,
              type: 'invoice_paid',
              title: 'Invoice Paid',
              message: `Invoice #${invoice.number || invoiceId.substring(0, 8).toUpperCase()} has been paid via Stripe.`,
              relatedType: 'invoice',
              relatedId: invoiceId,
            });

            // Send automatic payment receipt to the client
            // Only send if invoice hasn't already had a receipt sent (prevent duplicates)
            if (!invoice.receiptSentAt) {
              try {
                const client = invoice.clientId ? await storage.getClient(invoice.clientId, userId) : null;
                const businessSettings = await storage.getBusinessSettings(userId);
                
                if (client && client.email) {
                  // Update invoice with payment info for the receipt
                  const paidInvoice = {
                    ...invoice,
                    status: 'paid',
                    paidAt: new Date().toISOString(),
                    paymentMethod: 'stripe',
                  };
                  
                  try {
                    await sendReceiptEmail(paidInvoice, client, businessSettings || {});
                    // Mark receipt as sent to prevent duplicates
                    await storage.updateInvoice(invoiceId, userId, {
                      receiptSentAt: new Date().toISOString(),
                    });
                    console.log(`✅ Payment receipt sent to ${client.email} for invoice ${invoice.number || invoiceId.substring(0, 8).toUpperCase()}`);
                  } catch (sendGridError: any) {
                    // If SendGrid is not configured, log but don't fail
                    if (sendGridError.message?.includes('SendGrid') || sendGridError.message?.includes('not configured')) {
                      console.log('⚠️ SendGrid not configured - skipping payment receipt email');
                    } else {
                      throw sendGridError; // Re-throw other errors
                    }
                  }
                } else if (!client) {
                  console.log('⚠️ Client not found for invoice - skipping payment receipt email');
                } else {
                  console.log('⚠️ Client has no email address - skipping payment receipt email');
                }
              } catch (emailError) {
                // Log but don't throw - payment was still successful
                console.error('Failed to send payment receipt email:', emailError);
              }
            } else {
              console.log(`ℹ️ Receipt already sent for invoice ${invoice.number || invoiceId.substring(0, 8).toUpperCase()}`);
            }
          }
        }

        if (plan && userId) {
          const businessSettings = await storage.getBusinessSettings(userId);
          if (businessSettings) {
            await storage.updateBusinessSettings(userId, {
              subscriptionTier: plan,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
            });

            await createNotification(storage, {
              userId,
              type: 'payment_success',
              title: 'Payment Successful',
              message: `Your ${plan} plan subscription is now active. Thank you!`,
              relatedType: 'subscription',
              relatedId: session.subscription as string,
            });

            try {
              const user = await storage.getUserById(userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, plan);
              }
            } catch (emailError) {
              console.error('Failed to send payment success email:', emailError);
            }
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('✅ Invoice payment succeeded:', invoice.id);

        const customerId = invoice.customer;
        const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
        
        if (businessSettings) {
          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Subscription payment of $${(invoice.amount_paid / 100).toFixed(2)} received successfully.`,
            relatedType: 'subscription',
            relatedId: invoice.subscription,
          });

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

        const customerId = invoice.customer;
        const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
        
        if (businessSettings) {
          await storage.updateBusinessSettings(businessSettings.userId, {
            subscriptionStatus: 'past_due',
          });

          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: 'Your subscription payment failed. Please update your payment method to continue using Pro features.',
            relatedType: 'subscription',
            relatedId: invoice.subscription,
          });

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
          await storage.updateBusinessSettings(businessSettings.userId, {
            subscriptionStatus: subscription.status,
          });

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
          await storage.updateBusinessSettings(businessSettings.userId, {
            subscriptionTier: 'free',
            subscriptionStatus: 'canceled',
          });

          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'subscription_canceled',
            title: 'Subscription Canceled',
            message: 'Your subscription has been canceled. You can reactivate anytime from Settings.',
            relatedType: 'subscription',
            relatedId: subscription.id,
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('✅ Payment intent succeeded:', paymentIntent.id);
        
        // Check if this is a quote deposit payment
        const quoteId = paymentIntent.metadata?.quoteId;
        const paymentType = paymentIntent.metadata?.paymentType;
        
        if (quoteId && paymentType === 'quote_deposit') {
          const tradieUserId = paymentIntent.metadata?.tradieUserId;
          const quoteNumber = paymentIntent.metadata?.quoteNumber;
          const clientName = paymentIntent.metadata?.clientName || 'Client';
          
          try {
            // Get the quote and update deposit status
            const quote = await storage.getQuote(quoteId, tradieUserId);
            if (quote && !(quote as any).depositPaid) {
              // Mark deposit as paid
              await storage.updateQuote(quoteId, tradieUserId, {
                depositPaid: true,
                depositPaidAt: new Date(),
              } as any);
              
              // Notify the tradie
              await createNotification(storage, {
                userId: tradieUserId,
                type: 'quote_deposit_paid',
                title: 'Quote Deposit Received',
                message: `${clientName} has paid the deposit for Quote #${quoteNumber}.`,
                relatedType: 'quote',
                relatedId: quoteId,
              });
              
              console.log(`✅ Quote ${quoteNumber} deposit marked as paid via Stripe Connect`);
            }
          } catch (error) {
            console.error('Error processing quote deposit payment:', error);
          }
          break;
        }
        
        // Handle Connect payments (customer paying tradie invoice)
        const invoiceId = paymentIntent.metadata?.invoiceId;
        const tradieUserId = paymentIntent.metadata?.tradieUserId;
        
        if (invoiceId && tradieUserId) {
          try {
            // Get the invoice
            const invoice = await storage.getInvoice(invoiceId, tradieUserId);
            if (invoice && invoice.status !== 'paid') {
              // Mark invoice as paid
              await storage.updateInvoice(invoiceId, tradieUserId, {
                status: 'paid',
                paidAt: new Date().toISOString(),
                paymentMethod: 'stripe_connect',
                stripePaymentIntentId: paymentIntent.id,
              });
              
              // Notify the tradie
              await createNotification(storage, {
                userId: tradieUserId,
                type: 'invoice_paid',
                title: 'Invoice Paid',
                message: `Invoice #${invoice.number} has been paid online via card payment.`,
                relatedType: 'invoice',
                relatedId: invoiceId,
              });
              
              console.log(`✅ Invoice ${invoice.number} marked as paid via Stripe Connect`);
            }
          } catch (error) {
            console.error('Error processing Connect payment:', error);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('⚠️ Payment intent failed:', paymentIntent.id);
        
        // Notify tradie if this was a Connect payment attempt
        const invoiceId = paymentIntent.metadata?.invoiceId;
        const tradieUserId = paymentIntent.metadata?.tradieUserId;
        
        if (invoiceId && tradieUserId) {
          const invoice = await storage.getInvoice(invoiceId, tradieUserId);
          if (invoice) {
            await createNotification(storage, {
              userId: tradieUserId,
              type: 'payment_failed',
              title: 'Payment Attempt Failed',
              message: `A payment attempt for Invoice #${invoice.number} failed. The customer may need to try again.`,
              relatedType: 'invoice',
              relatedId: invoiceId,
            });
          }
        }
        break;
      }

      // Stripe Connect account events
      case 'account.updated': {
        const account = event.data.object;
        console.log('📝 Connect account updated:', account.id);
        
        // Find the tradie by their Connect account ID and update their status
        try {
          const businessSettings = await storage.getBusinessSettingsByConnectAccountId(account.id);
          if (businessSettings) {
            await storage.updateBusinessSettings(businessSettings.userId, {
              connectChargesEnabled: account.charges_enabled,
              connectPayoutsEnabled: account.payouts_enabled,
            });
            
            // Notify tradie when they complete onboarding
            if (account.charges_enabled && !businessSettings.connectChargesEnabled) {
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'connect_ready',
                title: 'Online Payments Ready',
                message: 'Your Stripe account is now set up! You can accept online card payments from customers.',
                relatedType: 'integration',
                relatedId: 'stripe_connect',
              });
              console.log(`✅ Connect account ${account.id} is now ready to accept payments`);
            }
          }
        } catch (error) {
          console.error('Error updating Connect account status:', error);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling Stripe event:', error);
    throw error;
  }
}
