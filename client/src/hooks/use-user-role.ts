import { useQuery } from "@tanstack/react-query";

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
  roleId: string;
  roleName: string;
  permissions: string[];
}

export function useUserRole() {
  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({ queryKey: ["/api/business-settings"] });
  
  // Always fetch team role info - don't gate it behind user existence
  const { data: teamMemberInfo, isLoading: teamRoleLoading } = useQuery<TeamMemberInfo | null>({
    queryKey: ["/api/team/my-role"],
  });

  // Combined loading state - must wait for all queries to complete
  const isLoading = userLoading || settingsLoading || teamRoleLoading;

  // Determine role based on data
  const getUserRole = (): UserRoleType => {
    // Wait for all data to load before determining role
    if (isLoading) return "loading";
    
    // First check if user is a team member (this takes priority)
    if (teamMemberInfo) {
      const roleName = teamMemberInfo.roleName.toLowerCase();
      if (roleName.includes("manager") || roleName.includes("admin")) {
        return "manager";
      }
      return "tradie";
    }
    
    // If user has business settings, they're the owner
    if (businessSettings && user && businessSettings.userId === user.id) {
      return "owner";
    }
    
    // Default to owner if they're logged in but not a team member
    return "owner";
  };

  const role = getUserRole();
  
  return {
    role,
    isOwner: role === "owner",
    isManager: role === "manager",
    isTradie: role === "tradie",
    isLoading,
    permissions: teamMemberInfo?.permissions || [],
  };
}
