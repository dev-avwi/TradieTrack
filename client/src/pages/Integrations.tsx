import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmailIntegration } from "@/components/EmailIntegration";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Calendar,
  CloudOff
} from "lucide-react";
import { Link } from "wouter";
import { SiStripe, SiGmail } from "react-icons/si";

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

function CalendarSyncCard() {
  const { data: calendarStatus } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/calendar/status'],
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/50">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Calendar Sync</CardTitle>
              <p className="text-xs text-muted-foreground">Sync jobs with Google Calendar</p>
            </div>
          </div>
          {calendarStatus?.connected ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
              <CloudOff className="w-3 h-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3">
          {calendarStatus?.connected 
            ? "Your jobs are syncing with Google Calendar. Your team can see appointments on their calendars."
            : "Connect your Google Calendar to automatically sync scheduled jobs and keep your team coordinated."
          }
        </p>
        <Link href="/settings/calendar">
          <Button 
            variant={calendarStatus?.connected ? "outline" : "default"} 
            className="w-full"
            data-testid="button-calendar-sync"
          >
            {calendarStatus?.connected ? (
              <>
                <Settings className="w-4 h-4 mr-2" />
                Calendar Settings
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Connect Calendar
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: health, isLoading, isError, refetch } = useQuery<HealthStatus>({
    queryKey: ['/api/integrations/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation to start Stripe Connect onboarding
  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe-connect/onboard');
      return response;
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/50">
                  <SiGmail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Email via Gmail</CardTitle>
                  <p className="text-xs text-muted-foreground">Send quotes and invoices via your Gmail</p>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Built-in
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              When you send a quote or invoice, it opens your Gmail with a professional 
              email ready to send. Emails come from your address and appear in your Sent folder.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Info className="w-3 h-3" />
                No setup required - works with any Gmail account
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Sync */}
        <CalendarSyncCard />
      </div>

      {/* Optional Email Provider Integration */}
      <div className="pt-4">
        <h3 className="text-sm font-medium mb-3">Optional: Automatic Email Sending</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Connect your email provider to send emails automatically without opening Gmail each time.
        </p>
        <EmailIntegration />
      </div>

      {/* How it works */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <h4 className="font-medium mb-2">How payments work</h4>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">1. Connect Stripe:</strong> Set up your Stripe account 
              to receive payments. You'll need to verify your identity and add your bank details.
            </p>
            <p>
              <strong className="text-foreground">2. Send invoices:</strong> When you send an invoice, 
              your client gets a secure payment link they can use to pay online.
            </p>
            <p>
              <strong className="text-foreground">3. Get paid:</strong> Payments go directly to your 
              bank account, typically within 2-3 business days.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
