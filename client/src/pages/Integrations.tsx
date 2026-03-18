import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBusinessSettings, useUpdateBusinessSettings } from "@/hooks/use-business-settings";

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
  Phone,
  Send,
  FileText,
  Calendar,
  RefreshCw,
  Link2Off,
  Users,
} from "lucide-react";
import { SiStripe, SiGmail, SiXero } from "react-icons/si";

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

interface OutlookStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  message?: string;
}

interface MyobStatus {
  configured: boolean;
  connected: boolean;
  companyName?: string;
  businessId?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
  cfCredentialsSet?: boolean;
}

interface QuickBooksStatus {
  configured: boolean;
  connected: boolean;
  companyName?: string;
  lastSyncAt?: string;
  message?: string;
}

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

interface AccountingIntStatus {
  connected: boolean;
  name: string | null;
  lastSync: string | null;
  needsReconnect: boolean;
}

interface CalendarIntStatus {
  connected: boolean;
  email: string | null;
  needsReconnect: boolean;
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
  accounting?: {
    xero: AccountingIntStatus | null;
    quickbooks: AccountingIntStatus | null;
    myob: AccountingIntStatus | null;
  };
  calendar?: {
    googleCalendar: CalendarIntStatus | null;
    outlook: CalendarIntStatus | null;
  };
  needsReconnect?: boolean;
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
  const { toast } = useToast();
  
  const { data: businessSettings } = useBusinessSettings();
  const updateBusinessSettings = useUpdateBusinessSettings();
  const emailSendingMode = businessSettings?.emailSendingMode || 'manual';

  const [urlParamsHandled, setUrlParamsHandled] = useState(false);

  const { data: health, isLoading, isError, refetch } = useQuery<HealthStatus>({
    queryKey: ['/api/integrations/health'],
    refetchInterval: 30000,
  });

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

  const fullSyncXeroMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/full-sync');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Full Sync Complete",
        description: "All Xero data has been synced",
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({ title: "Full Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncXeroPaymentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/sync-payments-from-xero');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payments Synced",
        description: "Payment status has been synced from Xero",
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncXeroQuotesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/xero/sync-all-quotes');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quotes Synced",
        description: `Synced quotes to Xero`,
      });
      refetchXero();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: myobStatus, refetch: refetchMyob } = useQuery<MyobStatus>({
    queryKey: ['/api/integrations/myob/status'],
  });

  const connectMyobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/connect');
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
        description: error.message || "Failed to start MYOB connection",
        variant: "destructive",
      });
    },
  });

  const disconnectMyobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/disconnect');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "MYOB has been disconnected successfully",
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect MYOB",
        variant: "destructive",
      });
    },
  });

  const syncMyobContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/sync', { type: 'contacts' });
      return response.json();
    },
    onSuccess: (data: any) => {
      const syncedCount = data?.synced || 0;
      const errorCount = data?.errors?.length || 0;
      toast({
        title: "Contacts Synced",
        description: syncedCount > 0 
          ? `Imported ${syncedCount} contact${syncedCount !== 1 ? 's' : ''} from MYOB${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`
          : "No new contacts to import",
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({
        title: "Contact Sync Failed",
        description: error.message || "Failed to sync contacts with MYOB",
        variant: "destructive",
      });
    },
  });

  const syncMyobInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/sync', { type: 'invoices' });
      return response.json();
    },
    onSuccess: (data: any) => {
      const syncedCount = data?.synced || 0;
      const errorCount = data?.errors?.length || 0;
      toast({
        title: "Invoices Pushed",
        description: syncedCount > 0 
          ? `Pushed ${syncedCount} invoice${syncedCount !== 1 ? 's' : ''} to MYOB${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`
          : "No invoices to push",
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({
        title: "Invoice Push Failed",
        description: error.message || "Failed to push invoices to MYOB",
        variant: "destructive",
      });
    },
  });

  const syncMyobQuotesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/sync-quotes');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quotes Synced",
        description: `Synced ${data.synced} quote${data.synced !== 1 ? 's' : ''} to MYOB`,
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncMyobPaymentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/sync-payments');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payments Synced",
        description: `Updated ${data.updated} payment${data.updated !== 1 ? 's' : ''} from MYOB`,
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const fullSyncMyobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/myob/full-sync');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Full Sync Complete",
        description: "All MYOB data has been synced",
      });
      refetchMyob();
    },
    onError: (error: any) => {
      toast({ title: "Full Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const [quickbooksSyncError, setQuickbooksSyncError] = useState<string | undefined>();
  const { data: quickbooksStatus, refetch: refetchQuickbooks } = useQuery<QuickBooksStatus>({
    queryKey: ['/api/integrations/quickbooks/status'],
  });

  const connectQuickbooksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/connect');
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
        description: error.message || "Failed to start QuickBooks connection",
        variant: "destructive",
      });
    },
  });

  const disconnectQuickbooksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/disconnect');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "QuickBooks has been disconnected successfully",
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect QuickBooks",
        variant: "destructive",
      });
    },
  });

  const syncQuickbooksMutation = useMutation({
    mutationFn: async () => {
      setQuickbooksSyncError(undefined);
      const response = await apiRequest('POST', '/api/integrations/quickbooks/sync');
      return response.json();
    },
    onSuccess: (data: any) => {
      const contactsSync = data.contacts?.synced || 0;
      const invoicesSync = data.invoices?.synced || 0;
      toast({
        title: "Sync Complete",
        description: `Synced ${contactsSync} contact${contactsSync !== 1 ? 's' : ''} and ${invoicesSync} invoice${invoicesSync !== 1 ? 's' : ''} with QuickBooks`,
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      setQuickbooksSyncError(error.message || "Sync failed");
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync with QuickBooks",
        variant: "destructive",
      });
    },
  });

  const syncQbContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/sync-contacts');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Contacts Synced",
        description: `Synced ${data.synced} contact${data.synced !== 1 ? 's' : ''} to QuickBooks`,
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncQbInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/sync-invoices');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invoices Synced",
        description: `Synced ${data.synced} invoice${data.synced !== 1 ? 's' : ''} to QuickBooks`,
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncQbQuotesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/sync-quotes');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quotes Synced",
        description: `Synced ${data.synced} quote${data.synced !== 1 ? 's' : ''} to QuickBooks`,
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncQbPaymentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/sync-payments');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payments Synced",
        description: `Updated ${data.updated} payment${data.updated !== 1 ? 's' : ''} from QuickBooks`,
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const fullSyncQbMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/quickbooks/full-sync');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Full Sync Complete",
        description: "All QuickBooks data has been synced",
      });
      refetchQuickbooks();
    },
    onError: (error: any) => {
      toast({ title: "Full Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: googleCalendarStatus, refetch: refetchGoogleCalendar } = useQuery<GoogleCalendarStatus>({
    queryKey: ['/api/integrations/google-calendar/status'],
    staleTime: 0,
    gcTime: 0,
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

  const syncAllJobsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/google-calendar/sync-all-jobs');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Jobs Synced",
        description: `Successfully synced ${data.synced || 0} jobs to Google Calendar`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync jobs to Google Calendar",
        variant: "destructive",
      });
    },
  });

  const { data: outlookStatus, refetch: refetchOutlook } = useQuery<OutlookStatus>({
    queryKey: ['/api/integrations/outlook/status'],
    staleTime: 0,
    gcTime: 0,
  });

  const connectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/outlook/connect');
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
        description: error.message || "Failed to start Outlook connection",
        variant: "destructive",
      });
    },
  });

  const disconnectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/outlook/disconnect');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "Outlook has been disconnected successfully",
      });
      refetchOutlook();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect Outlook",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (urlParamsHandled) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success === 'google_calendar_connected') {
      setUrlParamsHandled(true);
      toast({
        title: "Google Calendar Connected",
        description: "Your Google Calendar has been successfully linked. Jobs will now sync automatically.",
      });
      refetchGoogleCalendar();
      window.history.replaceState({}, '', '/integrations');
    } else if (success === 'xero_connected') {
      setUrlParamsHandled(true);
      toast({
        title: "Xero Connected",
        description: "Your Xero account has been successfully linked.",
      });
      refetchXero();
      window.history.replaceState({}, '', '/integrations');
    } else if (success === 'quickbooks_connected' || urlParams.get('quickbooks') === 'connected') {
      setUrlParamsHandled(true);
      toast({
        title: "QuickBooks Connected",
        description: "Your QuickBooks account has been successfully linked.",
      });
      refetchQuickbooks();
      window.history.replaceState({}, '', '/integrations');
    } else if (success === 'outlook_connected') {
      setUrlParamsHandled(true);
      toast({
        title: "Outlook Connected",
        description: "Your Outlook account has been successfully linked. Emails will now send from your account.",
      });
      refetchOutlook();
      window.history.replaceState({}, '', '/integrations');
    } else if (urlParams.get('quickbooks') === 'error') {
      setUrlParamsHandled(true);
      const message = urlParams.get('message');
      toast({
        title: "QuickBooks Connection Failed",
        description: message || "Failed to connect to QuickBooks. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/integrations');
    } else if (error) {
      setUrlParamsHandled(true);
      toast({
        title: "Connection Failed",
        description: error === 'xero_auth_failed' 
          ? "Failed to connect to Xero. Please try again."
          : error === 'google_calendar_auth_failed'
          ? "Failed to connect to Google Calendar. Please try again."
          : error === 'invalid_state' || error === 'outlook_auth_failed'
          ? "Failed to connect to Outlook. Please try again."
          : `Connection error: ${error}`,
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/integrations');
    }
  }, [urlParamsHandled, toast, refetchGoogleCalendar, refetchXero, refetchQuickbooks, refetchOutlook]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const elementId = hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
      }, 500);
    }
  }, []);

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

  const stripeConnect = health?.stripeConnect;
  
  const stripeConnected = stripeConnect?.connected && stripeConnect?.chargesEnabled && stripeConnect?.payoutsEnabled;
  const stripePartiallyConnected = stripeConnect?.connected && (!stripeConnect?.chargesEnabled || !stripeConnect?.payoutsEnabled);

  const handleConnectStripe = () => {
    connectStripeMutation.mutate();
  };

  const handleOpenDashboard = () => {
    openDashboardMutation.mutate();
  };

  const connectedIntegrations = [
    health?.stripeConnect?.connected && health?.stripeConnect?.chargesEnabled ? 'Stripe' : null,
    health?.services?.email?.verified ? 'Email' : null,
    (health?.services?.twilio?.verified || health?.services?.twilio?.managed) ? 'SMS' : null,
    health?.accounting?.xero?.connected ? 'Xero' : null,
    health?.accounting?.quickbooks?.connected ? 'QuickBooks' : null,
    health?.accounting?.myob?.connected ? 'MYOB' : null,
    health?.calendar?.googleCalendar?.connected ? 'Google Calendar' : null,
    health?.calendar?.outlook?.connected ? 'Outlook' : null,
  ].filter(Boolean);
  
  const reconnectNeeded = [
    health?.accounting?.xero?.needsReconnect ? 'Xero' : null,
    health?.accounting?.quickbooks?.needsReconnect ? 'QuickBooks' : null,
    health?.accounting?.myob?.needsReconnect ? 'MYOB' : null,
    health?.calendar?.googleCalendar?.needsReconnect ? 'Google Calendar' : null,
    health?.calendar?.outlook?.needsReconnect ? 'Outlook' : null,
  ].filter(Boolean);

  return (
    <PageShell>
      <PageHeader
        title="Integrations"
        subtitle="Connect your tools and services"
      />

      <div className="space-y-8">
        {/* Connection Health Summary */}
        {health && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  reconnectNeeded.length > 0 ? 'bg-red-100 dark:bg-red-900/50' 
                  : connectedIntegrations.length > 0 ? 'bg-green-100 dark:bg-green-900/50' 
                  : 'bg-muted'
                }`}>
                  {reconnectNeeded.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : connectedIntegrations.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {reconnectNeeded.length > 0 
                      ? 'Reconnection Required' 
                      : connectedIntegrations.length > 0
                      ? `${connectedIntegrations.length} Integration${connectedIntegrations.length !== 1 ? 's' : ''} Active`
                      : 'Connection Status'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reconnectNeeded.length > 0
                      ? `${reconnectNeeded.join(', ')} ${reconnectNeeded.length === 1 ? 'needs' : 'need'} to be reconnected`
                      : connectedIntegrations.length > 0
                      ? connectedIntegrations.join(' · ')
                      : 'Connect your services below to get started'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {[
                  { name: 'Stripe', connected: health?.stripeConnect?.connected && health?.stripeConnect?.chargesEnabled },
                  { name: 'Email', connected: health?.services?.email?.verified },
                  { name: 'SMS', connected: health?.services?.twilio?.verified || health?.services?.twilio?.managed },
                  { name: 'Xero', connected: health?.accounting?.xero?.connected },
                  { name: 'QuickBooks', connected: health?.accounting?.quickbooks?.connected },
                  { name: 'MYOB', connected: health?.accounting?.myob?.connected },
                  { name: 'Google Cal', connected: health?.calendar?.googleCalendar?.connected },
                  { name: 'Outlook', connected: health?.calendar?.outlook?.connected },
                ].map((svc) => (
                  <div key={svc.name} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className={svc.connected ? 'text-foreground' : 'text-muted-foreground'}>{svc.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Payments */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Payments</h3>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    stripeConnected ? 'bg-purple-100 dark:bg-purple-900/50' :
                    stripePartiallyConnected ? 'bg-orange-100 dark:bg-orange-900/50' :
                    'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <SiStripe className={`w-5 h-5 ${
                      stripeConnected ? 'text-purple-600 dark:text-purple-400' :
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
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0">
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
            <CardContent className="pt-0 space-y-3">
              {stripeConnected ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    {stripeConnect?.businessName || 'Your Business'} — payments deposited to your bank account.
                  </p>
                  <Button 
                    variant="outline"
                    onClick={handleOpenDashboard}
                    disabled={openDashboardMutation.isPending}
                    data-testid="button-stripe-dashboard"
                  >
                    {openDashboardMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        View Dashboard
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </>
                    )}
                  </Button>
                </>
              ) : stripePartiallyConnected ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Your Stripe account needs additional verification before you can receive payments.
                  </p>
                  <Button 
                    onClick={handleOpenDashboard}
                    disabled={openDashboardMutation.isPending}
                    data-testid="button-complete-stripe"
                  >
                    {openDashboardMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    Complete Setup
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to accept online payments from clients.
                  </p>
                  <Button 
                    onClick={handleConnectStripe}
                    disabled={connectStripeMutation.isPending}
                    data-testid="button-connect-stripe"
                  >
                    {connectStripeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Connect Stripe
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Communication */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Communication</h3>

          {/* Email Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    emailSendingMode === 'automatic' 
                      ? 'bg-green-100 dark:bg-green-900/50' 
                      : 'bg-red-100 dark:bg-red-900/50'
                  }`}>
                    {emailSendingMode === 'automatic' ? (
                      <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <SiGmail className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {emailSendingMode === 'automatic' ? 'Email - Instant Sending' : 'Email - Gmail Review'}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {emailSendingMode === 'automatic' 
                        ? 'Quotes and invoices sent instantly via our servers'
                        : 'Review and send from your Gmail account'}
                    </p>
                  </div>
                </div>
                <Badge className={`border-0 ${
                  emailSendingMode === 'automatic' && health?.services?.email?.status === 'ready'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : emailSendingMode === 'automatic' && health?.services?.email?.status !== 'ready'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {emailSendingMode === 'automatic' && health?.services?.email?.status === 'ready' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Working</>
                  ) : emailSendingMode === 'automatic' ? (
                    <><AlertTriangle className="w-3 h-3 mr-1" />Check Setup</>
                  ) : (
                    <>Manual</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">When you email a quote or invoice:</p>
                <div className="space-y-2">
                  <div 
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      emailSendingMode === 'manual' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover-elevate'
                    }`}
                    onClick={() => {
                      updateBusinessSettings.mutate({ emailSendingMode: 'manual' });
                    }}
                    data-testid="option-email-manual"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        emailSendingMode === 'manual' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {emailSendingMode === 'manual' && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Review in Gmail first</p>
                        <p className="text-xs text-muted-foreground">Opens Gmail so you can check and personalise before sending</p>
                      </div>
                    </div>
                  </div>
                  <div 
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      emailSendingMode === 'automatic' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover-elevate'
                    }`}
                    onClick={() => {
                      updateBusinessSettings.mutate({ emailSendingMode: 'automatic' });
                    }}
                    data-testid="option-email-automatic"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        emailSendingMode === 'automatic' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {emailSendingMode === 'automatic' && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Send instantly</p>
                        <p className="text-xs text-muted-foreground">Emails go out immediately via our servers - faster for busy professionals</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {emailSendingMode === 'manual' ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const subject = encodeURIComponent("Test Email from JobRunner");
                      const body = encodeURIComponent("G'day!\n\nThis is a test email from JobRunner to confirm your email is working correctly.\n\nCheers!");
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
                    }}
                    data-testid="button-test-email"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await apiRequest('POST', '/api/integrations/test-email');
                        const data = await response.json();
                        toast({
                          title: data.success ? "Test Email Sent" : "Email Issue",
                          description: data.message || data.error || "A test email has been sent to your registered email address.",
                          variant: data.success ? "default" : "destructive",
                        });
                      } catch (error: any) {
                        let errorMsg = "Could not send test email. The email service API key may need to be refreshed.";
                        try {
                          const raw = error.message || '';
                          const jsonStr = raw.replace(/^\d{3}:\s*/, '');
                          const parsed = JSON.parse(jsonStr);
                          if (parsed.error) errorMsg = typeof parsed.error === 'string' && parsed.error === 'Unauthorized'
                            ? "The email service API key is expired or invalid. Please update it in your environment settings."
                            : parsed.error;
                        } catch {}
                        toast({
                          title: "Email Not Working",
                          description: errorMsg,
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-test-email-auto"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Outlook Card */}
          <Card data-testid="card-outlook-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    outlookStatus?.connected ? 'bg-blue-100 dark:bg-blue-900/50' :
                    'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <Mail className={`w-5 h-5 ${
                      outlookStatus?.connected ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Outlook / Microsoft 365</CardTitle>
                    <p className="text-xs text-muted-foreground">Send emails from your Outlook account</p>
                  </div>
                </div>
                {outlookStatus?.connected ? (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : outlookStatus?.configured === false ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {outlookStatus?.connected ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 inline mr-1" />
                    {outlookStatus.email || 'Outlook Account'} — quotes and invoices sent from your account.
                  </p>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectOutlookMutation.mutate()}
                    disabled={disconnectOutlookMutation.isPending}
                    data-testid="button-disconnect-outlook"
                  >
                    {disconnectOutlookMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Link2Off className="w-4 h-4 mr-2" />
                    )}
                    Disconnect Outlook
                  </Button>
                </>
              ) : outlookStatus?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  Outlook integration is being set up. This will be available soon — connect your Outlook or Microsoft 365 account to send quotes and invoices from your business email.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Outlook or Microsoft 365 account to send quotes and invoices directly from your business email.
                  </p>
                  <Button 
                    onClick={() => connectOutlookMutation.mutate()}
                    disabled={connectOutlookMutation.isPending}
                    data-testid="button-connect-outlook"
                  >
                    {connectOutlookMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Connect Outlook
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* SMS Card */}
          <Card id="twilio" data-testid="card-twilio-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/50">
                    <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">SMS Notifications</CardTitle>
                    <p className="text-xs text-muted-foreground">Send SMS reminders and updates to clients</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
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
            </CardContent>
          </Card>
        </div>

        {/* Accounting */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Accounting</h3>

          {/* Xero Card */}
          <Card data-testid="card-xero-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    xeroStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
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
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {xeroStatus?.connected ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{xeroStatus.tenantName || 'Xero Organization'}</span>
                    {xeroStatus.lastSyncAt && (
                      <span className="text-xs">— Last synced: {new Date(xeroStatus.lastSyncAt).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncXeroContactsMutation.mutate()}
                      disabled={syncXeroContactsMutation.isPending || fullSyncXeroMutation.isPending}
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
                      disabled={syncXeroInvoicesMutation.isPending || fullSyncXeroMutation.isPending}
                      data-testid="button-sync-xero-invoices"
                    >
                      {syncXeroInvoicesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Push Invoices
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncXeroQuotesMutation.mutate()}
                      disabled={syncXeroQuotesMutation.isPending || fullSyncXeroMutation.isPending}
                    >
                      {syncXeroQuotesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Push Quotes
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncXeroPaymentsMutation.mutate()}
                      disabled={syncXeroPaymentsMutation.isPending || fullSyncXeroMutation.isPending}
                    >
                      {syncXeroPaymentsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Wallet className="w-4 h-4 mr-2" />
                      )}
                      Sync Payments
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => fullSyncXeroMutation.mutate()}
                      disabled={fullSyncXeroMutation.isPending}
                    >
                      {fullSyncXeroMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Full Sync
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectXeroMutation.mutate()}
                      disabled={disconnectXeroMutation.isPending}
                      data-testid="button-disconnect-xero"
                    >
                      {disconnectXeroMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Link2Off className="w-4 h-4 mr-2" />
                      )}
                      Disconnect Xero
                    </Button>
                  </div>
                </>
              ) : xeroStatus?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  Xero integration is being set up. This will be available soon — sync your invoices, contacts and payments automatically.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Xero account to automatically sync invoices and contacts.
                  </p>
                  <Button 
                    onClick={() => connectXeroMutation.mutate()}
                    disabled={connectXeroMutation.isPending}
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

          {/* QuickBooks */}
          <Card data-testid="card-quickbooks-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    quickbooksStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
                    'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <Wallet className={`w-5 h-5 ${
                      quickbooksStatus?.connected ? 'text-green-600 dark:text-green-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">QuickBooks Online</CardTitle>
                    <p className="text-xs text-muted-foreground">Sync invoices, quotes and contacts with QuickBooks</p>
                  </div>
                </div>
                {quickbooksStatus?.connected ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : quickbooksStatus?.configured === false ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {quickbooksStatus?.connected ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{quickbooksStatus.companyName || 'QuickBooks Company'}</span>
                    {quickbooksStatus.lastSyncAt && (
                      <span className="text-xs">— Last synced: {new Date(quickbooksStatus.lastSyncAt).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncQbContactsMutation.mutate()}
                      disabled={syncQbContactsMutation.isPending || fullSyncQbMutation.isPending}
                    >
                      {syncQbContactsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Users className="w-4 h-4 mr-2" />
                      )}
                      Sync Contacts
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncQbInvoicesMutation.mutate()}
                      disabled={syncQbInvoicesMutation.isPending || fullSyncQbMutation.isPending}
                    >
                      {syncQbInvoicesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Push Invoices
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncQbQuotesMutation.mutate()}
                      disabled={syncQbQuotesMutation.isPending || fullSyncQbMutation.isPending}
                    >
                      {syncQbQuotesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Push Quotes
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncQbPaymentsMutation.mutate()}
                      disabled={syncQbPaymentsMutation.isPending || fullSyncQbMutation.isPending}
                    >
                      {syncQbPaymentsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Wallet className="w-4 h-4 mr-2" />
                      )}
                      Sync Payments
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => fullSyncQbMutation.mutate()}
                      disabled={fullSyncQbMutation.isPending}
                    >
                      {fullSyncQbMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Full Sync
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectQuickbooksMutation.mutate()}
                      disabled={disconnectQuickbooksMutation.isPending}
                    >
                      {disconnectQuickbooksMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Link2Off className="w-4 h-4 mr-2" />
                      )}
                      Disconnect QuickBooks
                    </Button>
                  </div>
                </>
              ) : quickbooksStatus?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  QuickBooks Online integration is being set up. This will be available soon — sync invoices, quotes and contacts automatically.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your QuickBooks Online account to automatically sync invoices, quotes and contacts.
                  </p>
                  <Button 
                    onClick={() => connectQuickbooksMutation.mutate()}
                    disabled={connectQuickbooksMutation.isPending}
                    data-testid="button-connect-quickbooks"
                  >
                    {connectQuickbooksMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Wallet className="w-4 h-4 mr-2" />
                    )}
                    Connect to QuickBooks
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* MYOB Card */}
          <Card data-testid="card-myob-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    myobStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
                    'bg-gray-100 dark:bg-gray-800/50'
                  }`}>
                    <Building2 className={`w-5 h-5 ${
                      myobStatus?.connected ? 'text-green-600 dark:text-green-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">MYOB AccountRight</CardTitle>
                    <p className="text-xs text-muted-foreground">Sync invoices, quotes and contacts with MYOB</p>
                  </div>
                </div>
                {myobStatus?.connected ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : myobStatus?.configured === false ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {myobStatus?.connected ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{myobStatus.companyName || 'MYOB Company File'}</span>
                    {myobStatus.lastSyncAt && (
                      <span className="text-xs">— Last synced: {new Date(myobStatus.lastSyncAt).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncMyobContactsMutation.mutate()}
                      disabled={syncMyobContactsMutation.isPending || fullSyncMyobMutation.isPending}
                      data-testid="button-sync-myob-contacts"
                    >
                      {syncMyobContactsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Users className="w-4 h-4 mr-2" />
                      )}
                      Sync Contacts
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncMyobInvoicesMutation.mutate()}
                      disabled={syncMyobInvoicesMutation.isPending || fullSyncMyobMutation.isPending}
                      data-testid="button-sync-myob-invoices"
                    >
                      {syncMyobInvoicesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Push Invoices
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncMyobQuotesMutation.mutate()}
                      disabled={syncMyobQuotesMutation.isPending || fullSyncMyobMutation.isPending}
                    >
                      {syncMyobQuotesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Push Quotes
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => syncMyobPaymentsMutation.mutate()}
                      disabled={syncMyobPaymentsMutation.isPending || fullSyncMyobMutation.isPending}
                    >
                      {syncMyobPaymentsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Wallet className="w-4 h-4 mr-2" />
                      )}
                      Sync Payments
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => fullSyncMyobMutation.mutate()}
                      disabled={fullSyncMyobMutation.isPending}
                    >
                      {fullSyncMyobMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Full Sync
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMyobMutation.mutate()}
                      disabled={disconnectMyobMutation.isPending}
                      data-testid="button-disconnect-myob"
                    >
                      {disconnectMyobMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Link2Off className="w-4 h-4 mr-2" />
                      )}
                      Disconnect MYOB
                    </Button>
                  </div>
                </>
              ) : myobStatus?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  MYOB AccountRight integration is being set up. This will be available soon — sync invoices, quotes and contacts automatically.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your MYOB AccountRight account to automatically sync invoices and contacts.
                  </p>
                  <Button 
                    onClick={() => connectMyobMutation.mutate()}
                    disabled={connectMyobMutation.isPending}
                    data-testid="button-connect-myob"
                  >
                    {connectMyobMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Building2 className="w-4 h-4 mr-2" />
                    )}
                    Connect to MYOB
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Calendar</h3>

          <Card data-testid="card-google-calendar-integration">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    googleCalendarStatus?.connected ? 'bg-green-100 dark:bg-green-900/50' :
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
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
                    Coming Soon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-300 text-gray-600 dark:text-gray-400">
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {googleCalendarStatus?.connected ? (
                <>
                  {googleCalendarStatus.email && (
                    <p className="text-sm text-muted-foreground" data-testid="text-google-calendar-email">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Connected to: {googleCalendarStatus.email}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => syncAllJobsMutation.mutate()}
                      disabled={syncAllJobsMutation.isPending}
                      data-testid="button-sync-all-jobs"
                    >
                      {syncAllJobsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync All Jobs
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => disconnectGoogleCalendarMutation.mutate()}
                      disabled={disconnectGoogleCalendarMutation.isPending}
                      data-testid="button-disconnect-google-calendar"
                    >
                      {disconnectGoogleCalendarMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Link2Off className="w-4 h-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : googleCalendarStatus?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  Google Calendar integration is being set up. This will be available soon — sync your scheduled jobs automatically.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Google Calendar to automatically sync scheduled jobs.
                  </p>
                  <Button 
                    onClick={() => connectGoogleCalendarMutation.mutate()}
                    disabled={connectGoogleCalendarMutation.isPending}
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
        </div>
      </div>
    </PageShell>
  );
}
