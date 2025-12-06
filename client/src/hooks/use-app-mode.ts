import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "./use-user-role";
import { useCallback } from "react";
import { type UserRole, canAccessPath, getActionPermissions } from "@/lib/permissions";

export type AppMode = "solo" | "team" | "loading";

// Dashboard types determine which dashboard UI to show
export type DashboardType = 
  | "owner"           // Full team owner dashboard with job assignment
  | "manager"         // Manager dashboard (similar to owner but limited)
  | "staff_tradie"    // Team member dashboard - limited to assigned jobs
  | "solo_tradie"     // Independent tradie - full access but no team features
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
  const queryClient = useQueryClient();
  const { role, isOwner, isManager, isTradie, permissions, isLoading: roleLoading } = useUserRole();
  
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"] 
  });
  
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({ 
    queryKey: ["/api/business-settings"] 
  });
  
  // Only fetch team members if user is owner or manager
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    enabled: isOwner || isManager,
  });

  const isLoading = roleLoading || settingsLoading || ((isOwner || isManager) && teamLoading);

  // Check if business has active team members
  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === "accepted");
  const hasActiveTeam = acceptedMembers.length > 0;

  // Determine the app mode (solo vs team)
  // IMPORTANT: Check owner/manager cases before generic isTradie
  const getAppMode = (): AppMode => {
    if (isLoading) return "loading";
    
    // Owners/managers with accepted team members are in team mode
    if ((isOwner || isManager) && hasActiveTeam) {
      return "team";
    }
    
    // If owner configured for team but no members yet, still show team mode
    if (isOwner && (
      businessSettings?.teamSize === "small" || 
      businessSettings?.teamSize === "medium" || 
      businessSettings?.teamSize === "large"
    )) {
      return "team";
    }
    
    // Solo owner
    if (isOwner && businessSettings?.teamSize === "solo") {
      return "solo";
    }
    
    // Staff tradies (team members) are always in team mode
    if (isTradie || isManager) {
      return "team";
    }
    
    // Fallback to solo for owners without team config
    if (isOwner) {
      return "solo";
    }
    
    return "solo";
  };

  // Determine which dashboard type to show
  // IMPORTANT: Check owner/manager BEFORE isTradie to avoid downgrading their dashboard
  const getDashboardType = (): DashboardType => {
    if (isLoading) return "loading";
    
    // Owner with team members - team owner dashboard (highest priority)
    if (isOwner && hasActiveTeam) {
      return "owner";
    }
    
    // Owner configured for team but no members yet - still show owner dashboard
    if (isOwner && (
      businessSettings?.teamSize === "small" || 
      businessSettings?.teamSize === "medium" || 
      businessSettings?.teamSize === "large"
    )) {
      return "owner";
    }
    
    // Solo owner
    if (isOwner) {
      return "solo_tradie";
    }
    
    // Manager - similar to owner but some limitations
    if (isManager) {
      return "manager";
    }
    
    // Staff tradie (team member) - limited view
    if (isTradie) {
      return "staff_tradie";
    }
    
    // Fallback: Solo tradie - independent with full access
    return "solo_tradie";
  };

  const appMode = getAppMode();
  const dashboardType = getDashboardType();

  // Refresh app mode - call this when team configuration changes
  const refreshAppMode = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/team/my-role"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [queryClient]);

  // Permission checks
  const canAccessChat = appMode === "team";
  const canAccessTeamChat = appMode === "team" && (isOwner || isManager || isTradie);
  const canAccessJobChat = appMode === "team";
  const canAccessReports = isOwner || isManager;
  const canAccessSettings = isOwner || isManager;
  const canManageTeam = isOwner || isManager;
  const canAssignJobs = isOwner || isManager;
  const canAccessBilling = isOwner;
  const canAccessAllJobs = isOwner || isManager;
  const canCreateJobs = isOwner || isManager || dashboardType === "solo_tradie";
  const canCreateQuotes = isOwner || isManager || dashboardType === "solo_tradie";
  const canCreateInvoices = isOwner || isManager || dashboardType === "solo_tradie";
  
  // Staff tradies only see their assigned jobs
  const shouldFilterToAssignedJobs = isTradie;
  
  // Show location check-in for tradies and in team mode
  const shouldShowTimeTracking = true;
  const shouldShowLocationCheckin = isTradie || appMode === "team";
  
  // Show job scheduler (drag-and-drop) for owners/managers with team
  const shouldShowJobScheduler = (isOwner || isManager) && hasActiveTeam;
  
  // Show upgrade prompt for solo owners (those with teamSize "solo" or undefined/null)
  const canUpgradeToTeam = dashboardType === "solo_tradie" && 
    (!businessSettings?.teamSize || businessSettings?.teamSize === "solo");

  // Get the user role for permission checks
  // IMPORTANT: Check owner/manager BEFORE isTradie to avoid downgrading their role
  const getUserRoleType = (): UserRole => {
    if (isLoading) return "staff_tradie"; // Default to most restrictive while loading
    // Owner always has highest priority
    if (isOwner && hasActiveTeam) return "owner";
    if (isOwner) return "solo_owner";
    // Manager is second priority
    if (isManager) return "manager";
    // Staff tradie (team member without owner/manager flags)
    if (isTradie) return "staff_tradie";
    // Fallback to solo_owner for authenticated users
    return "solo_owner";
  };
  
  const userRole = getUserRoleType();
  const actionPermissions = getActionPermissions(userRole);
  
  // Permission check function for routes
  const canAccessRoute = (path: string): boolean => {
    return canAccessPath(userRole, path);
  };

  return {
    // Mode info
    mode: appMode,
    isSolo: appMode === "solo",
    isTeam: appMode === "team",
    isLoading,
    
    // Dashboard routing
    dashboardType,
    
    // Role info
    role,
    isOwner,
    isManager,
    isTradie,
    permissions,
    
    // Permissions
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
    
    // UI behavior
    shouldFilterToAssignedJobs,
    shouldShowTimeTracking,
    shouldShowLocationCheckin,
    shouldShowJobScheduler,
    canUpgradeToTeam,
    
    // Team info
    teamMemberCount: acceptedMembers.length,
    teamMembers: acceptedMembers,
    hasActiveTeam,
    
    // Actions
    refreshAppMode,
    
    // Role-based permissions
    userRole,
    actionPermissions,
    canAccessRoute,
  };
}
