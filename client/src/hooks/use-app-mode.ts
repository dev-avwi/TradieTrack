import { useQuery } from "@tanstack/react-query";
import { safeInvalidateQueries } from "@/lib/queryClient";
import { useUserRole, WORKER_PERMISSIONS } from "./use-user-role";
import { useCallback } from "react";
import { type UserRole, canAccessPath, getActionPermissions, type ActionPermissions } from "@/lib/permissions";
import { mergeWithCustomPermissions } from "@/lib/permission-map";

export type AppMode = "solo" | "team" | "loading";

export type DashboardType = 
  | "owner"
  | "manager"
  | "staff_tradie"
  | "solo_tradie"
  | "loading";

interface BusinessSettings {
  id: string;
  userId: string;
  businessName: string;
  teamSize: string;
}

interface TeamMember {
  id: string;
  userId?: string;
  inviteStatus: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export function useAppMode() {
  const { 
    role, 
    isOwner, 
    isManager, 
    isTradie, 
    permissions, 
    isLoading: roleLoading,
    hasPermission,
    hasCustomPermissions,
  } = useUserRole();
  
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"] 
  });
  
  const { data: businessSettings, isLoading: settingsLoading, isFetched: settingsFetched } = useQuery<BusinessSettings>({ 
    queryKey: ["/api/business-settings"] 
  });
  
  const { data: teamMembers = [], isLoading: teamLoading, isFetched: teamFetched } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    enabled: isOwner || isManager,
  });

  // Only show loading on initial fetch, not on refetches when we have cached data
  // This prevents the "flash" when navigating between pages
  const hasSettingsData = businessSettings !== undefined || settingsFetched;
  const hasTeamData = teamMembers.length > 0 || teamFetched || !(isOwner || isManager);
  const isLoading = roleLoading || (!hasSettingsData && settingsLoading) || ((isOwner || isManager) && !hasTeamData && teamLoading);

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === "accepted");
  const hasActiveTeam = acceptedMembers.length > 0;

  const getAppMode = (): AppMode => {
    if (isLoading) return "loading";
    
    if ((isOwner || isManager) && hasActiveTeam) {
      return "team";
    }
    
    if (isOwner && (
      businessSettings?.teamSize === "small" || 
      businessSettings?.teamSize === "medium" || 
      businessSettings?.teamSize === "large"
    )) {
      return "team";
    }
    
    if (isOwner && businessSettings?.teamSize === "solo") {
      return "solo";
    }
    
    if (isTradie || isManager) {
      return "team";
    }
    
    if (isOwner) {
      return "solo";
    }
    
    return "solo";
  };

  const getDashboardType = (): DashboardType => {
    if (isLoading) return "loading";
    
    if (isOwner && hasActiveTeam) {
      return "owner";
    }
    
    if (isOwner && (
      businessSettings?.teamSize === "small" || 
      businessSettings?.teamSize === "medium" || 
      businessSettings?.teamSize === "large"
    )) {
      return "owner";
    }
    
    if (isOwner) {
      return "solo_tradie";
    }
    
    if (isManager) {
      return "manager";
    }
    
    if (isTradie) {
      return "staff_tradie";
    }
    
    return "solo_tradie";
  };

  const appMode = getAppMode();
  const dashboardType = getDashboardType();

  const refreshAppMode = useCallback(() => {
    safeInvalidateQueries({ queryKey: ["/api/team/members"] });
    safeInvalidateQueries({ queryKey: ["/api/business-settings"] });
    safeInvalidateQueries({ queryKey: ["/api/team/my-role"] });
    safeInvalidateQueries({ queryKey: ["/api/auth/me"] });
  }, []);

  const getUserRoleType = (): UserRole => {
    if (isLoading) return "staff_tradie";
    if (isOwner && hasActiveTeam) return "owner";
    if (isOwner) return "solo_owner";
    if (isManager) return "manager";
    if (isTradie) return "staff_tradie";
    return "solo_owner";
  };
  
  const userRole = getUserRoleType();
  
  const roleBasedPermissions = getActionPermissions(userRole);
  const actionPermissions = mergeWithCustomPermissions(
    roleBasedPermissions, 
    hasPermission, 
    hasCustomPermissions
  );
  
  const canAccessRoute = (path: string): boolean => {
    return canAccessPath(userRole, path);
  };

  const canAccessChat = appMode === "team";
  const canAccessTeamChat = appMode === "team" && (isOwner || isManager || isTradie);
  const canAccessJobChat = appMode === "team";
  const canAccessReports = actionPermissions.canViewReports;
  const canAccessSettings = actionPermissions.canManageSettings;
  const canManageTeam = actionPermissions.canManageTeam;
  const canAssignJobs = actionPermissions.canAssignJobs;
  const canAccessBilling = actionPermissions.canManageBilling;
  const canAccessAllJobs = actionPermissions.canViewAllJobs;
  const canCreateJobs = actionPermissions.canCreateJobs || dashboardType === "solo_tradie";
  const canCreateQuotes = actionPermissions.canCreateQuotes || dashboardType === "solo_tradie";
  const canCreateInvoices = actionPermissions.canCreateInvoices || dashboardType === "solo_tradie";
  
  const shouldFilterToAssignedJobs = isTradie && !isOwner && !isManager && !actionPermissions.canViewAllJobs;
  
  const shouldShowTimeTracking = true;
  const shouldShowLocationCheckin = isTradie || appMode === "team";
  
  const shouldShowJobScheduler = (isOwner || isManager) && hasActiveTeam;
  
  const canUpgradeToTeam = dashboardType === "solo_tradie" && 
    (!businessSettings?.teamSize || businessSettings?.teamSize === "solo");

  const canCollectPayments = hasPermission(WORKER_PERMISSIONS.COLLECT_PAYMENTS);
  const canViewInvoices = hasPermission(WORKER_PERMISSIONS.VIEW_INVOICES);
  const canViewQuotes = hasPermission(WORKER_PERMISSIONS.VIEW_QUOTES);
  const canViewClients = hasPermission(WORKER_PERMISSIONS.VIEW_CLIENTS);
  const canTimeTracking = hasPermission(WORKER_PERMISSIONS.TIME_TRACKING);
  const canGpsCheckin = hasPermission(WORKER_PERMISSIONS.GPS_CHECKIN);
  const canTeamChat = hasPermission(WORKER_PERMISSIONS.TEAM_CHAT);
  const canClientSms = hasPermission(WORKER_PERMISSIONS.CLIENT_SMS);

  return {
    mode: appMode,
    isSolo: appMode === "solo",
    isTeam: appMode === "team",
    isLoading,
    
    dashboardType,
    
    role,
    isOwner,
    isManager,
    isTradie,
    permissions,
    hasPermission,
    
    canAccessChat,
    canAccessTeamChat,
    canAccessJobChat,
    canAccessReports,
    canAccessSettings,
    canManageTeam,
    canAssignJobs,
    canAccessBilling,
    canAccessAllJobs,
    canCreateJobs,
    canCreateQuotes,
    canCreateInvoices,
    
    canCollectPayments,
    canViewInvoices,
    canViewQuotes,
    canViewClients,
    canTimeTracking,
    canGpsCheckin,
    canTeamChat,
    canClientSms,
    
    shouldFilterToAssignedJobs,
    shouldShowTimeTracking,
    shouldShowLocationCheckin,
    shouldShowJobScheduler,
    canUpgradeToTeam,
    
    teamMemberCount: acceptedMembers.length,
    teamMembers: acceptedMembers,
    hasActiveTeam,
    
    refreshAppMode,
    
    userRole,
    actionPermissions,
    canAccessRoute,
  };
}
