import { storage } from './storage';
import { searchAvailableNumbers, purchasePhoneNumber, createOrFindTwilioAddress } from './twilioClient';
import { createAssistant, importPhoneNumber, getWebhookUrl } from './vapiService';
import { createNotification } from './notifications';
import { logTeamActivity } from './activityService';

interface ProvisioningResult {
  success: boolean;
  phoneNumber?: string;
  assistantId?: string;
  error?: string;
}

export async function provisionAiReceptionist(userId: string): Promise<ProvisioningResult> {
  const stepErrors: string[] = [];

  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      await storage.createAiReceptionistConfig({
        userId,
        enabled: false,
        mode: 'always_on_message',
        voiceName: 'Jess',
        approvalStatus: 'provisioning',
      });
    } else {
      await storage.updateAiReceptionistConfig(userId, {
        approvalStatus: 'provisioning',
        provisioningError: null,
      });
    }

    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      throw new Error('Business settings not found. Please complete your business profile first.');
    }
    if (!settings.businessName) {
      throw new Error('Business name is required to provision the AI Receptionist.');
    }

    console.log(`[AI Provisioning] Starting provisioning for user ${userId} (${settings.businessName})`);

    // Step 1: Search for available AU number
    console.log(`[AI Provisioning] Step 1: Searching for available AU numbers...`);
    const searchResult = await searchAvailableNumbers({ limit: 5 });
    if (!searchResult.success || !searchResult.numbers || searchResult.numbers.length === 0) {
      throw new Error(`No Australian phone numbers available: ${searchResult.error || 'No numbers found'}`);
    }

    const selectedNumber = searchResult.numbers[0];
    console.log(`[AI Provisioning] Found number: ${selectedNumber.phoneNumber}`);

    // Step 2: Create/find Twilio address for number purchase
    console.log(`[AI Provisioning] Step 2: Setting up address for number purchase...`);
    let addressSid: string | undefined;
    if (settings.address) {
      const addressResult = await createOrFindTwilioAddress(userId, {
        businessName: settings.businessName,
        address: settings.address,
        customerName: settings.businessName,
      });
      if (addressResult.success && addressResult.addressSid) {
        addressSid = addressResult.addressSid;
      } else {
        console.warn(`[AI Provisioning] Address setup warning: ${addressResult.error} - proceeding without address`);
      }
    }

    // Step 3: Purchase the number
    console.log(`[AI Provisioning] Step 3: Purchasing number ${selectedNumber.phoneNumber}...`);
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.repl.co';
    const smsWebhookUrl = `https://${domain}/api/sms/webhook/incoming`;

    const purchaseResult = await purchasePhoneNumber(selectedNumber.phoneNumber, smsWebhookUrl, addressSid);
    if (!purchaseResult.success || !purchaseResult.phoneNumber) {
      throw new Error(`Failed to purchase phone number: ${purchaseResult.error || 'Unknown error'}`);
    }

    const purchasedNumber = purchaseResult.phoneNumber;
    const twilioNumberSid = purchaseResult.sid;
    console.log(`[AI Provisioning] Purchased: ${purchasedNumber} (SID: ${twilioNumberSid})`);

    // Step 4: Create Vapi assistant
    console.log(`[AI Provisioning] Step 4: Creating Vapi assistant...`);
    const webhookUrl = getWebhookUrl();
    const updatedConfig = await storage.getAiReceptionistConfig(userId);
    const transferNumbers = (updatedConfig?.transferNumbers || []) as Array<{ name: string; phone: string; priority: number }>;
    const businessHours = (updatedConfig?.businessHours || null) as { start: string; end: string; timezone: string; days: number[] } | null;

    const teamMembers = await storage.getTeamMembers(userId);
    const teamInfo = teamMembers
      .filter(m => m.isActive)
      .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: m.role || 'team member' }));

    const clients = await storage.getClients(userId);
    const catalogItems = await storage.getCatalogItems(userId);
    const services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: settings.industry || undefined,
      greeting: updatedConfig?.greeting || undefined,
      voice: updatedConfig?.voiceName || 'Jess',
      transferNumbers,
      businessHours: businessHours || undefined,
      webhookUrl,
      services,
      teamInfo,
      knownClientCount: clients.length,
    });

    console.log(`[AI Provisioning] Created assistant: ${assistant.id}`);

    // Step 5: Import number to Vapi
    console.log(`[AI Provisioning] Step 5: Importing number to Vapi...`);
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';

    let vapiPhoneNumberId: string | undefined;
    try {
      const vapiPhone = await importPhoneNumber(purchasedNumber, twilioAccountSid, twilioAuthToken, assistant.id);
      vapiPhoneNumberId = vapiPhone.id;
      console.log(`[AI Provisioning] Imported to Vapi: ${vapiPhoneNumberId}`);
    } catch (vapiImportError: any) {
      console.warn(`[AI Provisioning] Vapi import warning: ${vapiImportError.message} - assistant created without phone import`);
      stepErrors.push(`Phone import to Vapi: ${vapiImportError.message}`);
    }

    // Step 6: Save everything to database with pending_approval
    console.log(`[AI Provisioning] Step 6: Saving to database...`);
    await storage.updateAiReceptionistConfig(userId, {
      vapiAssistantId: assistant.id,
      vapiPhoneNumberId: vapiPhoneNumberId || null,
      dedicatedPhoneNumber: purchasedNumber,
      twilioNumberSid: twilioNumberSid || null,
      approvalStatus: 'pending_approval',
      provisioningError: stepErrors.length > 0 ? stepErrors.join('; ') : null,
      enabled: false,
      mode: updatedConfig?.mode === 'off' ? 'always_on_message' : (updatedConfig?.mode || 'always_on_message'),
      provisionedAt: new Date(),
    });

    await storage.updateBusinessSettings(userId, {
      dedicatedPhoneNumber: purchasedNumber,
    });

    // Notify the user
    await createNotification(storage, {
      userId,
      type: 'ai_receptionist_provisioned',
      title: 'AI Receptionist Set Up',
      message: 'Your AI Receptionist has been set up! Our team will review and activate it within 24 hours.',
      relatedType: 'ai_receptionist',
    });

    // Emit activity feed event
    await logTeamActivity({
      businessOwnerId: userId,
      actorUserId: userId,
      activityType: 'milestone',
      description: `AI Receptionist provisioned (pending approval) for ${settings.businessName}`,
      metadata: {
        type: 'ai_receptionist_provisioned',
        phoneNumber: purchasedNumber,
        assistantId: assistant.id,
      },
      isImportant: true,
    });

    console.log(`[AI Provisioning] Complete for user ${userId} - pending admin approval`);

    return {
      success: true,
      phoneNumber: purchasedNumber,
      assistantId: assistant.id,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown provisioning error';
    console.error(`[AI Provisioning] Failed for user ${userId}:`, errorMessage);

    // Update config with failure status
    try {
      const config = await storage.getAiReceptionistConfig(userId);
      if (config) {
        await storage.updateAiReceptionistConfig(userId, {
          approvalStatus: 'failed',
          provisioningError: errorMessage,
        });
      }
    } catch (updateErr) {
      console.error('[AI Provisioning] Failed to update config with error:', updateErr);
    }

    // Log error to error_logs
    try {
      const { db } = await import('./storage');
      const { errorLogs } = await import('@shared/schema');
      await (db as any).insert(errorLogs).values({
        id: crypto.randomUUID(),
        level: 'error',
        category: 'ai_receptionist_provisioning',
        message: errorMessage,
        userId,
        metadata: { stepErrors },
      });
    } catch (logErr) {
      console.error('[AI Provisioning] Failed to log error:', logErr);
    }

    // Notify user of failure
    try {
      await createNotification(storage, {
        userId,
        type: 'ai_receptionist_error',
        title: 'AI Receptionist Setup Issue',
        message: 'There was an issue setting up your AI Receptionist. Our team has been notified and will resolve it shortly.',
        relatedType: 'ai_receptionist',
      });
    } catch (notifErr) {
      console.error('[AI Provisioning] Failed to send failure notification:', notifErr);
    }

    // Emit failure activity feed event
    try {
      const settings = await storage.getBusinessSettings(userId);
      await logTeamActivity({
        businessOwnerId: userId,
        actorUserId: userId,
        activityType: 'milestone',
        description: `AI Receptionist provisioning failed for ${settings?.businessName || 'business'}: ${errorMessage}`,
        metadata: {
          type: 'ai_receptionist_provisioning_failed',
          error: errorMessage,
        },
        isImportant: true,
      });
    } catch (activityErr) {
      console.error('[AI Provisioning] Failed to log activity:', activityErr);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
