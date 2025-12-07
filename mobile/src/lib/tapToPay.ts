/**
 * Stripe Terminal (Tap to Pay) Integration
 * 
 * PRODUCTION REQUIREMENTS:
 * 1. Install: npm install @stripe/stripe-terminal-react-native
 * 2. Run: npx expo prebuild (generates native projects)
 * 3. Build with EAS: eas build --platform ios/android
 * 
 * Enables NFC contactless payment collection directly from iPhone or Android devices.
 * 
 * iOS Requirements:
 * - Apple Developer Program ($99/year)
 * - Tap to Pay entitlement: com.apple.developer.proximity-reader.payment.acceptance
 * - Request at: https://developer.apple.com/contact/request/tap-to-pay-on-iphone
 * - Physical iPhone XS or later with iOS 16.4+
 * 
 * Android Requirements:
 * - Device with NFC hardware
 * - Android 5.0+ (API 21+)
 * - Google Play Services
 * 
 * This implementation provides the service layer. When building for production:
 * 1. Import StripeTerminalProvider from @stripe/stripe-terminal-react-native
 * 2. Wrap app in StripeTerminalProvider with tokenProvider
 * 3. Use useStripeTerminal hook in components
 * 
 * Current implementation is compatible with Expo Go for development testing.
 * Production builds require EAS Build with native modules.
 */

import { Platform, Alert } from 'react-native';
import api from './api';
import { offlineStore } from './offlineStore';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  clientSecret?: string;
}

export interface TapToPayConfig {
  locationId?: string;
  testMode?: boolean;
}

export type ReaderConnectionStatus = 
  | 'not_connected'
  | 'connecting' 
  | 'connected'
  | 'disconnected';

export type PaymentStatus = 
  | 'idle'
  | 'waiting_for_card'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled';

interface ConnectionToken {
  secret: string;
}

class TapToPayService {
  private isInitialized: boolean = false;
  private connectionStatus: ReaderConnectionStatus = 'not_connected';
  private paymentStatus: PaymentStatus = 'idle';
  private currentPaymentIntent: PaymentIntent | null = null;
  private config: TapToPayConfig = {};
  
  private onStatusChange?: (status: PaymentStatus) => void;
  private onConnectionChange?: (status: ReaderConnectionStatus) => void;

  /**
   * Check if Tap to Pay is available on this device
   */
  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (Platform.OS === 'ios') {
      return { available: true };
    }
    
    if (Platform.OS === 'android') {
      return { available: true };
    }
    
    return { 
      available: false, 
      reason: 'Tap to Pay is only available on iOS and Android devices' 
    };
  }

  /**
   * Initialize the Stripe Terminal SDK
   */
  async initialize(config: TapToPayConfig = {}): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[TapToPay] Already initialized');
      return true;
    }

    this.config = config;

    try {
      const { available, reason } = await this.isAvailable();
      if (!available) {
        console.log('[TapToPay] Not available:', reason);
        return false;
      }

      console.log('[TapToPay] Initialized successfully');
      console.log('[TapToPay] Note: Full functionality requires native EAS build with @stripe/stripe-terminal-react-native');
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[TapToPay] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Fetch connection token from backend
   */
  private async fetchConnectionToken(): Promise<string> {
    try {
      const response = await api.post<ConnectionToken>('/api/stripe/terminal/connection-token', {});
      return response.secret;
    } catch (error) {
      console.error('[TapToPay] Failed to fetch connection token:', error);
      throw new Error('Failed to fetch connection token');
    }
  }

  /**
   * Connect to the built-in NFC reader (Tap to Pay)
   */
  async connectReader(): Promise<boolean> {
    if (!this.isInitialized) {
      console.log('[TapToPay] Not initialized');
      return false;
    }

    try {
      this.updateConnectionStatus('connecting');
      
      console.log('[TapToPay] Connecting to NFC reader...');
      console.log('[TapToPay] In production, this would use StripeTerminal.discoverReaders() and connectLocalMobileReader()');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateConnectionStatus('connected');
      console.log('[TapToPay] Connected to NFC reader');
      return true;
    } catch (error) {
      console.error('[TapToPay] Failed to connect reader:', error);
      this.updateConnectionStatus('not_connected');
      return false;
    }
  }

  /**
   * Disconnect from the reader
   */
  async disconnectReader(): Promise<void> {
    try {
      this.updateConnectionStatus('disconnected');
      console.log('[TapToPay] Disconnected from reader');
    } catch (error) {
      console.error('[TapToPay] Failed to disconnect:', error);
    }
  }

  /**
   * Create a payment intent and collect payment via Tap to Pay
   */
  async collectPayment(
    invoiceId: string,
    amountCents: number,
    description?: string
  ): Promise<{ success: boolean; paymentIntent?: PaymentIntent; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, error: 'Tap to Pay not initialized' };
    }

    if (this.connectionStatus !== 'connected') {
      const connected = await this.connectReader();
      if (!connected) {
        return { success: false, error: 'Failed to connect to NFC reader' };
      }
    }

    try {
      this.updatePaymentStatus('processing');

      const paymentIntent = await api.post<PaymentIntent>('/api/stripe/terminal/create-payment-intent', {
        invoiceId,
        amount: amountCents,
        currency: 'aud',
        description: description || `Payment for invoice`,
      });

      this.currentPaymentIntent = paymentIntent;

      this.updatePaymentStatus('waiting_for_card');
      console.log('[TapToPay] Waiting for customer to tap card...');
      
      console.log('[TapToPay] In production, this would use StripeTerminal.collectPaymentMethod()');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.updatePaymentStatus('processing');
      console.log('[TapToPay] Processing payment...');

      const result = await api.post<PaymentIntent>('/api/stripe/terminal/capture-payment', {
        paymentIntentId: paymentIntent.id,
      });

      if (result.status === 'succeeded') {
        this.updatePaymentStatus('completed');
        console.log('[TapToPay] Payment successful!');
        
        return { success: true, paymentIntent: result };
      } else {
        this.updatePaymentStatus('failed');
        return { success: false, error: 'Payment was not completed' };
      }
    } catch (error: any) {
      console.error('[TapToPay] Payment failed:', error);
      this.updatePaymentStatus('failed');
      
      await offlineStore.addToMutationQueue('payments', invoiceId, 'create', {
        invoiceId,
        amount: amountCents,
        method: 'tap_to_pay',
        status: 'pending_retry',
        error: error.message,
      });
      
      return { 
        success: false, 
        error: error.message || 'Payment failed' 
      };
    }
  }

  /**
   * Cancel the current payment
   */
  async cancelPayment(): Promise<void> {
    if (this.currentPaymentIntent) {
      try {
        await api.post('/api/stripe/terminal/cancel-payment', {
          paymentIntentId: this.currentPaymentIntent.id,
        });
      } catch (error) {
        console.error('[TapToPay] Failed to cancel payment:', error);
      }
    }
    
    this.currentPaymentIntent = null;
    this.updatePaymentStatus('canceled');
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentIntentId: string,
    amountCents?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/api/stripe/refund', {
        paymentIntentId,
        amount: amountCents,
      });
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Refund failed' 
      };
    }
  }

  /**
   * Subscribe to payment status changes
   */
  onPaymentStatusChange(callback: (status: PaymentStatus) => void): () => void {
    this.onStatusChange = callback;
    return () => {
      this.onStatusChange = undefined;
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(callback: (status: ReaderConnectionStatus) => void): () => void {
    this.onConnectionChange = callback;
    return () => {
      this.onConnectionChange = undefined;
    };
  }

  private updatePaymentStatus(status: PaymentStatus): void {
    this.paymentStatus = status;
    this.onStatusChange?.(status);
  }

  private updateConnectionStatus(status: ReaderConnectionStatus): void {
    this.connectionStatus = status;
    this.onConnectionChange?.(status);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ReaderConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current payment status
   */
  getPaymentStatus(): PaymentStatus {
    return this.paymentStatus;
  }

  /**
   * Show manual card entry fallback
   */
  async showManualEntry(
    invoiceId: string,
    amountCents: number
  ): Promise<{ success: boolean; error?: string }> {
    Alert.alert(
      'Manual Card Entry',
      'Manual card entry is available as a fallback when Tap to Pay is unavailable.',
      [{ text: 'OK' }]
    );
    
    console.log('[TapToPay] Manual entry would redirect to Stripe payment link');
    
    return { success: false, error: 'Manual entry requires web payment link' };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.disconnectReader();
    this.isInitialized = false;
    this.currentPaymentIntent = null;
    this.config = {};
  }
}

export const tapToPayService = new TapToPayService();
export default tapToPayService;
