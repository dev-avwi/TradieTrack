export type UserRoleType = 'owner' | 'manager' | 'staff' | 'solo_owner' | 'loading';

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  useCustomPermissions?: boolean;
  customPermissions?: string[];
}

interface CachedRoleData {
  role: UserRoleType;
  permissions: string[];
  teamMemberInfo: TeamMemberInfo | null;
  timestamp: number;
}

export const roleCache = new Map<string, CachedRoleData>();

export const fetchingUsers = new Set<string>();

// Session counter for stale fetch detection - incremented on cache clear/logout
let sessionCounter = 0;

export const getSessionCounter = () => sessionCounter;

// Clear cache and increment session counter (for logout/security scenarios)
export const clearRoleCache = () => {
  roleCache.clear();
  fetchingUsers.clear();
  sessionCounter++;
};

// Invalidate cache for a specific user (for permission refresh)
// Does NOT increment session counter - that happens when fetch starts
export const invalidateUserRoleCache = (userId: string) => {
  roleCache.delete(userId);
  fetchingUsers.delete(userId);
};

// Increment session counter when a new fetch cycle begins
// Returns the new session value to capture in the fetch
export const startNewFetchSession = () => {
  sessionCounter++;
  return sessionCounter;
};
