import { useQuery } from "@tanstack/react-query";
import { useAppMode } from "@/hooks/use-app-mode";
import OwnerManagerDashboard from "./OwnerManagerDashboard";
import TeamOwnerDashboard from "./TeamOwnerDashboard";
import TradieDashboard from "./TradieDashboard";
import StaffTradieDashboard from "./StaffTradieDashboard";

interface DashboardProps {
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

export default function Dashboard({
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onViewInvoices,
  onViewQuotes,
  onNavigate
}: DashboardProps) {
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings } = useQuery({ queryKey: ["/api/business-settings"] });
  const { 
    dashboardType, 
    isLoading,
    canCreateJobs,
    canCreateQuotes,
    canCreateInvoices,
    hasActiveTeam
  } = useAppMode();

  // Get display name - prioritize actual first name over role labels
  const firstName = (user as any)?.firstName;
  const fullName = (user as any)?.name;
  const businessName = (businessSettings as any)?.businessName;
  
  // Don't use "Primary", "Owner", "Manager", "Tradie" as names - those are role labels
  const roleLabels = ['primary', 'owner', 'manager', 'tradie', 'admin'];
  const isRoleLabel = (name: string) => roleLabels.includes(name?.toLowerCase());
  
  // Get a proper greeting name
  let userName = "there";
  if (firstName && !isRoleLabel(firstName)) {
    userName = firstName;
  } else if (fullName && !isRoleLabel(fullName)) {
    userName = fullName.split(" ")[0]; // Use first word of full name
  } else if (businessName) {
    userName = businessName.split(" ")[0]; // Use first word of business name
  }

  // Show loading state while determining dashboard type
  if (isLoading || dashboardType === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="dashboard-loading">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard based on dashboardType
  switch (dashboardType) {
    // Staff tradie (team member) - limited view, only sees assigned jobs
    case "staff_tradie":
      return (
        <StaffTradieDashboard
          userName={userName}
          onViewJob={(id) => onNavigate?.(`/jobs/${id}`)}
          onViewJobs={onViewJobs}
          onOpenTeamChat={() => onNavigate?.('/team-chat')}
          onNavigate={onNavigate}
        />
      );

    // Team owner - has team members, shows job scheduler
    case "owner":
      if (hasActiveTeam) {
        return (
          <TeamOwnerDashboard
            userName={userName}
            businessName={businessName}
            onCreateJob={canCreateJobs ? onCreateJob : undefined}
            onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
            onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
            onViewJobs={onViewJobs}
            onViewInvoices={onViewInvoices}
            onViewQuotes={onViewQuotes}
            onNavigate={onNavigate}
          />
        );
      }
      // Owner without team - fall through to manager dashboard
      return (
        <OwnerManagerDashboard
          userName={userName}
          businessName={businessName}
          onCreateJob={canCreateJobs ? onCreateJob : undefined}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );

    // Manager - similar to owner but may have some limitations
    case "manager":
      return (
        <TeamOwnerDashboard
          userName={userName}
          businessName={businessName}
          onCreateJob={canCreateJobs ? onCreateJob : undefined}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );

    // Solo tradie/owner - independent, full access to all business features, no team features
    case "solo_tradie":
    default:
      return (
        <OwnerManagerDashboard
          userName={userName}
          businessName={businessName}
          onCreateJob={canCreateJobs ? onCreateJob : undefined}
          onCreateQuote={canCreateQuotes ? onCreateQuote : undefined}
          onCreateInvoice={canCreateInvoices ? onCreateInvoice : undefined}
          onViewJobs={onViewJobs}
          onViewInvoices={onViewInvoices}
          onViewQuotes={onViewQuotes}
          onNavigate={onNavigate}
        />
      );
  }
}
