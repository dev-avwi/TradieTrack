import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmailIntegration } from "@/components/EmailIntegration";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import StripeSetupGuide from "@/components/StripeSetupGuide";
import XeroSetupGuide from "@/components/XeroSetupGuide";
// MYOB integration removed per user request - focusing on Xero
// import MyobSetupGuide from "@/components/MyobSetupGuide";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CreditCard, 
  Mail, 
  CheckCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Settings,
  ArrowRight,
  Building2,
  Wallet,
  Info,
  Phone,
  MessageSquare,
  Send,
  Clock,
  FileText,
  BarChart3,
  Eye,
  EyeOff,
  HelpCircle,
  Calendar,
  ChevronDown,
  Shield
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SiStripe, SiGmail, SiXero } from "react-icons/si";
import { RefreshCw, Link2Off, Users } from "lucide-react";

interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
}

interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  message?: string;
}

// MYOB interface - kept for future use
// interface MyobStatus {
//   configured: boolean;
//   connected: boolean;
//   companyName?: string;
//   businessId?: string;
//   lastSyncAt?: string;
//   status?: string;
//   message?: string;
//   cfCredentialsSet?: boolean;
// }

interface ServiceHealth {
  name: string;
  status: 'ready' | 'demo' | 'error' | 'test' | 'not_connected';
  provider: string;
  managed: boolean;
  verified: boolean;
  testMode?: boolean;
  hasLiveKeys?: boolean;
  error: string | null;
  description: string;
}

interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  businessName?: string;
  email?: string;
}

interface HealthStatus {
  allReady: boolean;
  servicesReady: boolean;
  message: string;
  services: {
    payments: ServiceHealth;
    email: ServiceHealth;
    sendgrid?: ServiceHealth;
    twilio?: ServiceHealth;
  };
  stripeConnect?: StripeConnectStatus;
  checkedAt: string;
}

function getServiceIconBg(status: string | undefined, fetchFailed?: boolean) {
  if (status === 'ready') return 'bg-green-100 dark:bg-green-900/50';
  if (status === 'test') return 'bg-orange-100 dark:bg-orange-900/50';
  if (status === 'error' || fetchFailed) return 'bg-red-100 dark:bg-red-900/50';
  if (status === 'not_connected') return 'bg-gray-100 dark:bg-gray-800/50';
  return 'bg-blue-100 dark:bg-blue-900/50';
}

function getServiceIconColor(status: string | undefined, fetchFailed?: boolean) {
  if (status === 'ready') return 'text-green-600 dark:text-green-400';
  if (status === 'test') return 'text-orange-600 dark:text-orange-400';
  if (status === 'error' || fetchFailed) return 'text-red-600 dark:text-red-400';
  if (status === 'not_connected') return 'text-gray-500 dark:text-gray-400';
  return 'text-blue-600 dark:text-blue-400';
}

function ServiceBadge({ status, fetchFailed }: { status: string | undefined; fetchFailed?: boolean }) {
  if (status === 'ready') {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
        <CheckCircle className="w-3 h-3 mr-1" />
        Connected
      </Badge>
    );
  }
  if (status === 'test') {
    return (
      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Test Mode
      </Badge>
    );
  }
  if (status === 'error' || fetchFailed) {
    return (
      <Badge variant="outline" className="border-red-400 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
      Not Connected
    </Badge>
  );
}

interface TwilioSettings {
  twilioPhoneNumber: string | null;
  twilioSenderId: string | null;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioAuthTokenConfigured: boolean;
  platformTwilioConfigured: boolean;
  platformTwilioPhoneNumber: string | null;
}

export default function Integrations() {
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [twilioDialogOpen, setTwilioDialogOpen] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [showAuthToken, setShowAuthToken] = useState(false);
  const { toast } = useToast();

  // Handle OAuth callback success/error messages from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success === 'google_calendar_connected') {
      toast({
        title: "Google Calendar Connected",
        description: "Your Google Calendar has been successfully linked. Jobs will now sync automatically.",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/integrations');
    } else if (success === 'xero_connected') {
      toast({
        title: "Xero Connected",
        description: "Your Xero account has been successfully linked.",
      });
      window.history.replaceState({}, '', '/integrations');
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: error === 'xero_auth_failed' 
          ? "Failed to connect to Xero. Please try again."
          : error === 'google_calendar_auth_failed'
          ? "Failed to connect to Google Calendar. Please try again."
          : `Connection error: ${error}`,
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/integrations');
    }
  }, [toast]);

  const { data: health, isLoading, isError, refetch } = useQuery<HealthStatus>({
    queryKey: ['/api/integrations/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation to start Stripe Connect onboarding
  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe-connect/onboard');
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Stripe Connect setup",
        variant: "destructive",
      });
    },
  });

  // Mutation to open Stripe dashboard (GET request, not POST)
  const openDashboardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe-connect/dashboard', {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get dashboard link');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open Stripe dashboard",
        variant: "destructive",
      });
    },
  });

  // Xero integration queries and mutations
  const { data: xeroStatus, refetch: refetchXero } = useQuery<XeroStatus>({
    queryKey: ['/api/integrations/xero/status'],
  });

  const connectXeroMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/connect');
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Xero connection",
        variant: "destructive",
      });
    },
  });

  const disconnectXeroMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/disconnect');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "Xero has been disconnected successfully",
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect Xero",
        variant: "destructive",
      });
    },
  });

  const syncXeroContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/sync', { type: 'contacts' });
      return response.json();
    },
    onSuccess: (data: any) => {
      const result = data.result;
      const syncedCount = result?.synced || 0;
      const errorCount = result?.errors || 0;
      toast({
        title: "Contacts Synced",
        description: syncedCount > 0 
          ? `Imported ${syncedCount} contact${syncedCount !== 1 ? 's' : ''} from Xero${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`
          : "No new contacts to import",
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({
        title: "Contact Sync Failed",
        description: error.message || "Failed to sync contacts with Xero",
        variant: "destructive",
      });
    },
  });

  const syncXeroInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/sync', { type: 'invoices' });
      return response.json();
    },
    onSuccess: (data: any) => {
      const result = data.result;
      const syncedCount = result?.synced || 0;
      const errorCount = result?.errors || 0;
      toast({
        title: "Invoices Pushed",
        description: syncedCount > 0 
          ? `Pushed ${syncedCount} invoice${syncedCount !== 1 ? 's' : ''} to Xero${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`
          : "No invoices to push (all sent invoices already synced)",
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({
        title: "Invoice Push Failed",
        description: error.message || "Failed to push invoices to Xero",
        variant: "destructive",
      });
    },
  });

  // MYOB integration - Removed from UI per user request (focusing on Xero)
  // Backend routes remain available for future use

  // Google Calendar integration queries and mutations
  const { data: googleCalendarStatus, refetch: refetchGoogleCalendar } = useQuery<GoogleCalendarStatus>({
    queryKey: ['/api/integrations/google-calendar/status'],
  });

  const connectGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/google-calendar/connect');
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Google Calendar connection",
        variant: "destructive",
      });
    },
  });

  const disconnectGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/google-calendar/disconnect');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "Google Calendar has been disconnected successfully",
      });
      refetchGoogleCalendar();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect Google Calendar",
        variant: "destructive",
      });
    },
  });

  // Twilio SMS integration queries and mutations
  const { data: twilioSettings, refetch: refetchTwilio } = useQuery<TwilioSettings>({
    queryKey: ['/api/settings/sms-branding'],
  });

  const saveTwilioMutation = useMutation({
    mutationFn: async (data: { twilioAccountSid: string; twilioAuthToken: string; twilioPhoneNumber: string }) => {
      const response = await apiRequest('PUT', '/api/settings/sms-branding', data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your Twilio credentials have been saved successfully",
      });
      refetchTwilio();
      refetch();
      setTwilioDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Twilio settings",
        variant: "destructive",
      });
    },
  });

  const testTwilioMutation = useMutation({
    mutationFn: async (data: { twilioAccountSid: string; twilioAuthToken: string; twilioPhoneNumber: string }) => {
      const response = await apiRequest('POST', '/api/settings/sms-branding/test', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Connection Successful",
        description: data.message || "Twilio credentials are valid",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Twilio. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const handleOpenTwilioSetup = () => {
    // Pre-fill with existing values (don't show masked values in editable fields)
    setTwilioAccountSid('');
    setTwilioAuthToken('');
    setTwilioPhoneNumber(twilioSettings?.twilioPhoneNumber || '');
    setShowAuthToken(false);
    setTwilioDialogOpen(true);
  };

  const handleTestTwilio = () => {
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields before testing",
        variant: "destructive",
      });
      return;
    }
    testTwilioMutation.mutate({ twilioAccountSid, twilioAuthToken, twilioPhoneNumber });
  };

  const handleSaveTwilio = () => {
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields before saving",
        variant: "destructive",
      });
      return;
    }
    saveTwilioMutation.mutate({ twilioAccountSid, twilioAuthToken, twilioPhoneNumber });
  };

  const twilioConnected = twilioSettings?.twilioAuthTokenConfigured && twilioSettings?.twilioPhoneNumber;

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking your integrations...</p>
        </div>
      </PageShell>
    );
  }

  const fetchFailed = isError || !health;
  const stripeConnect = health?.stripeConnect;
  const payments = health?.services?.payments;
  const email = health?.services?.email;
  
  // Determine actual connection status
  const stripeConnected = stripeConnect?.connected && stripeConnect?.chargesEnabled && stripeConnect?.payoutsEnabled;
  const stripePartiallyConnected = stripeConnect?.connected && (!stripeConnect?.chargesEnabled || !stripeConnect?.payoutsEnabled);
  const stripeTestMode = payments?.status === 'test';
  const emailReady = email?.status === 'ready';
  
  // All integrations ready only if Stripe is fully connected
  const allReady = stripeConnected && emailReady;

  const handleConnectStripe = () => {
    connectStripeMutation.mutate();
  };

  const handleOpenDashboard = () => {
    openDashboardMutation.mutate();
  };

  return (
    <PageShell>
      <PageHeader
        title="Integrations"
        subtitle="Connect your payment and communication services"
      />

      {/* Status Banner */}
      {allReady ? (
        <Card className="border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Ready to Accept Payments
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your Stripe account is connected and ready. You can send invoices and collect payments!
                </p>
              </div>
              <Badge className="bg-green-600 hover:bg-green-700 text-white">
                <Sparkles className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : stripePartiallyConnected ? (
        <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                  Stripe Setup Incomplete
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Your Stripe account needs additional verification. Complete the setup to start accepting payments.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleOpenDashboard}
                disabled={openDashboardMutation.isPending}
              >
                {openDashboardMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Complete Setup
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : stripeTestMode ? (
        <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                  Test Mode Active
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Payments are in test mode - no real money will be processed. 
                  Connect your Stripe account to accept real payments.
                </p>
              </div>
              <Badge className="bg-orange-600 hover:bg-orange-700 text-white">
                Testing
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Settings className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                  Setup Your Payment Account
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Connect your Stripe account to start accepting online payments from clients.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {/* Stripe Connect Payment Processing */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stripeConnected ? 'bg-green-100 dark:bg-green-900/50' :
                  stripePartiallyConnected ? 'bg-orange-100 dark:bg-orange-900/50' :
                  'bg-gray-100 dark:bg-gray-800/50'
                }`}>
                  <SiStripe className={`w-5 h-5 ${
                    stripeConnected ? 'text-green-600 dark:text-green-400' :
                    stripePartiallyConnected ? 'text-orange-600 dark:text-orange-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">Payment Processing</CardTitle>
                  <p className="text-xs text-muted-foreground">Accept payments via Stripe</p>
                </div>
              </div>
              {stripeConnected ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : stripePartiallyConnected ? (
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Incomplete
                </Badge>
              ) : (
                <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {stripeConnected ? (
              <>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {stripeConnect?.businessName || 'Your Business'}
                    </span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Payments are processed and deposited directly to your bank account.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={handleOpenDashboard}
                    disabled={openDashboardMutation.isPending}
                    data-testid="button-stripe-dashboard"
                  >
                    {openDashboardMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        View Stripe Dashboard
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : stripePartiallyConnected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your Stripe account is connected but requires additional verification before you can receive payments.
                </p>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    {!stripeConnect?.chargesEnabled && "Charges not enabled. "}
                    {!stripeConnect?.payoutsEnabled && "Payouts not enabled. "}
                    Complete verification to activate.
                  </p>
                </div>
                <Button 
                  onClick={handleOpenDashboard}
                  disabled={openDashboardMutation.isPending}
                  className="w-full"
                  data-testid="button-complete-stripe"
                >
                  {openDashboardMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Settings className="w-4 h-4 mr-2" />
                      Complete Stripe Verification
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account to accept online payments from clients. 
                  Payments are deposited directly to your bank account.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Transaction fee:</strong> 2.5% + 30c per payment</p>
                      <p><strong>Payouts:</strong> Direct to your bank, typically 2-3 business days</p>
                      <p><strong>No monthly fees</strong> - only pay when you receive payments</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={handleConnectStripe}
                  disabled={connectStripeMutation.isPending}
                  className="w-full"
                  data-testid="button-connect-stripe"
                >
                  {connectStripeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Connect Your Stripe Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Email - Built-in Gmail Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/50">
                  <SiGmail className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">Email - Ready to Go!</CardTitle>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Send quotes and invoices from your Gmail</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Working
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Delivery Confidence Message */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    No setup needed - it just works!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Emails from your Gmail will land in your client's inbox, not spam. When you click "Send" on a quote or invoice, Gmail opens with everything ready.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Setup Checklist */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Setup Checklist
              </p>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">Email delivery connected</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">Quote templates ready</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">Invoice templates ready</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">Professional PDF generation</span>
                </div>
              </div>
            </div>

            {/* Test Email Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const subject = encodeURIComponent("Test Email from TradieTrack");
                  const body = encodeURIComponent("G'day!\n\nThis is a test email from TradieTrack to confirm your email is working correctly.\n\nCheers!");
                  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
                }}
                data-testid="button-test-email"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Test Email
              </Button>
              <span className="text-xs text-muted-foreground">Opens Gmail with a test message</span>
            </div>
            
            {/* How it works */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">How it works:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-medium">1</span>
                  Click "Send" on any quote or invoice
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-medium">2</span>
                  Gmail opens with a professional email + PDF attached
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-medium">3</span>
                  Review and hit "Send" in Gmail
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-medium">4</span>
                  Done! The email appears in your Sent folder
                </li>
              </ol>
            </div>

            {/* Australian Compliance Tips - Expandable */}
            <Collapsible className="border rounded-lg">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover-elevate rounded-lg">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">Australian Compliance Tips</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-start gap-2 text-xs">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Include your ABN on all quotes and invoices</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">GST should be clearly shown on invoices</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Keep records for 5 years (ATO requirement)</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Use tax invoices for transactions over $82.50 (inc. GST)</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Xero Accounting Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  xeroStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
                  xeroStatus?.configured ? 'bg-gray-100 dark:bg-gray-800/50' :
                  'bg-gray-100 dark:bg-gray-800/50'
                }`}>
                  <SiXero className={`w-5 h-5 ${
                    xeroStatus?.connected ? 'text-green-600 dark:text-green-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">Xero Accounting</CardTitle>
                  <p className="text-xs text-muted-foreground">Sync invoices and contacts with Xero</p>
                </div>
              </div>
              {xeroStatus?.connected ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : xeroStatus?.configured === false ? (
                <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                  Not Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {xeroStatus?.connected ? (
              <>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {xeroStatus.tenantName || 'Xero Organization'}
                    </span>
                  </div>
                  {xeroStatus.lastSyncAt && (
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Last synced: {new Date(xeroStatus.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Sync Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncXeroContactsMutation.mutate()}
                      disabled={syncXeroContactsMutation.isPending || syncXeroInvoicesMutation.isPending}
                      data-testid="button-sync-xero-contacts"
                    >
                      {syncXeroContactsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Users className="w-4 h-4 mr-2" />
                      )}
                      Sync Contacts
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncXeroInvoicesMutation.mutate()}
                      disabled={syncXeroInvoicesMutation.isPending || syncXeroContactsMutation.isPending}
                      data-testid="button-sync-xero-invoices"
                    >
                      {syncXeroInvoicesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Push Invoices
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contacts are imported from Xero. Sent invoices are pushed to Xero.
                  </p>
                </div>

                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectXeroMutation.mutate()}
                  disabled={disconnectXeroMutation.isPending}
                  className="w-full"
                  data-testid="button-disconnect-xero"
                >
                  {disconnectXeroMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Link2Off className="w-4 h-4 mr-2" />
                  )}
                  Disconnect Xero
                </Button>
              </>
            ) : xeroStatus?.configured === false ? (
              <XeroSetupGuide
                isConnected={false}
                isConfigured={false}
                onConnect={() => connectXeroMutation.mutate()}
                isConnecting={connectXeroMutation.isPending}
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Xero account to automatically sync invoices and contacts.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Two-way sync:</strong> Contacts and invoices stay in sync</p>
                      <p><strong>Automatic updates:</strong> Changes sync between platforms</p>
                      <p><strong>Australian business:</strong> Works with Xero AU</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => connectXeroMutation.mutate()}
                  disabled={connectXeroMutation.isPending}
                  className="w-full"
                  data-testid="button-connect-xero"
                >
                  {connectXeroMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <SiXero className="w-4 h-4 mr-2" />
                  )}
                  Connect to Xero
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar Integration */}
        <Card data-testid="card-google-calendar-integration">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  googleCalendarStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
                  googleCalendarStatus?.configured ? 'bg-gray-100 dark:bg-gray-800/50' :
                  'bg-gray-100 dark:bg-gray-800/50'
                }`}>
                  <Calendar className={`w-5 h-5 ${
                    googleCalendarStatus?.connected ? 'text-green-600 dark:text-green-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-base">Google Calendar</CardTitle>
                  <p className="text-xs text-muted-foreground">Sync scheduled jobs to your calendar</p>
                </div>
              </div>
              {googleCalendarStatus?.connected ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : googleCalendarStatus?.configured === false ? (
                <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                  Not Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {googleCalendarStatus?.connected ? (
              <>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {googleCalendarStatus.email || 'Google Calendar'}
                    </span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Jobs can now be synced to your calendar
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Features enabled:</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Sync scheduled jobs to calendar
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Automatic event reminders
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      View upcoming events
                    </li>
                  </ul>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => disconnectGoogleCalendarMutation.mutate()}
                  disabled={disconnectGoogleCalendarMutation.isPending}
                  className="w-full"
                  data-testid="button-disconnect-google-calendar"
                >
                  {disconnectGoogleCalendarMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Link2Off className="w-4 h-4 mr-2" />
                      Disconnect
                    </>
                  )}
                </Button>
              </>
            ) : googleCalendarStatus?.configured === false ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Google Calendar integration is not configured. Please contact support to enable this feature.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">
                      <p>GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET must be configured.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Google Calendar to automatically sync scheduled jobs. Never miss an appointment again.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>One-way sync:</strong> Jobs sync from TradieTrack to Calendar</p>
                      <p><strong>Event details:</strong> Job title, client, address, and notes</p>
                      <p><strong>Reminders:</strong> Automatic 60min and 15min reminders</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => connectGoogleCalendarMutation.mutate()}
                  disabled={connectGoogleCalendarMutation.isPending}
                  className="w-full"
                  data-testid="button-connect-google-calendar"
                >
                  {connectGoogleCalendarMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Calendar className="w-4 h-4 mr-2" />
                  )}
                  Connect Google Calendar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* MYOB Accounting Integration - Removed per user request, focusing on Xero */}
      </div>

      {/* Communication Services Section */}
      <div className="pt-6">
        <h3 className="text-lg font-semibold mb-2">Communication Services</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect these services to automate client communications
        </p>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Twilio SMS Notifications Card */}
          <Card data-testid="card-twilio-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    twilioConnected || health?.services?.twilio?.status === 'ready' 
                      ? 'bg-green-100 dark:bg-green-900/50' 
                      : 'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <Phone className={`w-5 h-5 ${
                      twilioConnected || health?.services?.twilio?.status === 'ready' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">SMS Notifications</CardTitle>
                    <p className="text-xs text-muted-foreground">Send SMS reminders and updates to clients</p>
                  </div>
                </div>
                {twilioConnected || health?.services?.twilio?.status === 'ready' ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {twilioConnected || health?.services?.twilio?.status === 'ready' ? (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      SMS integration is active
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your clients will receive SMS notifications for appointments and updates.
                    </p>
                    {twilioSettings?.twilioPhoneNumber && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        Phone: {twilioSettings.twilioPhoneNumber}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Active features:</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        SMS reminders sent automatically
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Two-way texting with clients
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Appointment confirmations
                      </li>
                    </ul>
                  </div>
                  
                  <Button 
                    variant="outline"
                    onClick={handleOpenTwilioSetup}
                    className="w-full"
                    data-testid="button-update-twilio"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Update Settings
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Twilio account to send SMS reminders and updates directly to your clients' phones.
                  </p>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><strong>You'll need:</strong> Your Twilio Account SID, Auth Token, and Phone Number</p>
                        <p><strong>Features:</strong> Job reminders, status updates, confirmations</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">What happens when connected:</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        SMS reminders sent automatically
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        Two-way texting with clients
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" />
                        Appointment confirmations
                      </li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={handleOpenTwilioSetup}
                    className="w-full"
                    data-testid="button-connect-twilio"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Connect Twilio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* SendGrid Email Automation Card */}
          <Card data-testid="card-sendgrid-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    health?.services?.sendgrid?.status === 'ready' 
                      ? 'bg-green-100 dark:bg-green-900/50' 
                      : 'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <Mail className={`w-5 h-5 ${
                      health?.services?.sendgrid?.status === 'ready' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Email Automation</CardTitle>
                    <p className="text-xs text-muted-foreground">Automatic email sending for quotes & invoices</p>
                  </div>
                </div>
                <ServiceBadge status={health?.services?.sendgrid?.status} fetchFailed={fetchFailed} />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {health?.services?.sendgrid?.status === 'ready' ? (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      Email automation is active
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Quotes and invoices are sent automatically without opening Gmail.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">What happens when connected:</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Emails send instantly (no Gmail popup)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Professional templates
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Delivery tracking
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect SendGrid to send emails automatically without opening Gmail.
                  </p>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><strong>Requires:</strong> SENDGRID_API_KEY</p>
                        <p><strong>Features:</strong> Instant sending, templates, tracking</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">What happens when connected:</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Send className="w-3 h-3" />
                        Emails send instantly (no Gmail popup)
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        Professional templates
                      </li>
                      <li className="flex items-center gap-2">
                        <BarChart3 className="w-3 h-3" />
                        Delivery tracking
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Optional Email Provider Integration */}
      <div className="pt-4">
        <h3 className="text-sm font-medium mb-3">Optional: Send Emails Automatically</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Want emails to send instantly without opening Gmail? Connect your email account below. 
          This is optional - the Gmail method above works great for most tradies.
        </p>
        <EmailIntegration />
      </div>

      {/* Stripe Setup Guide - shows when not fully connected */}
      {!stripeConnected && (
        <StripeSetupGuide
          isConnected={stripeConnected}
          isPartiallyConnected={stripePartiallyConnected}
          chargesEnabled={stripeConnect?.chargesEnabled || false}
          payoutsEnabled={stripeConnect?.payoutsEnabled || false}
          onConnect={handleConnectStripe}
          onOpenDashboard={handleOpenDashboard}
          isConnecting={connectStripeMutation.isPending}
        />
      )}

      {/* Twilio Setup Dialog */}
      <Dialog open={twilioDialogOpen} onOpenChange={setTwilioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Connect Twilio SMS
            </DialogTitle>
            <DialogDescription>
              Enter your Twilio credentials to enable SMS notifications for your clients.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Instructions */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p className="font-medium">Where to find your Twilio credentials:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
                    <li>Log in to your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Twilio Console</a></li>
                    <li>Find Account SID and Auth Token on the dashboard</li>
                    <li>Get your phone number from Phone Numbers → Manage → Active Numbers</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Account SID */}
            <div className="space-y-2">
              <Label htmlFor="twilio-sid">Account SID</Label>
              <Input
                id="twilio-sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={twilioAccountSid}
                onChange={(e) => setTwilioAccountSid(e.target.value)}
                data-testid="input-twilio-sid"
              />
              {twilioSettings?.twilioAccountSid && (
                <p className="text-xs text-muted-foreground">
                  Current: {twilioSettings.twilioAccountSid}
                </p>
              )}
            </div>

            {/* Auth Token */}
            <div className="space-y-2">
              <Label htmlFor="twilio-token">Auth Token</Label>
              <div className="relative">
                <Input
                  id="twilio-token"
                  type={showAuthToken ? "text" : "password"}
                  placeholder="Your Twilio Auth Token"
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value)}
                  className="pr-10"
                  data-testid="input-twilio-token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowAuthToken(!showAuthToken)}
                >
                  {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {twilioSettings?.twilioAuthTokenConfigured && (
                <p className="text-xs text-muted-foreground">
                  Current: {twilioSettings.twilioAuthToken || '••••••••'}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
              <Input
                id="twilio-phone"
                placeholder="+61412345678"
                value={twilioPhoneNumber}
                onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                data-testid="input-twilio-phone"
              />
              <p className="text-xs text-muted-foreground">
                Use E.164 format (e.g., +61412345678 for Australian numbers)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleTestTwilio}
                disabled={testTwilioMutation.isPending || !twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber}
                className="flex-1"
                data-testid="button-test-twilio"
              >
                {testTwilioMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Button
                onClick={handleSaveTwilio}
                disabled={saveTwilioMutation.isPending || !twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber}
                className="flex-1"
                data-testid="button-save-twilio"
              >
                {saveTwilioMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* How it works */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <h4 className="font-medium mb-3">Quick Guide: Getting Paid</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-primary font-bold">1</span>
              </div>
              <p className="text-sm font-medium">Connect Stripe</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your bank details so you can receive payments
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-primary font-bold">2</span>
              </div>
              <p className="text-sm font-medium">Send Invoice</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your client gets an email with a "Pay Now" button
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-primary font-bold">3</span>
              </div>
              <p className="text-sm font-medium">Get Paid</p>
              <p className="text-xs text-muted-foreground mt-1">
                Money goes to your bank in 2-3 business days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
