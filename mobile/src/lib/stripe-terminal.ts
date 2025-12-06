/**
 * Stripe Terminal SDK for Tap to Pay
 * 
 * This module provides NFC-based contactless payment functionality using
 * Stripe Terminal's Tap to Pay on iPhone/Android feature.
 * 
 * IMPORTANT: Tap to Pay requires:
 * 1. A native build (not Expo Go) - run `eas build`
 * 2. Apple Developer Program membership ($99/year)
 * 3. Tap to Pay entitlement from Apple
 * 4. Stripe account with Terminal enabled
 * 
 * The @stripe/stripe-terminal-react-native package must be installed
 * and linked in a native build.
 */

import { Platform } from 'react-native';

// Types for Stripe Terminal
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
}

export interface Reader {
  id: string;
  deviceType: 'tapToPay' | 'chipper' | 'wisepad' | 'stripeM2';
  serialNumber: string;
  status: 'online' | 'offline';
  batteryLevel?: number;
}

export type TerminalStatus = 
  | 'not_initialized'
  | 'initializing'
  | 'ready'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'collecting'
  | 'processing'
  | 'error';

export interface TerminalState {
  status: TerminalStatus;
  reader: Reader | null;
  error: string | null;
  paymentIntent: PaymentIntent | null;
}

// Check if Tap to Pay is available on this device
export const isTapToPayAvailable = (): boolean => {
  // Tap to Pay requires:
  // - iOS 15.4+ on iPhone XS or newer
  // - Android with NFC capability
  if (Platform.OS === 'ios') {
    const version = parseInt(Platform.Version as string, 10);
    return version >= 15;
  }
  if (Platform.OS === 'android') {
    // Android Tap to Pay is available on NFC-enabled devices
    return true;
  }
  return false;
};

// Placeholder class for Stripe Terminal functionality
// The actual implementation requires @stripe/stripe-terminal-react-native
// which needs a native build (EAS Build, not Expo Go)
class StripeTerminalService {
  private initialized = false;
  private status: TerminalStatus = 'not_initialized';
  private onStatusChange?: (status: TerminalStatus) => void;

  /**
   * Initialize Stripe Terminal
   * This connects to Stripe's servers and prepares for payment collection
   */
  async initialize(connectionToken: string): Promise<boolean> {
    try {
      this.updateStatus('initializing');
      
      // In a real implementation, this would:
      // 1. Call StripeTerminal.initialize() with the connection token
      // 2. Set up event listeners for reader connection changes
      // 3. Configure the SDK for the appropriate country (AU)
      
      console.log('[StripeTerminal] Initializing with connection token');
      
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.initialized = true;
      this.updateStatus('ready');
      return true;
    } catch (error) {
      console.error('[StripeTerminal] Initialization failed:', error);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Discover and connect to the built-in Tap to Pay reader
   * On iPhone, this uses the device's own NFC chip
   */
  async connectToLocalMobileReader(): Promise<Reader | null> {
    if (!this.initialized) {
      throw new Error('Stripe Terminal not initialized');
    }

    try {
      this.updateStatus('discovering');
      
      // In a real implementation, this would:
      // 1. Call StripeTerminal.discoverReaders({ simulated: false })
      // 2. Filter for the local mobile reader (Tap to Pay)
      // 3. Connect to it
      
      console.log('[StripeTerminal] Discovering Tap to Pay reader...');
      
      // Simulate discovery
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateStatus('connecting');
      
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const reader: Reader = {
        id: 'local_mobile_reader',
        deviceType: 'tapToPay',
        serialNumber: 'LOCAL_MOBILE',
        status: 'online',
        batteryLevel: 100,
      };
      
      this.updateStatus('connected');
      return reader;
    } catch (error) {
      console.error('[StripeTerminal] Reader connection failed:', error);
      this.updateStatus('error');
      return null;
    }
  }

  /**
   * Collect a payment using Tap to Pay
   * Customer taps their card on the back of the phone
   */
  async collectPayment(
    paymentIntentClientSecret: string,
    onCardPresented?: () => void
  ): Promise<PaymentIntent | null> {
    if (!this.initialized) {
      throw new Error('Stripe Terminal not initialized');
    }

    try {
      this.updateStatus('collecting');
      
      // In a real implementation, this would:
      // 1. Call StripeTerminal.retrievePaymentIntent(clientSecret)
      // 2. Call StripeTerminal.collectPaymentMethod(paymentIntent)
      // 3. Wait for customer to tap their card
      // 4. Call StripeTerminal.processPayment(paymentIntent)
      
      console.log('[StripeTerminal] Waiting for card tap...');
      
      // Simulate waiting for card tap (in real app, NFC prompt appears)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (onCardPresented) {
        onCardPresented();
      }
      
      this.updateStatus('processing');
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const paymentIntent: PaymentIntent = {
        id: 'pi_simulated_' + Date.now(),
        amount: 0, // Would come from actual payment intent
        currency: 'aud',
        status: 'succeeded',
      };
      
      this.updateStatus('connected');
      return paymentIntent;
    } catch (error) {
      console.error('[StripeTerminal] Payment collection failed:', error);
      this.updateStatus('error');
      return null;
    }
  }

  /**
   * Cancel an in-progress payment collection
   */
  async cancelCollectPayment(): Promise<void> {
    // In a real implementation, call StripeTerminal.cancelCollectPaymentMethod()
    console.log('[StripeTerminal] Canceling payment collection');
    this.updateStatus('connected');
  }

  /**
   * Disconnect from the reader
   */
  async disconnect(): Promise<void> {
    // In a real implementation, call StripeTerminal.disconnectReader()
    console.log('[StripeTerminal] Disconnecting reader');
    this.updateStatus('ready');
  }

  /**
   * Set a callback for status changes
   */
  onStatusUpdate(callback: (status: TerminalStatus) => void): void {
    this.onStatusChange = callback;
  }

  private updateStatus(status: TerminalStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  getStatus(): TerminalStatus {
    return this.status;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const stripeTerminal = new StripeTerminalService();
export default stripeTerminal;
