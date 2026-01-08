import { useState, useEffect, useRef, useCallback } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, clearSessionToken, getSessionToken } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { NetworkProvider } from "@/contexts/NetworkContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import AuthFlow from "@/components/AuthFlow";
import SimpleOnboarding from "@/components/SimpleOnboarding";
import OnboardingWizard, { type OnboardingData } from "@/components/OnboardingWizard";
import { useCompleteOnboarding } from "@/hooks/useCompleteOnboarding";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { getTradeInfo } from "@/data/tradeTypes";

// Import components
import AppSidebar from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import FloatingAIChat from "@/components/FloatingAIChat";
import PaymentToastProvider from "@/components/PaymentToastProvider";
import RouteGuard from "@/components/RouteGuard";
import Dashboard from "@/components/Dashboard";
import JobsList from "@/components/JobsList";
import ClientsList from "@/components/ClientsList";
import QuotesList from "@/components/QuotesList";
import QuoteForm from "@/components/QuoteForm";
import QuoteDetailView from "@/components/QuoteDetailView";
import JobForm from "@/components/JobForm";
import JobEditForm from "@/components/JobEditForm";
import InvoiceForm from "@/components/InvoiceForm";
import DocumentEditor from "@/components/DocumentEditor";
import LiveQuoteEditor from "@/components/LiveQuoteEditor";
import LiveInvoiceEditor from "@/components/LiveInvoiceEditor";
import ClientForm from "@/components/ClientForm";
import InvoiceDetailView from "@/components/InvoiceDetailView";
import ReceiptDetailView from "@/components/ReceiptDetailView";
import ClientDetailView from "@/components/ClientDetailView";
import JobDetailView from "@/components/JobDetailView";
import JobCompletion from "@/components/JobCompletion";
import InvoicesList from "@/components/InvoicesList";
import CalendarView from "@/components/CalendarView";
import Settings from "@/components/Settings";
import EmailSetupGuide from "@/components/EmailSetupGuide";
import More from "@/pages/More";
import Integrations from "@/pages/Integrations";
import NotFound from "@/pages/not-found";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailPending from "@/pages/VerifyEmailPending";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvite from "@/pages/AcceptInvite";
import QuoteModal from "@/components/QuoteModal";
import InvoiceModal from "@/components/InvoiceModal";
import TimeTrackingPage from "@/pages/TimeTracking";
import TeamOperations from "@/pages/TeamOperations";
import PaymentPage from "@/pages/PaymentPage";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import TrackArrival from "@/pages/TrackArrival";
import Reports from "@/pages/Reports";
import CollectPayment from "@/pages/CollectPayment";
import TeamChatPage from "@/pages/TeamChat";
import ChatHub from "@/pages/ChatHub";
import JobMapPage from "@/pages/JobMap";
import DirectMessagesPage from "@/pages/DirectMessages";
import DispatchBoard from "@/pages/DispatchBoard";
import SchedulePage from "@/pages/SchedulePage";
import Automations from "@/pages/Automations";
import RecurringJobs from "@/pages/RecurringJobs";
import Leads from "@/pages/Leads";
import PaymentHub from "@/pages/PaymentHub";
import WorkPage from "@/pages/WorkPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminAppShell from "@/components/AdminAppShell";
import GuidedTour, { useGuidedTour } from "@/components/GuidedTour";
import LandingPage from "@/pages/LandingPage";
import SubscriptionPage from "@/pages/SubscriptionPage";
import TemplatesHub from "@/pages/TemplatesHub";
import DocumentsHub from "@/pages/DocumentsHub";
import CommunicationsHub from "@/pages/CommunicationsHub";
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "@/components/KeyboardShortcuts";
import FirstTimeWalkthrough from "@/components/FirstTimeWalkthrough";
import ImmersiveOnboarding from "@/components/ImmersiveOnboarding";

// Types for job completion
interface JobPhoto {
  url: string;
  description?: string;
  uploadedAt: string;
}

interface JobData {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  address?: string;
  scheduledAt?: string;
  status: 'pending' | 'in_progress' | 'done';
  photos?: JobPhoto[];
}

interface ClientData {
  id: string;
  name: string;
}

// Public Receipt Redirect - redirects to PDF download for SMS links
function PublicReceiptRedirect({ token }: { token: string }) {
  useEffect(() => {
    if (token) {
      window.location.href = `/api/public/receipt/${token}/pdf`;
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="public-receipt-redirect">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Downloading your receipt...</p>
      </div>
    </div>
  );
}

// Stable Settings wrapper - prevents remounting on parent re-renders
function SettingsWrapper() {
  return (
    <Settings 
      onSave={(data) => console.log('Settings saved:', data)}
      onUploadLogo={(file) => console.log('Logo uploaded:', file.name)}
      onUpgradePlan={() => console.log('Upgrade plan')}
    />
  );
}

// Job Completion Wrapper with real data fetching
function JobCompletionWrapper({ jobId, onComplete, onCancel }: {
  jobId: string;
  onComplete: (jobId: string) => void;
  onCancel: () => void;
}) {
  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<JobData>({
    queryKey: [`/api/jobs`, jobId],
  });

  const { data: client, isLoading: clientLoading } = useQuery<ClientData>({
    queryKey: [`/api/clients`, job?.clientId],
    enabled: !!job?.clientId,
  });

  const isLoading = jobLoading || clientLoading;
  const error = jobError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load job details</p>
          <button 
            onClick={onCancel}
            className="text-primary hover:underline"
            data-testid="button-back-to-jobs"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <JobCompletion 
      job={{
        id: job.id,
        title: job.title,
        description: job.description || '',
        clientName: client?.name || 'Unknown Client',
        address: job.address || '',
        scheduledAt: job.scheduledAt,
        status: job.status,
        photos: job.photos || []
      }}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

// Main router component
function Router({ 
  onNavigate, 
  onShowQuoteModal, 
  onShowInvoiceModal 
}: { 
  onNavigate: (path: string) => void;
  onShowQuoteModal: (quoteId: string) => void;
  onShowInvoiceModal: (invoiceId: string) => void;
}) {
  const [location] = useLocation();

  return (
    <Switch location={location}>
      {/* Work page - unified job workflow view */}
      <Route path="/work" component={() => (
        <WorkPage 
          onViewJob={(id) => onNavigate(`/jobs/${id}`)}
          onCreateJob={() => onNavigate('/jobs/new')}
          onShowQuoteModal={onShowQuoteModal}
          onShowInvoiceModal={onShowInvoiceModal}
        />
      )} />
      
      {/* IMPORTANT: /jobs/new must come BEFORE /jobs/:id to prevent "new" matching as an ID */}
      <Route path="/jobs/new" component={() => (
        <JobForm 
          onSubmit={(jobId) => {
            console.log('Job created:', jobId);
            // After creating, go to the job details
            onNavigate(`/jobs/${jobId}`);
          }}
          onCancel={() => {
            // Smart back: use browser history if available
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate('/jobs');
            }
          }}
        />
      )} />
      
      <Route path="/jobs/:id/complete" component={({ params }: any) => (
        <JobCompletionWrapper 
          jobId={params.id}
          onComplete={(jobId) => {
            console.log('Job completed:', jobId);
            // After completion, go back to the job details
            onNavigate(`/jobs/${jobId}`);
          }}
          onCancel={() => {
            // Smart back: use browser history if available
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate(`/jobs/${params.id}`);
            }
          }}
        />
      )} />
      
      <Route path="/jobs/:id/edit" component={({ params }: any) => (
        <JobEditForm
          jobId={params.id}
          onSave={(jobId) => {
            // After saving, go back to the job details
            onNavigate(`/jobs/${jobId}`);
          }}
          onCancel={() => {
            // Smart back: use browser history if available
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate(`/jobs/${params.id}`);
            }
          }}
        />
      )} />
      
      <Route path="/jobs/:id" component={({ params }: any) => (
        <JobDetailView
          jobId={params.id}
          onBack={() => {
            // Smart back: use browser history if available, otherwise fallback
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate('/jobs');
            }
          }}
          onEditJob={(id) => onNavigate(`/jobs/${id}/edit`)}
          onCompleteJob={(id) => onNavigate(`/jobs/${id}/complete`)}
          onCreateQuote={(id) => onNavigate(`/quotes/new?jobId=${id}`)}
          onCreateInvoice={(id) => onNavigate(`/invoices/new?jobId=${id}`)}
          onViewClient={(clientId) => onNavigate(`/clients/${clientId}`)}
        />
      )} />
      
      {/* Catch-all redirect for /jobs to /work (MUST come AFTER more specific job routes) */}
      <Route path="/jobs">
        <Redirect to="/work" />
      </Route>
      
      {/* IMPORTANT: /clients/new must come BEFORE /clients to prevent list matching */}
      <Route path="/clients/new" component={() => (
        <ClientForm 
          onSubmit={(clientId) => {
            console.log('Client created:', clientId);
            onNavigate(`/clients/${clientId}`);
          }}
          onCancel={() => onNavigate('/clients')}
        />
      )} />
      
      <Route path="/clients/:id" component={({ params }: { params: { id: string } }) => (
        <ClientDetailView 
          clientId={params.id}
          onBack={() => {
            // Smart back: use browser history if available, otherwise fallback
            if (window.history.length > 2) {
              window.history.back();
            } else {
              onNavigate('/clients');
            }
          }}
          onCreateJob={(clientId) => onNavigate(`/jobs/new?clientId=${clientId}`)}
          onViewJob={(jobId) => onNavigate(`/jobs/${jobId}`)}
        />
      )} />
      
      <Route path="/clients" component={() => (
        <ClientsList 
          onCreateClient={() => onNavigate('/clients/new')}
          onViewClient={(id) => onNavigate(`/clients/${id}`)}
          onCreateJobForClient={(id) => onNavigate(`/jobs/new?clientId=${id}`)}
          onCallClient={(phone) => window.open(`tel:${phone}`)}
          onEmailClient={(email) => window.open(`mailto:${email}`)}
          onSmsClient={(clientId, phone) => onNavigate(`/chat?smsClientId=${clientId}&phone=${encodeURIComponent(phone)}`)}
        />
      )} />
      
      <Route path="/documents" component={() => (
        <DocumentsHub onNavigate={onNavigate} />
      )} />
      
      {/* IMPORTANT: /quotes/new must come BEFORE /quotes redirect to prevent redirect from matching */}
      <Route path="/quotes/new" component={() => (
        <LiveQuoteEditor 
          onSave={(quoteId) => {
            console.log('Quote created:', quoteId);
            onShowQuoteModal(quoteId);
          }}
          onCancel={() => onNavigate('/quotes')}
        />
      )} />
      
      <Route path="/quotes/:id" component={({ params }: { params: { id: string } }) => (
        <QuoteDetailView quoteId={params.id} />
      )} />
      
      {/* Redirect /quotes to Documents Hub after more specific routes */}
      <Route path="/quotes">
        <Redirect to="/documents?tab=quotes" />
      </Route>
      
      {/* IMPORTANT: /invoices/new must come BEFORE /invoices redirect to prevent redirect from matching */}
      <Route path="/invoices/new" component={() => (
        <LiveInvoiceEditor 
          onSave={(invoiceId) => {
            console.log('Invoice created:', invoiceId);
            onShowInvoiceModal(invoiceId);
          }}
          onCancel={() => onNavigate('/invoices')}
        />
      )} />
      
      <Route path="/invoices/:id" component={({ params }: { params: { id: string } }) => (
        <InvoiceDetailView invoiceId={params.id} />
      )} />
      
      {/* Redirect /invoices to Documents Hub after more specific routes */}
      <Route path="/invoices">
        <Redirect to="/documents?tab=invoices" />
      </Route>
      
      <Route path="/receipts/:id" component={({ params }: { params: { id: string } }) => (
        <ReceiptDetailView receiptId={params.id} onBack={() => window.history.back()} />
      )} />
      
      <Route path="/schedule" component={() => (
        <SchedulePage 
          onCreateJob={() => onNavigate('/jobs/new')}
          onViewJob={(id) => onNavigate(`/jobs/${id}`)}
        />
      )} />

      <Route path="/calendar">
        <Redirect to="/schedule" />
      </Route>

      <Route path="/dispatch">
        <Redirect to="/schedule" />
      </Route>
      
      {/* Templates route removed - template customization is now in Settings > Documents */}
      
      <Route path="/settings" component={SettingsWrapper} />
      
      <Route path="/email-setup" component={() => (
        <EmailSetupGuide 
          onSetupComplete={() => onNavigate('/invoices')}
          onSkip={() => onNavigate('/dashboard')}
        />
      )} />
      
      <Route path="/integrations" component={() => (
        <Integrations />
      )} />
      
      <Route path="/subscription" component={() => (
        <SubscriptionPage />
      )} />
      
      <Route path="/time-tracking" component={() => (
        <TimeTrackingPage />
      )} />
      
      <Route path="/team">
        <Redirect to="/team-operations" />
      </Route>
      
      <Route path="/team-dashboard">
        <Redirect to="/team-operations" />
      </Route>
      
      <Route path="/team-operations" component={() => (
        <TeamOperations />
      )} />
      
      <Route path="/team-chat" component={() => (
        <TeamChatPage />
      )} />
      
      <Route path="/chat" component={() => (
        <ChatHub />
      )} />
      
      <Route path="/map" component={() => (
        <JobMapPage />
      )} />
      
      <Route path="/messages">
        {() => {
          window.location.href = '/chat';
          return null;
        }}
      </Route>
      
      <Route path="/reports" component={() => (
        <Reports />
      )} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/admin/activity" component={AdminDashboard} />
      <Route path="/admin/health" component={AdminDashboard} />
      <Route path="/admin/settings" component={AdminDashboard} />
      
      <Route path="/payment-hub" component={PaymentHub} />
      
      <Route path="/automations" component={() => (
        <Automations />
      )} />
      
      <Route path="/recurring-jobs" component={() => (
        <RecurringJobs />
      )} />
      
      <Route path="/leads" component={() => (
        <Leads />
      )} />
      
      <Route path="/custom-forms">
        <Redirect to="/templates?tab=jobs_safety" />
      </Route>
      
      <Route path="/templates" component={() => (
        <TemplatesHub />
      )} />
      
      <Route path="/communications" component={() => (
        <CommunicationsHub />
      )} />
      
      <Route path="/collect-payment" component={() => (
        <CollectPayment />
      )} />
      
      <Route path="/my-account">
        {() => {
          window.location.href = '/settings';
          return null;
        }}
      </Route>
      
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/verify-email-pending" component={VerifyEmailPending} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/accept-invite/:token" component={AcceptInvite} />
      
      <Route path="/more" component={More} />
      
      {/* Root route must be near the end to avoid prefix matching issues */}
      <Route path="/" component={() => (
        <Dashboard 
          onCreateJob={() => onNavigate('/jobs')}
          onCreateQuote={() => onNavigate('/quotes')}
          onCreateInvoice={() => onNavigate('/invoices')}
          onViewJobs={() => onNavigate('/jobs')}
          onViewInvoices={() => onNavigate('/invoices')}
          onViewQuotes={() => onNavigate('/quotes')}
          onNavigate={onNavigate}
        />
      )} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

// Main app layout with sidebar and bottom navigation
// Helper function for trade color conversion
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function AppLayout() {
  const { theme, setTheme, setThemeWithSync } = useTheme();
  const [location, setLocation] = useLocation();
  const [authKey, setAuthKey] = useState(0);
  
  // Modal state for quotes and invoices
  const [quoteModal, setQuoteModal] = useState<{ isOpen: boolean; quoteId: string | null }>({ isOpen: false, quoteId: null });
  const [invoiceModal, setInvoiceModal] = useState<{ isOpen: boolean; invoiceId: string | null }>({ isOpen: false, invoiceId: null });
  
  // Guided tour state
  const { 
    showTour, 
    hasCompleted: tourCompleted, 
    startTour, 
    closeTour, 
    completeTour 
  } = useGuidedTour();

  // Detect OAuth callback and trigger auth refresh
  useEffect(() => {
    // Check if we've returned from OAuth (URL contains certain params or we're on the root)
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('code') || urlParams.has('state');
    // Also check for our custom auth param from Google OAuth callback
    const authParam = urlParams.get('auth');
    const hasGoogleAuthSuccess = authParam === 'google_success' || authParam === 'success';
    
    if (hasOAuthParams || hasGoogleAuthSuccess || sessionStorage.getItem('oauth-in-progress')) {
      sessionStorage.removeItem('oauth-in-progress');
      // Directly invalidate auth queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      setAuthKey(prev => prev + 1);
      // Clean up URL (remove OAuth params but keep clean URL)
      if (hasOAuthParams || hasGoogleAuthSuccess) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);
  
  // Onboarding mutation hook
  const { mutateAsync: completeOnboarding } = useCompleteOnboarding();

  // Check if user is authenticated
  const { data: userCheck, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me", authKey],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/me', { credentials: 'include', headers });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000, // 30 seconds
  });

  // Check if user needs onboarding (check business settings)
  // IMPORTANT: This must be called before any conditional returns to satisfy Rules of Hooks
  const { 
    data: businessSettings, 
    isLoading: businessSettingsLoading,
    error: businessSettingsError 
  } = useQuery({
    queryKey: ['/api/business-settings'],
    enabled: !!userCheck && !isLoading && !error,
    retry: false,
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/business-settings', { credentials: 'include', headers });
      if (res.status === 404) {
        // No business settings found - return null to trigger onboarding
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch business settings');
      }
      return res.json();
    }
  });

  // Check if user is a team member (staff users should skip onboarding)
  const { 
    data: teamRoleInfo, 
    isLoading: teamRoleLoading 
  } = useQuery({
    queryKey: ['/api/team/my-role'],
    enabled: !!userCheck && !isLoading && !error,
    retry: false,
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/team/my-role', { credentials: 'include', headers });
      if (res.status === 404) {
        // Not a team member - this is expected for business owners
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch team role');
      }
      return res.json();
    }
  });

  // Staff users (team members on someone else's team) should skip onboarding entirely
  // Owners without business settings still need to complete onboarding
  const isStaffOnOtherTeam = !!teamRoleInfo && teamRoleInfo.role !== 'owner';

  // Initialize and update trade colors based on theme and trade selection
  // IMPORTANT: All useEffect hooks must be called before any conditional returns
  // NOTE: Trade type colors are ONLY applied when custom brand theme is NOT enabled
  // When custom brand theme is enabled, ThemeProvider handles all --trade variables
  useEffect(() => {
    const updateTradeColors = (userTradeType?: string) => {
      // Check if custom brand theme is enabled - if so, don't override ThemeProvider's colors
      const brandThemeStr = localStorage.getItem('tradietrack-brand-theme');
      if (brandThemeStr) {
        try {
          const brandTheme = JSON.parse(brandThemeStr);
          // If custom theme is enabled with a valid color, let ThemeProvider handle the colors
          if (brandTheme.customThemeEnabled && brandTheme.primaryColor && /^#[0-9A-Fa-f]{6}$/i.test(brandTheme.primaryColor)) {
            return; // Skip - ThemeProvider will set the colors
          }
        } catch (e) {
          // Invalid JSON, continue with trade type colors
        }
      }
      
      // Use user's trade type if available, otherwise use saved or default
      const tradeType = userTradeType || localStorage.getItem('tradietrack-trade-type') || 'plumbing';
      const tradeInfo = getTradeInfo(tradeType);
      const hexColor = tradeInfo.color;
      const hsl = hexToHsl(hexColor);
      
      // Check current theme
      const isDark = document.documentElement.classList.contains('dark');
      
      // Primary trade color
      document.documentElement.style.setProperty('--trade', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      
      // Background variants - responsive to light/dark mode
      const bgLightness = isDark ? Math.max(hsl.l - 55, 8) : Math.min(hsl.l + 45, 96);
      const bgSaturation = Math.max(hsl.s - 30, 10);
      document.documentElement.style.setProperty('--trade-bg', `${hsl.h} ${bgSaturation}% ${bgLightness}%`);
      
      // Border variants - enhanced contrast responsive to theme
      const borderLightness = isDark ? Math.min(hsl.l + 20, 80) : Math.max(hsl.l - 15, 30);
      document.documentElement.style.setProperty('--trade-border', `${hsl.h} ${hsl.s}% ${borderLightness}%`);
      
      // Special accent colors for enhanced theming
      const accentLightness = isDark ? Math.min(hsl.l + 10, 70) : Math.max(hsl.l - 5, 40);
      document.documentElement.style.setProperty('--trade-accent', `${hsl.h} ${Math.min(hsl.s + 10, 100)}% ${accentLightness}%`);
      
      // Subtle glow effect color
      const glowLightness = isDark ? Math.max(hsl.l - 20, 20) : Math.min(hsl.l + 30, 85);
      document.documentElement.style.setProperty('--trade-glow', `${hsl.h} ${Math.min(hsl.s + 20, 100)}% ${glowLightness}%`);
    };

    // Initial setup
    updateTradeColors();
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTradeColors();
        }
      });
    });
    
    // Listen for trade changes from Dashboard
    const handleTradeChange = () => {
      updateTradeColors();
    };
    
    observer.observe(document.documentElement, { attributes: true });
    window.addEventListener('trade-change', handleTradeChange);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('trade-change', handleTradeChange);
    };
  }, []);

  // Update trade colors when user changes
  useEffect(() => {
    if (userCheck?.tradeType) {
      const tradeType = userCheck.tradeType;
      localStorage.setItem('tradietrack-trade-type', tradeType);
      // Trigger a re-render of trade colors
      window.dispatchEvent(new Event('trade-change'));
    }
  }, [userCheck?.tradeType]);

  // Listen for guided tour trigger from settings
  useEffect(() => {
    const handleStartTour = () => {
      startTour();
    };
    window.addEventListener('start-guided-tour', handleStartTour);
    return () => {
      window.removeEventListener('start-guided-tour', handleStartTour);
    };
  }, [startTour]);

  // Sync brand theme AND theme mode from backend to ThemeProvider ONLY on initial load
  // We use a ref to track if we've already synced to prevent overriding user's local changes
  const { setBrandTheme, initializeFromServer } = useTheme();
  const hasInitialSynced = useRef(false);
  
  useEffect(() => {
    // Only sync once when businessSettings first loads
    // This prevents overriding user's local color selections when switching themes
    if (businessSettings && !hasInitialSynced.current) {
      hasInitialSynced.current = true;
      
      // Sync theme mode (light/dark/system) from server - this ensures mobile and web stay in sync
      const serverThemeMode = businessSettings.themeMode as 'light' | 'dark' | 'system' | null;
      if (serverThemeMode) {
        initializeFromServer(serverThemeMode);
      }
      
      const serverColor = (businessSettings.primaryColor || businessSettings.brandColor || '').toUpperCase();
      const serverCustomEnabled = businessSettings.customThemeEnabled || false;
      
      if (serverCustomEnabled && serverColor && /^#[0-9A-Fa-f]{6}$/i.test(serverColor)) {
        // Backend has custom theme enabled - use it
        setBrandTheme({
          primaryColor: serverColor,
          customThemeEnabled: true
        });
        localStorage.setItem('tradietrack-brand-theme', JSON.stringify({
          primaryColor: serverColor,
          customThemeEnabled: true
        }));
      }
      // If backend doesn't have custom theme enabled, we keep the localStorage/default values
      // This allows users to experiment with colors before saving
    }
    // Note: setBrandTheme and initializeFromServer are stable (useCallback) so they won't cause re-runs
  }, [businessSettings, setBrandTheme, initializeFromServer]);

  const handleLoginSuccess = () => {
    // Invalidate both auth and business settings queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
    setAuthKey(prev => prev + 1); // Force refetch of auth status
  };

  const handleNeedOnboarding = () => {
    // User successfully authenticated but needs onboarding
    // Only invalidate business settings to trigger onboarding check
    queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
  };

  const handleOnboardingComplete = async (onboardingData: OnboardingData) => {
    try {
      await completeOnboarding(onboardingData);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] }),
      ]);
      handleLoginSuccess();
    } catch (error) {
      throw error;
    }
  };

  const handleSimpleOnboardingComplete = async () => {
    // SimpleOnboarding already saves business settings via its own API call
    // Just invalidate queries to refresh the app state
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] }),
    ]);
    handleLoginSuccess();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include' 
      });
      // Clear session token from localStorage (for iOS/Safari fallback)
      clearSessionToken();
      // Reset the sync flag so the next login will sync from backend
      hasInitialSynced.current = false;
      // Invalidate all queries
      queryClient.clear();
      // Navigate to auth page immediately after logout
      setLocation('/auth');
      // Force refetch of auth status which will show login screen
      setAuthKey(prev => prev + 1);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear session token even on error
      clearSessionToken();
      // Reset sync flag even on error
      hasInitialSynced.current = false;
      // Navigate to auth page even on error
      setLocation('/auth');
      // Force refetch anyway to check auth status
      setAuthKey(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TradieTrack...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show landing page or auth flow based on route
  if (error || !userCheck) {
    // Show auth flow at /auth route
    if (location === '/auth' || location.startsWith('/auth')) {
      return (
        <AuthFlow 
          onLoginSuccess={handleLoginSuccess}
          onNeedOnboarding={handleNeedOnboarding}
        />
      );
    }
    // Show email verification pages without authentication (required for signup flow)
    if (location === '/verify-email-pending' || location.startsWith('/verify-email-pending')) {
      return <VerifyEmailPending />;
    }
    if (location === '/verify-email' || location.startsWith('/verify-email')) {
      return <VerifyEmail />;
    }
    // Show privacy policy and terms of service without authentication (Apple App Store requirement)
    if (location === '/privacy' || location === '/privacy-policy') {
      return <PrivacyPolicy />;
    }
    if (location === '/terms' || location === '/terms-of-service') {
      return <TermsOfService />;
    }
    // Show landing page for all other routes when not authenticated
    return <LandingPage />;
  }

  // Platform admin users get a completely different interface - check early before tradie-specific logic
  if (userCheck?.isPlatformAdmin === true) {
    return (
      <AdminAppShell 
        onLogout={handleLogout} 
        onNavigate={(path) => setLocation(path)}
      >
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/users" component={AdminDashboard} />
          <Route path="/admin/activity" component={AdminDashboard} />
          <Route path="/admin/health" component={AdminDashboard} />
          <Route path="/admin/settings" component={AdminDashboard} />
          {/* Redirect any other path to admin dashboard */}
          <Route>
            <Redirect to="/admin" />
          </Route>
        </Switch>
      </AdminAppShell>
    );
  }

  // If authenticated but still loading business settings or team role, show loading state
  if (userCheck && (businessSettingsLoading || teamRoleLoading)) {
    // Still loading business settings or team role
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (userCheck && businessSettings === null && !isStaffOnOtherTeam && !userCheck.isPlatformAdmin) {
    // User exists but no business settings AND not staff on another team AND not a platform admin - show simple onboarding
    // Staff users (on someone else's team) skip onboarding - they use their employer's business settings
    // Platform admins don't need business settings - they have a separate admin interface
    return <SimpleOnboarding onComplete={handleSimpleOnboardingComplete} onSkip={handleSimpleOnboardingComplete} />;
  }

  // If authenticated, show main app below (existing code continues...)

  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  // Custom sidebar width for TradieTrack
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  const getPageTitle = () => {
    const routes: Record<string, string> = {
      '/': 'Dashboard',
      '/jobs': 'Jobs',
      '/clients': 'Clients',
      '/quotes': 'Quotes',
      '/invoices': 'Invoices',
      '/calendar': 'Calendar',
      '/settings': 'Settings',
      '/integrations': 'Integrations',
      '/more': 'More'
    };
    return routes[location] || 'TradieTrack';
  };

  const showAddButton = () => {
    return ['/jobs', '/clients', '/quotes', '/invoices', '/calendar'].includes(location);
  };

  const getAddButtonText = () => {
    const buttonTexts: Record<string, string> = {
      '/jobs': 'New Job',
      '/clients': 'New Client',
      '/quotes': 'New Quote',
      '/invoices': 'New Invoice',
      '/calendar': 'Schedule Job'
    };
    return buttonTexts[location] || 'Add';
  };

  return (
    <>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          {/* Desktop Sidebar */}
          <AppSidebar onNavigate={handleNavigation} onLogout={handleLogout} />
          
          {/* Main Content - takes full remaining width */}
          <div className="flex flex-col flex-1 min-w-0 w-full">
            {/* Header - needs z-index above map content */}
            <div className="space-y-0 relative z-[20]">
              <Header 
                title={undefined}
                showSearch={location === '/' || location === '/jobs' || location === '/clients'}
                showAddButton={false}
                addButtonText={getAddButtonText()}
                onAddClick={() => console.log('Add button clicked')}
                onThemeToggle={() => setThemeWithSync(theme === 'dark' ? 'light' : 'dark')}
                isDarkMode={theme === 'dark'}
                onProfileClick={() => setLocation('/settings')}
                onSettingsClick={() => setLocation('/settings')}
                onLogoutClick={handleLogout}
              />
              {/* Offline Indicator */}
              <OfflineIndicator />
            </div>
            
            {/* Page Content - flex container for proper height context, z-index below header */}
            <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden z-[10]" data-scroll-container>
              {/* RouteGuard checks permissions before rendering content */}
              <RouteGuard>
                {/* Map page renders directly in the flex container, other pages get scroll wrapper */}
                {location.startsWith('/map') ? (
                  <Router 
                    onNavigate={handleNavigation}
                    onShowQuoteModal={(quoteId) => setQuoteModal({ isOpen: true, quoteId })}
                    onShowInvoiceModal={(invoiceId) => setInvoiceModal({ isOpen: true, invoiceId })}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
                    <Router 
                      onNavigate={handleNavigation}
                      onShowQuoteModal={(quoteId) => setQuoteModal({ isOpen: true, quoteId })}
                      onShowInvoiceModal={(invoiceId) => setInvoiceModal({ isOpen: true, invoiceId })}
                    />
                  </div>
                )}
              </RouteGuard>
            </main>
          </div>
        </div>
        {/* Fixed position elements - inside SidebarProvider for context access */}
        <BottomNav onNavigate={handleNavigation} />
      </SidebarProvider>
      
      {/* Payment Toast Provider - shows celebratory "Cha-ching!" when payments come in */}
      <PaymentToastProvider />
      
      {/* AI Assistant - floating above all pages */}
      <FloatingAIChat onNavigate={handleNavigation} />
      
      {quoteModal.quoteId && (
        <QuoteModal
          quoteId={quoteModal.quoteId}
          isOpen={quoteModal.isOpen}
          onClose={() => setQuoteModal({ isOpen: false, quoteId: null })}
          onViewFullQuote={(quoteId) => {
            setQuoteModal({ isOpen: false, quoteId: null });
            handleNavigation(`/quotes/${quoteId}`);
          }}
        />
      )}
      
      {invoiceModal.invoiceId && (
        <InvoiceModal
          invoiceId={invoiceModal.invoiceId}
          isOpen={invoiceModal.isOpen}
          onClose={() => setInvoiceModal({ isOpen: false, invoiceId: null })}
          onViewFullInvoice={(invoiceId) => {
            setInvoiceModal({ isOpen: false, invoiceId: null });
            handleNavigation(`/invoices/${invoiceId}`);
          }}
        />
      )}
      
      {/* Guided Tour */}
      <GuidedTour
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
      />
      
      {/* Immersive ServiceM8-Style Onboarding - server-side tracking */}
      {businessSettings && businessSettings.onboardingCompleted && !businessSettings.hasSeenWalkthrough && (
        <ImmersiveOnboarding
          businessSettings={businessSettings}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
            startTour();
          }}
        />
      )}
      
      {/* Keyboard Shortcuts */}
      <KeyboardShortcutsDialog />
    </>
  );
}

// Root app component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="tradietrack-ui-theme">
        <NetworkProvider>
          <TooltipProvider>
            <Switch>
              {/* Public routes - no auth required */}
              <Route path="/pay/:token" component={PaymentPage} />
              <Route path="/track/:token">{(params) => <TrackArrival token={params.token} />}</Route>
              <Route path="/receipt/:token">{(params) => <PublicReceiptRedirect token={params.token} />}</Route>
              <Route path="/privacy" component={PrivacyPolicy} />
              <Route path="/terms" component={TermsOfService} />
              {/* All other routes go through AppLayout */}
              <Route>
                <AppLayout />
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </NetworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
