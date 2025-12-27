import { useQuery } from "@tanstack/react-query";

export interface IntegrationService {
  name: string;
  status: 'ready' | 'test' | 'demo' | 'not_connected' | 'error';
  provider: string;
  managed: boolean;
  verified: boolean;
  testMode?: boolean;
  hasLiveKeys?: boolean;
  error: string | null;
  description: string;
}

export interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  businessName: string | null;
  email: string | null;
}

export interface IntegrationHealth {
  allReady: boolean;
  servicesReady: boolean;
  message: string;
  services: {
    payments: IntegrationService;
    email: IntegrationService;
    sendgrid: IntegrationService;
    twilio: IntegrationService;
  };
  stripeConnect: StripeConnectStatus;
  checkedAt: string;
}

export function useIntegrationHealth() {
  return useQuery<IntegrationHealth>({
    queryKey: ['/api/integrations/health'],
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });
}

// Helper functions to check specific integrations
export function isTwilioReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.twilio?.verified === true;
}

export function isStripeReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.payments?.verified === true;
}

export function isSendGridReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.sendgrid?.verified === true;
}

export function isEmailReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.email?.verified === true;
}
