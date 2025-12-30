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
  roleId?: string;
  roleName?: string;
  role?: string; // New format for owners
  permissions: Record<string, boolean> | string[];
  isOwner?: boolean;
}

// Custom fetch function that returns null for 404 (expected for business owners)
async function fetchTeamRole(): Promise<TeamMemberInfo | null> {
  const res = await fetch("/api/team/my-role", { credentials: "include" });
  if (res.status === 404) {
    return null; // Expected for business owners - not an error
  }
  if (!res.ok) {
    throw new Error(`Error fetching team role: ${res.status}`);
  }
  return res.json();
}

export function useUserRole() {
  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({ queryKey: ["/api/business-settings"] });
  
  // Fetch team role info - 404 is expected for business owners (not team members)
  // Use custom queryFn that returns null for 404 instead of throwing
  const { data: teamMemberInfo, isLoading: teamRoleLoading } = useQuery<TeamMemberInfo | null>({
    queryKey: ["/api/team/my-role"],
    queryFn: fetchTeamRole,
    retry: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Combined loading state - must wait for all queries to complete
  const isLoading = userLoading || settingsLoading || teamRoleLoading;

  // Determine role based on data
  const getUserRole = (): UserRoleType => {
    // Wait for all data to load before determining role
    if (isLoading) return "loading";
    
    // Check API response for role info
    if (teamMemberInfo) {
      // New format: API returns { role: 'owner', isOwner: true } for business owners
      if (teamMemberInfo.isOwner || teamMemberInfo.role === 'owner') {
        return "owner";
      }
      
      // Team member format: API returns { roleName: '...', roleId: '...' }
      if (teamMemberInfo.roleName) {
        const roleName = teamMemberInfo.roleName.toLowerCase();
        if (roleName.includes("manager") || roleName.includes("admin")) {
          return "manager";
        }
        return "tradie";
      }
    }
    
    // If user has business settings, they're the owner
    if (businessSettings && user && businessSettings.userId === user.id) {
      return "owner";
    }
    
    // Default to owner if they're logged in but not a team member
    return "owner";
  };

  const role = getUserRole();
  
  // Handle permissions - can be object (for owners) or array (for team members)
  const getPermissions = () => {
    if (!teamMemberInfo?.permissions) return [];
    if (Array.isArray(teamMemberInfo.permissions)) {
      return teamMemberInfo.permissions;
    }
    // Convert object to array of enabled permission keys
    return Object.entries(teamMemberInfo.permissions)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);
  };

  return {
    role,
    isOwner: role === "owner",
    isManager: role === "manager",
    isTradie: role === "tradie",
    isLoading,
    permissions: getPermissions(),
  };
}
