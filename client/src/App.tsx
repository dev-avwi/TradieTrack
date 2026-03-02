import React, { useState, useEffect, useRef, useCallback } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, clearSessionToken, getSessionToken, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { NetworkProvider } from "@/contexts/NetworkContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import AuthFlow from "@/components/AuthFlow";
import SimpleOnboarding from "@/components/SimpleOnboarding";
import { useCompleteOnboarding } from "@/hooks/useCompleteOnboarding";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";
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
import ActionCenter from "@/pages/ActionCenter";
import Insights from "@/pages/Insights";
import Autopilot from "@/pages/Autopilot";
import NotFound from "@/pages/not-found";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyEmailPending from "@/pages/VerifyEmailPending";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvite from "@/pages/AcceptInvite";
import AcceptAssignment from "@/pages/AcceptAssignment";
import JobInvite from "@/pages/JobInvite";
import OpenApp from "@/pages/OpenApp";
import QuoteModal from "@/components/QuoteModal";
import InvoiceModal from "@/components/InvoiceModal";
import TimeTrackingPage from "@/pages/TimeTracking";
import TeamOperations from "@/pages/TeamOperations";
import PaymentPage from "@/pages/PaymentPage";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import TrackArrival from "@/pages/TrackArrival";
import Reports from "@/pages/Reports";
import Calculators from "@/pages/Calculators";
import CollectPayment from "@/pages/CollectPayment";
import TeamChatPage from "@/pages/TeamChat";
import ChatHub from "@/pages/ChatHub";
import JobMapPage from "@/pages/JobMap";
import DirectMessagesPage from "@/pages/DirectMessages";
import DispatchBoard from "@/pages/DispatchBoard";
import SchedulePage from "@/pages/SchedulePage";
import Automations from "@/pages/Automations";
import RecurringJobs from "@/pages/RecurringJobs";
import ServiceRemindersPage from "@/pages/ServiceReminders";
import InventoryPage from "@/pages/InventoryPage";
import RebatesPage from "@/pages/Rebates";
import Leads from "@/pages/Leads";
import AIVisualizationPage from "@/pages/AIVisualization";
import PayrollReports from "@/pages/PayrollReports";
import ClientPortal from "@/pages/ClientPortal";
import ClientPortalHub from "@/pages/ClientPortalHub";
import JobPortal from "@/pages/JobPortal";
import TeamGroups from "@/pages/TeamGroups";
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
import WhatYouMissedModal from "@/components/WhatYouMissedModal";
import TimeEditAuditLog from "@/pages/TimeEditAuditLog";
import ProfitabilityReport from "@/pages/ProfitabilityReport";
import SubcontractorWebView from "@/pages/SubcontractorWebView";
import FilesPage from "@/pages/Files";
import ErrorBoundary from "@/components/ErrorBoundary";

function BusinessPicker({ userId }: { userId: string }) {
  const { data: businessData } = useQuery({
    queryKey: ['/api/auth/my-businesses'],
    enabled: !!userId,
  });
  
  const [isOpen, setIsOpen] = useState(false);
  
  if (!businessData?.businesses || businessData.businesses.length <= 1) {
    return null;
  }
  
  const currentBusiness = businessData.businesses.find(
    (b: any) => b.businessOwnerId === businessData.activeBusinessId
  ) || businessData.businesses[0];
  
  const handleSwitch = async (businessId: string) => {
    try {
      await apiRequest('POST', '/api/auth/switch-business', { businessId });
      queryClient.clear();
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch business:', err);
    }
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-background hover-elevate"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
        <span className="max-w-[140px] truncate">{currentBusiness?.businessName}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-md">
            <div className="p-1">
              {businessData.businesses.map((b: any) => (
                <button
                  key={b.businessOwnerId}
                  onClick={() => handleSwitch(b.businessOwnerId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover-elevate ${
                    b.businessOwnerId === businessData.activeBusinessId ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div className="font-medium truncate">{b.businessName}</div>
                    <div className="text-xs text-muted-foreground">{b.roleName}</div>
                  </div>
                  {b.businessOwnerId === businessData.activeBusinessId && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TrialBanner({ trialEndsAt, onUpgrade }: { trialEndsAt: string; onUpgrade: () => void }) {
  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  if (daysRemaining <= 0) return null;
  
  const urgentClass = daysRemaining <= 2 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-primary/5 border-primary/10 text-primary';
  
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-1.5 text-sm border-b ${urgentClass}`}>
      <span className="font-medium">
        Free trial: {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
      </span>
      <button 
        onClick={onUpgrade}
        className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
      >
        Upgrade Now
      </button>
    </div>
  );
}

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

// Short URL redirects for quote/invoice links sent via email/SMS
function QuoteShortRedirect({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (token) {
      setLocation(`/portal/quote/${token}`);
    }
  }, [token, setLocation]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your quote...</p>
      </div>
    </div>
  );
}

function InvoiceShortRedirect({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (token) {
      setLocation(`/portal/invoice/${token}`);
    }
  }, [token, setLocation]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your invoice...</p>
      </div>
    </div>
  );
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

// Stable wrapper components to prevent remounting when Router re-renders
// Using memo to ensure stable component identity
const LiveQuoteEditorWrapper = React.memo(({ 
  onSave, 
  onCancel 
}: { 
  onSave: (quoteId: string) => void;
  onCancel: () => void;
}) => (
  <LiveQuoteEditor onSave={onSave} onCancel={onCancel} />
));

const LiveInvoiceEditorWrapper = React.memo(({ 
  onSave, 
  onCancel 
}: { 
  onSave: (invoiceId: string) => void;
  onCancel: () => void;
}) => (
  <LiveInvoiceEditor onSave={onSave} onCancel={onCancel} />
));

const JobFormWrapper = React.memo(({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (jobId: string) => void;
  onCancel: () => void;
}) => (
  <JobForm onSubmit={onSubmit} onCancel={onCancel} />
));

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
  
  // Stable callbacks for quote/invoice editors using useCallback
  const handleQuoteSave = useCallback((quoteId: string) => {
    console.log('Quote created:', quoteId);
    onShowQuoteModal(quoteId);
  }, [onShowQuoteModal]);
  
  const handleQuoteCancel = useCallback(() => {
    onNavigate('/quotes');
  }, [onNavigate]);
  
  const handleInvoiceSave = useCallback((invoiceId: string) => {
    console.log('Invoice created:', invoiceId);
    onShowInvoiceModal(invoiceId);
  }, [onShowInvoiceModal]);
  
  const handleInvoiceCancel = useCallback(() => {
    onNavigate('/invoices');
  }, [onNavigate]);
  
  const handleJobSubmit = useCallback((jobId: string) => {
    console.log('Job created:', jobId);
    onNavigate(`/jobs/${jobId}`);
  }, [onNavigate]);
  
  const handleJobCancel = useCallback(() => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      onNavigate('/jobs');
    }
  }, [onNavigate]);

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
      <Route path="/jobs/new">
        <JobFormWrapper 
          onSubmit={handleJobSubmit}
          onCancel={handleJobCancel}
        />
      </Route>
      
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
          onCreateQuote={(clientId) => onNavigate(`/quotes/new?clientId=${clientId}`)}
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
      {/* Using stable wrapper component to prevent remounting when Router re-renders */}
      <Route path="/quotes/new">
        <LiveQuoteEditorWrapper 
          onSave={handleQuoteSave}
          onCancel={handleQuoteCancel}
        />
      </Route>
      
      <Route path="/quotes/:id" component={({ params }: { params: { id: string } }) => (
        <QuoteDetailView quoteId={params.id} />
      )} />
      
      {/* Redirect /quotes to Documents Hub after more specific routes */}
      <Route path="/quotes">
        <Redirect to="/documents?tab=quotes" />
      </Route>
      
      {/* IMPORTANT: /invoices/new must come BEFORE /invoices redirect to prevent redirect from matching */}
      {/* Using stable wrapper component to prevent remounting when Router re-renders */}
      <Route path="/invoices/new">
        <LiveInvoiceEditorWrapper 
          onSave={handleInvoiceSave}
          onCancel={handleInvoiceCancel}
        />
      </Route>
      
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

      <Route path="/dispatch-board" component={() => (
        <DispatchBoard />
      )} />

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
      
      <Route path="/audit-log" component={TimeEditAuditLog} />
      
      <Route path="/team">
        <Redirect to="/team-operations" />
      </Route>
      
      <Route path="/team-dashboard">
        <Redirect to="/team-operations" />
      </Route>
      
      <Route path="/team-operations">
        <TeamOperations />
      </Route>
      
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
      
      <Route path="/action-center" component={() => (
        <ActionCenter onNavigate={onNavigate} />
      )} />

      <Route path="/insights" component={() => (
        <Insights onNavigate={onNavigate} />
      )} />

      <Route path="/autopilot" component={() => (
        <Autopilot onNavigate={onNavigate} />
      )} />

      <Route path="/reports/profitability" component={ProfitabilityReport} />

      <Route path="/reports/payroll" component={PayrollReports} />

      <Route path="/reports" component={() => (
        <Reports />
      )} />
      
      <Route path="/calculators" component={Calculators} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/admin/activity" component={AdminDashboard} />
      <Route path="/admin/health" component={AdminDashboard} />
      <Route path="/admin/settings" component={AdminDashboard} />
      
      <Route path="/payment-hub" component={PaymentHub} />
      
      <Route path="/automations" component={() => (
        <Automations />
      )} />
      {/* Automations controls moved to Communications Hub - route kept for backward compatibility */}
      
      <Route path="/recurring-jobs" component={() => (
        <RecurringJobs />
      )} />
      
      <Route path="/service-reminders" component={() => (
        <ServiceRemindersPage />
      )} />
      
      <Route path="/inventory" component={() => (
        <InventoryPage />
      )} />
      
      <Route path="/equipment" component={() => (
        <InventoryPage initialSection="equipment" />
      )} />
      
      <Route path="/files" component={() => (
        <FilesPage />
      )} />
      
      <Route path="/rebates" component={() => (
        <RebatesPage />
      )} />
      
      <Route path="/leads" component={() => (
        <Leads />
      )} />
      
      <Route path="/team-groups" component={() => (
        <TeamGroups />
      )} />
      
      <Route path="/custom-forms">
        <Redirect to="/templates?tab=jobs_safety" />
      </Route>
      
      <Route path="/templates" component={TemplatesHub} />
      
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
      <Route path="/accept-assignment/:jobId/:assignmentId" component={AcceptAssignment} />
      <Route path="/invite/:code">
        {(params: { code: string }) => <JobInvite code={params.code} />}
      </Route>
      <Route path="/open-app/:action/:token" component={OpenApp} />
      
      <Route path="/ai-visualization" component={AIVisualizationPage} />
      
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

  // Get the businessId for real-time updates
  // For team members, use their business owner's ID; for owners, use their own ID
  const realtimeBusinessId = teamRoleInfo?.businessOwnerId || userCheck?.id || '';
  
  // Wire up real-time WebSocket updates for live UI synchronization
  // This handles job status changes, timer events, document updates, payments, etc.
  // MUST be called unconditionally before any early returns (React Rules of Hooks)
  useRealtimeUpdates({
    businessId: realtimeBusinessId,
    enabled: !!userCheck && !!realtimeBusinessId && !isLoading && !businessSettingsLoading,
  });

  // Initialize and update trade colors based on theme and trade selection
  // IMPORTANT: All useEffect hooks must be called before any conditional returns
  // NOTE: Trade type colors are ONLY applied when custom brand theme is NOT enabled
  // When custom brand theme is enabled, ThemeProvider handles all --trade variables
  useEffect(() => {
    const updateTradeColors = (userTradeType?: string) => {
      // Check if custom brand theme is enabled - if so, don't override ThemeProvider's colors
      const brandThemeStr = localStorage.getItem('jobrunner-brand-theme');
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
      const tradeType = userTradeType || localStorage.getItem('jobrunner-trade-type') || 'plumbing';
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
      localStorage.setItem('jobrunner-trade-type', tradeType);
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
        localStorage.setItem('jobrunner-brand-theme', JSON.stringify({
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
      
      // If user chose to start with demo data, seed it now
      if (onboardingData.demoData?.useDemoData) {
        try {
          await apiRequest('POST', '/api/onboarding/seed-demo-data');
          // Invalidate all data queries so demo data appears
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/clients"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
          ]);
        } catch (demoError) {
          console.error('Failed to seed demo data:', demoError);
          // Don't block onboarding completion if demo data fails
        }
      }
      
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
          <p className="text-muted-foreground">Loading JobRunner...</p>
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
    // Show accept-invite page without authentication (team members accepting invitations)
    if (location.startsWith('/accept-invite/')) {
      return <AcceptInvite />;
    }
    // Show smart app redirect page (tries to open app, falls back to web/store)
    if (location.startsWith('/open-app/')) {
      return <OpenApp />;
    }
    // Show password reset page without authentication
    if (location.startsWith('/reset-password')) {
      return <ResetPassword />;
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

  if (userCheck && !userCheck.isOwner && userCheck.ownerSubscriptionValid === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Subscription Inactive</h2>
            <p className="text-muted-foreground">
              {userCheck.ownerBusinessName 
                ? `${userCheck.ownerBusinessName}'s JobRunner subscription is no longer active.`
                : "Your employer's JobRunner subscription is no longer active."}
            </p>
            <p className="text-muted-foreground mt-2">
              Please contact the business owner to restore access.
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover-elevate h-10 px-4 py-2"
          >
            Sign Out
          </button>
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

  // Custom sidebar width for JobRunner
  const style = {
    "--sidebar-width": "16rem",       // 256px - compact for laptop screens
    "--sidebar-width-icon": "3.5rem",
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
    return routes[location] || 'JobRunner';
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
              {/* Business Picker for multi-business users */}
              {userCheck && !userCheck.isOwner && <BusinessPicker userId={userCheck.id} />}
              {/* Offline Indicator */}
              <OfflineIndicator />
              {/* Trial Banner */}
              {userCheck?.trialStatus === 'active' && userCheck?.trialEndsAt && (
                <TrialBanner trialEndsAt={userCheck.trialEndsAt} onUpgrade={() => setLocation('/settings?tab=subscription')} />
              )}
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
      
      {/* What You Missed popup - shows on app open */}
      <WhatYouMissedModal />
      
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
      <ErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="jobrunner-ui-theme">
        <NetworkProvider>
          <TooltipProvider>
            <Switch>
              {/* Public routes - no auth required, more specific paths first */}
              <Route path="/q/:token">{(params) => <QuoteShortRedirect token={params.token} />}</Route>
              <Route path="/i/:token">{(params) => <InvoiceShortRedirect token={params.token} />}</Route>
              <Route path="/pay/:token" component={PaymentPage} />
              <Route path="/portal/:type/:token" component={ClientPortal} />
              <Route path="/portal" component={ClientPortalHub} />
              <Route path="/job-portal/:token" component={JobPortal} />
              <Route path="/p/:token" component={JobPortal} />
              <Route path="/s/:token">{(params) => <SubcontractorWebView token={params.token} />}</Route>
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
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
