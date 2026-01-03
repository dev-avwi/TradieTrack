import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  StripeTerminalProvider as SDKProvider,
  useStripeTerminal as useSDKTerminal,
  type Reader,
  type PaymentIntent,
  type DiscoveryMethod,
} from '@stripe/stripe-terminal-react-native';
import { api } from './api';

export interface StripeTerminalState {
  isInitialized: boolean;
  isConnected: boolean;
  isCollecting: boolean;
  error: string | null;
  connectedReader: Reader | null;
  discoveredReaders: Reader[];
}

interface CollectPaymentParams {
  amount: number;
  currency: string;
  description?: string;
}

interface StripeTerminalContextValue extends StripeTerminalState {
  initializeTerminal: () => Promise<boolean>;
  discoverReaders: () => Promise<Reader[]>;
  connectReader: (reader: Reader) => Promise<boolean>;
  collectPayment: (params: CollectPaymentParams) => Promise<PaymentIntent | null>;
  cancelCollectPayment: () => Promise<boolean>;
  disconnectReader: () => Promise<boolean>;
  clearError: () => void;
}

const StripeTerminalContext = createContext<StripeTerminalContextValue | null>(null);

interface StripeTerminalProviderProps {
  children: ReactNode;
}

async function fetchConnectionToken(): Promise<string> {
  const response = await api.post<{ secret: string }>('/api/stripe-terminal/connection-token');
  
  if (response.error) {
    throw new Error(response.error);
  }
  
  if (!response.data?.secret) {
    throw new Error('No connection token received from server');
  }
  
  return response.data.secret;
}

function StripeTerminalContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StripeTerminalState>({
    isInitialized: false,
    isConnected: false,
    isCollecting: false,
    error: null,
    connectedReader: null,
    discoveredReaders: [],
  });

  const cancelableRef = useRef<{ cancel: () => Promise<void> } | null>(null);

  const {
    initialize,
    discoverReaders: sdkDiscoverReaders,
    connectLocalMobileReader,
    createPaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    cancelCollectPaymentMethod,
    disconnectReader: sdkDisconnectReader,
  } = useSDKTerminal();

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const initializeTerminal = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const { error } = await initialize();
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to initialize terminal',
          isInitialized: false 
        }));
        return false;
      }

      setState(prev => ({ ...prev, isInitialized: true }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize terminal';
      setState(prev => ({ ...prev, error: errorMessage, isInitialized: false }));
      return false;
    }
  }, [initialize]);

  const discoverReaders = useCallback(async (): Promise<Reader[]> => {
    try {
      setState(prev => ({ ...prev, error: null, discoveredReaders: [] }));

      const discoveryMethod: DiscoveryMethod = Platform.OS === 'ios' 
        ? 'localMobile' 
        : 'localMobile';

      const { error, readers } = await sdkDiscoverReaders({
        discoveryMethod,
        simulated: __DEV__,
      });

      if (error) {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to discover readers' 
        }));
        return [];
      }

      const discoveredReaders = readers || [];
      setState(prev => ({ ...prev, discoveredReaders }));
      return discoveredReaders;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to discover readers';
      setState(prev => ({ ...prev, error: errorMessage }));
      return [];
    }
  }, [sdkDiscoverReaders]);

  const connectReader = useCallback(async (reader: Reader): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const { error, reader: connectedReader } = await connectLocalMobileReader({
        reader,
        locationId: reader.locationId || undefined,
      });

      if (error) {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to connect to reader',
          isConnected: false 
        }));
        return false;
      }

      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        connectedReader: connectedReader || reader 
      }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to reader';
      setState(prev => ({ ...prev, error: errorMessage, isConnected: false }));
      return false;
    }
  }, [connectLocalMobileReader]);

  const collectPayment = useCallback(async ({
    amount,
    currency,
    description,
  }: CollectPaymentParams): Promise<PaymentIntent | null> => {
    try {
      setState(prev => ({ ...prev, error: null, isCollecting: true }));

      const response = await api.post<{ clientSecret: string; paymentIntentId: string }>(
        '/api/stripe-terminal/create-payment-intent',
        { 
          amount, 
          currency, 
          description,
          captureMethod: 'automatic',
        }
      );

      if (response.error || !response.data?.clientSecret) {
        throw new Error(response.error || 'Failed to create payment intent');
      }

      const { clientSecret } = response.data;

      const { paymentIntent: createdIntent, error: createError } = await createPaymentIntent({
        amount,
        currency,
        captureMethod: 'automatic',
      });

      if (createError) {
        throw new Error(createError.message || 'Failed to create payment intent on terminal');
      }

      const { paymentIntent: collectedIntent, error: collectError } = await collectPaymentMethod({
        paymentIntent: createdIntent!,
      });

      if (collectError) {
        if (collectError.code === 'Canceled') {
          setState(prev => ({ ...prev, isCollecting: false }));
          return null;
        }
        throw new Error(collectError.message || 'Failed to collect payment method');
      }

      const { paymentIntent: confirmedIntent, error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collectedIntent!,
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Failed to confirm payment');
      }

      setState(prev => ({ ...prev, isCollecting: false }));
      return confirmedIntent || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setState(prev => ({ ...prev, error: errorMessage, isCollecting: false }));
      return null;
    }
  }, [createPaymentIntent, collectPaymentMethod, confirmPaymentIntent]);

  const cancelCollectPayment = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await cancelCollectPaymentMethod();
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to cancel payment collection' 
        }));
        return false;
      }

      setState(prev => ({ ...prev, isCollecting: false }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel payment collection';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [cancelCollectPaymentMethod]);

  const disconnectReader = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await sdkDisconnectReader();
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to disconnect reader' 
        }));
        return false;
      }

      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        connectedReader: null 
      }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect reader';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [sdkDisconnectReader]);

  const contextValue: StripeTerminalContextValue = {
    ...state,
    initializeTerminal,
    discoverReaders,
    connectReader,
    collectPayment,
    cancelCollectPayment,
    disconnectReader,
    clearError,
  };

  return (
    <StripeTerminalContext.Provider value={contextValue}>
      {children}
    </StripeTerminalContext.Provider>
  );
}

export function StripeTerminalProvider({ children }: StripeTerminalProviderProps) {
  return (
    <SDKProvider
      logLevel="verbose"
      tokenProvider={fetchConnectionToken}
    >
      <StripeTerminalContextProvider>
        {children}
      </StripeTerminalContextProvider>
    </SDKProvider>
  );
}

export function useStripeTerminal(): StripeTerminalContextValue {
  const context = useContext(StripeTerminalContext);
  
  if (!context) {
    throw new Error('useStripeTerminal must be used within a StripeTerminalProvider');
  }
  
  return context;
}

export type { Reader, PaymentIntent };
