/**
 * Stripe Terminal Provider for Tap to Pay
 * 
 * This wrapper component provides Stripe Terminal SDK context to the app.
 * Tap to Pay enables NFC contactless payments directly on the phone.
 * 
 * REQUIREMENTS:
 * 1. Native build required (not Expo Go) - run `eas build`
 * 2. Apple Developer Program for iOS Tap to Pay
 * 3. Stripe account with Terminal enabled
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../lib/store';
import api from '../lib/api';

// The actual SDK is only available in native builds
// In Expo Go, we provide a fallback implementation
let StripeTerminalProviderSDK: any = null;
let useStripeTerminalSDK: any = null;

// Try to import the real SDK - will fail in Expo Go
try {
  const sdk = require('@stripe/stripe-terminal-react-native');
  StripeTerminalProviderSDK = sdk.StripeTerminalProvider;
  useStripeTerminalSDK = sdk.useStripeTerminal;
} catch (e) {
  console.log('[StripeTerminal] SDK not available - using fallback mode');
}

// Check if SDK is available (native build)
export const isStripeTerminalSDKAvailable = (): boolean => {
  return StripeTerminalProviderSDK !== null;
};

// Check if Tap to Pay is supported on this device
export const isTapToPaySupported = (): boolean => {
  if (!isStripeTerminalSDKAvailable()) {
    return false;
  }
  
  if (Platform.OS === 'ios') {
    // iPhone XS or later, iOS 16+
    const version = parseInt(Platform.Version as string, 10);
    return version >= 16;
  }
  
  if (Platform.OS === 'android') {
    // Android with NFC support
    return Platform.Version >= 26;
  }
  
  return false;
};

interface TerminalProviderProps {
  children: React.ReactNode;
}

/**
 * Stripe Terminal Provider Component
 * Wraps the app with Stripe Terminal context when SDK is available
 */
export function TerminalProvider({ children }: TerminalProviderProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  // Fetch connection token from backend
  const fetchTokenProvider = useCallback(async (): Promise<string> => {
    try {
      const response = await api.post<{ secret: string }>('/api/stripe/terminal-connection-token');
      
      if (response.error || !response.data?.secret) {
        throw new Error('Failed to fetch connection token');
      }
      
      return response.data.secret;
    } catch (error) {
      console.error('[StripeTerminal] Connection token fetch failed:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Only mark ready when user is authenticated
    setIsReady(isAuthenticated && !!user);
  }, [isAuthenticated, user]);

  // If SDK is not available (Expo Go), just render children
  if (!StripeTerminalProviderSDK) {
    console.log('[StripeTerminal] Running in fallback mode (Expo Go)');
    return <>{children}</>;
  }

  // If not authenticated, don't initialize Terminal
  if (!isReady) {
    return <>{children}</>;
  }

  return (
    <StripeTerminalProviderSDK
      logLevel="verbose"
      tokenProvider={fetchTokenProvider}
    >
      {children}
    </StripeTerminalProviderSDK>
  );
}

export default TerminalProvider;
