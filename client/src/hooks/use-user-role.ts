import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { WORKER_PERMISSIONS, type WorkerPermission } from "@shared/schema";

export type UserRoleType = "owner" | "manager" | "tradie" | "loading";

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface BusinessSettings {
  id: string;
  userId: string;
  businessName: string;
  teamSize: string;
}

interface TeamMemberInfo {
  roleId?: string;
  roleName?: string;
  role?: string;
  permissions: Record<string, boolean> | string[];
  isOwner?: boolean;
  hasCustomPermissions?: boolean;
  customPermissions?: string[] | null;
}

export { WORKER_PERMISSIONS };

async function fetchTeamRole(): Promise<TeamMemberInfo | null> {
  const res = await fetch("/api/team/my-role", { credentials: "include" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Error fetching team role: ${res.status}`);
  }
  return res.json();
}

export function useUserRole() {
  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({ queryKey: ["/api/business-settings"] });
  
  const { data: teamMemberInfo, isLoading: teamRoleLoading } = useQuery<TeamMemberInfo | null>({
    queryKey: ["/api/team/my-role"],
    queryFn: fetchTeamRole,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = userLoading || settingsLoading || teamRoleLoading;

  const getUserRole = (): UserRoleType => {
    if (isLoading) return "loading";
    
    if (teamMemberInfo) {
      if (teamMemberInfo.isOwner || teamMemberInfo.role === 'owner') {
        return "owner";
      }
      
      if (teamMemberInfo.roleName) {
        const roleName = teamMemberInfo.roleName.toLowerCase();
        if (roleName.includes("manager") || roleName.includes("admin")) {
          return "manager";
        }
        return "tradie";
      }
    }
    
    if (businessSettings && user && businessSettings.userId === user.id) {
      return "owner";
    }
    
    return "owner";
  };

  const role = getUserRole();
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isTradie = role === "tradie";
  
  const hasCustomPermissions = teamMemberInfo?.hasCustomPermissions === true;
  
  const getPermissions = useCallback((): string[] => {
    if (isOwner) {
      return Object.values(WORKER_PERMISSIONS);
    }
    if (!teamMemberInfo?.permissions) return [];
    if (Array.isArray(teamMemberInfo.permissions)) {
      return teamMemberInfo.permissions;
    }
    return Object.entries(teamMemberInfo.permissions)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);
  }, [teamMemberInfo?.permissions, isOwner]);

  const permissions = getPermissions();

  const hasPermission = useCallback((key: string): boolean => {
    if (isOwner) return true;
    return permissions.includes(key);
  }, [permissions, isOwner]);

  return {
    role,
    isOwner,
    isManager,
    isTradie,
    isLoading,
    permissions,
    hasPermission,
    hasCustomPermissions,
  };
}
