import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

// Cache TTL in milliseconds (30 seconds - short to catch permission changes quickly)
const CACHE_TTL_MS = 30 * 1000;

// Periodic refetch interval while app is active (every 30 seconds to match TTL)
const PERIODIC_REFETCH_MS = 30 * 1000;

export type UserRoleType = 'owner' | 'manager' | 'staff' | 'solo_owner' | 'loading';

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  useCustomPermissions?: boolean;
  customPermissions?: string[];
}

// Permission keys that match the backend
export const PERMISSION_KEYS = {
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENTS: 'create_clients',
  EDIT_CLIENTS: 'edit_clients',
  DELETE_CLIENTS: 'delete_clients',
  VIEW_JOBS: 'view_jobs',
  CREATE_JOBS: 'create_jobs',
  EDIT_JOBS: 'edit_jobs',
  DELETE_JOBS: 'delete_jobs',
  ASSIGN_JOBS: 'assign_jobs',
  VIEW_QUOTES: 'view_quotes',
  CREATE_QUOTES: 'create_quotes',
  EDIT_QUOTES: 'edit_quotes',
  DELETE_QUOTES: 'delete_quotes',
  SEND_QUOTES: 'send_quotes',
  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICES: 'create_invoices',
  EDIT_INVOICES: 'edit_invoices',
  DELETE_INVOICES: 'delete_invoices',
  SEND_INVOICES: 'send_invoices',
  COLLECT_PAYMENTS: 'collect_payments',
  VIEW_TEAM: 'view_team',
  MANAGE_TEAM: 'manage_team',
  MANAGE_ROLES: 'manage_roles',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BILLING: 'manage_billing',
  VIEW_MAP: 'view_map',
  VIEW_DISPATCH: 'view_dispatch',
  MANAGE_TEMPLATES: 'manage_templates',
  MANAGE_CATALOG: 'manage_catalog',
} as const;

interface CachedRoleData {
  role: UserRoleType;
  permissions: string[];
  teamMemberInfo: TeamMemberInfo | null;
  timestamp: number;
}

// Per-user cache - NEVER cleared on login/logout, only updated
// This allows returning to same user session without refetch
const roleCache = new Map<string, CachedRoleData>();

// Track which users are currently being fetched
const fetchingUsers = new Set<string>();

// Session counter for stale fetch detection
let sessionCounter = 0;

// Clear cache only for security-critical scenarios (should rarely be needed)
export const clearRoleCache = () => {
  roleCache.clear();
  fetchingUsers.clear();
  sessionCounter++;
};

// Invalidate cache for a specific user (for permission refresh)
export const invalidateUserRoleCache = (userId: string) => {
  roleCache.delete(userId);
  fetchingUsers.delete(userId);
};

// Check if cache is stale (older than TTL)
const isCacheStale = (cache: CachedRoleData | undefined): boolean => {
  if (!cache) return true;
  return Date.now() - cache.timestamp > CACHE_TTL_MS;
};

// Helper to get permissions from team member info (respects custom permissions)
const getTeamMemberPermissions = (info: TeamMemberInfo): string[] => {
  // Use custom permissions if enabled
  if (info.useCustomPermissions && info.customPermissions) {
    return info.customPermissions;
  }
  // Otherwise use standard role permissions
  return info.permissions || [];
};

// Helper to determine role from team info
const getRoleFromTeamInfo = (info: TeamMemberInfo): UserRoleType => {
  const roleName = info.roleName.toLowerCase();
  if (roleName.includes('owner')) return 'owner';
  if (roleName.includes('manager') || roleName.includes('admin') || roleName.includes('supervisor')) {
    return 'manager';
  }
  return 'staff';
};

// Check if user is business owner based on settings
const isBusinessOwner = (settings: any, userId: string | undefined): boolean => {
  if (!settings || !userId) return false;
  const settingsUserId = settings.userId || settings.user_id;
  return settingsUserId === userId;
};

export function useUserRole() {
  const { user, businessSettings } = useAuthStore();
  const userId = user?.id;
  
  // Force re-render trigger when fetch completes
  const [fetchVersion, setFetchVersion] = useState(0);
  const sessionRef = useRef(sessionCounter);
  const mountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Revalidate cache when app comes to foreground (match web's focus refetch)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        userId
      ) {
        // App came to foreground - always refetch like web's focus refetch
        // This ensures permission changes are picked up immediately
        roleCache.delete(userId);
        fetchingUsers.delete(userId);
        setFetchVersion(v => v + 1);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId]);

  // Periodic refetch while app is active (catch permission changes without focus change)
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      // Only refetch if cache is stale
      const cache = roleCache.get(userId);
      if (isCacheStale(cache)) {
        roleCache.delete(userId);
        fetchingUsers.delete(userId);
        setFetchVersion(v => v + 1);
      }
    }, PERIODIC_REFETCH_MS);
    
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch role info when userId changes or cache is stale
  useEffect(() => {
    sessionRef.current = sessionCounter;
    
    if (!userId) return;
    
    // Check if cache exists and is fresh
    const existingCache = roleCache.get(userId);
    if (existingCache && !isCacheStale(existingCache)) return;
    
    // Skip if already fetching
    if (fetchingUsers.has(userId)) return;
    
    fetchingUsers.add(userId);
    
    async function fetchRoleInfo() {
      try {
        const response = await api.get<TeamMemberInfo>('/api/team/my-role');
        
        // Check for stale fetch
        if (sessionRef.current !== sessionCounter || !mountedRef.current) {
          fetchingUsers.delete(userId);
          return;
        }
        
        const data = response.data || null;
        
        if (data) {
          const role = getRoleFromTeamInfo(data);
          const permissions = getTeamMemberPermissions(data);
          roleCache.set(userId, {
            role,
            permissions,
            teamMemberInfo: data,
            timestamp: Date.now(),
          });
        }
        
        fetchingUsers.delete(userId);
        if (mountedRef.current) setFetchVersion(v => v + 1);
        
      } catch (error: any) {
        if (sessionRef.current !== sessionCounter || !mountedRef.current) {
          fetchingUsers.delete(userId);
          return;
        }
        
        const status = error?.response?.status;
        if (status === 404) {
          // 404 = not a team member = likely owner
          const settings = businessSettings as any;
          const ownerCheck = isBusinessOwner(settings, userId);
          const teamSize = settings?.teamSize || settings?.team_size || 'solo';
          const role: UserRoleType = ownerCheck 
            ? (teamSize === '1' || teamSize === 'solo' ? 'solo_owner' : 'owner')
            : 'staff';
          
          roleCache.set(userId, {
            role,
            permissions: role === 'owner' || role === 'solo_owner' 
              ? Object.values(PERMISSION_KEYS) 
              : [],
            teamMemberInfo: null,
            timestamp: Date.now(),
          });
        }
        
        fetchingUsers.delete(userId);
        if (mountedRef.current) setFetchVersion(v => v + 1);
      }
    }
    
    fetchRoleInfo();
  }, [userId, businessSettings, fetchVersion]);

  // Derive all values from cache - NO stale state possible
  const cache = userId ? roleCache.get(userId) : undefined;
  const isFetching = userId ? fetchingUsers.has(userId) : false;
  
  // Determine current role
  const getCurrentRole = useCallback((): UserRoleType => {
    if (!userId) return 'staff';
    
    // If we have cache, use it
    if (cache) return cache.role;
    
    // If fetching, determine preliminary role from business settings
    if (isFetching || !cache) {
      if (isBusinessOwner(businessSettings, userId)) {
        // Likely owner - return owner to prevent flicker
        const settings = businessSettings as any;
        const teamSize = settings?.teamSize || settings?.team_size || 'solo';
        return teamSize === '1' || teamSize === 'solo' ? 'solo_owner' : 'owner';
      }
      // Unknown - return loading
      return 'loading';
    }
    
    return 'staff';
  }, [userId, cache, isFetching, businessSettings]);

  // Get permissions
  const getPermissions = useCallback((): string[] => {
    if (!userId) return [];
    
    // If we have cache, use it
    if (cache) return cache.permissions;
    
    // If likely owner during loading, grant all
    if (isBusinessOwner(businessSettings, userId)) {
      return Object.values(PERMISSION_KEYS);
    }
    
    return [];
  }, [userId, cache, businessSettings]);

  const role = getCurrentRole();
  const permissions = getPermissions();
  const isLoading = role === 'loading' || (isFetching && !cache);
  
  // Check permission
  const hasPermission = useCallback((key: string): boolean => {
    if (!userId) return false;
    
    // If cached, use cache
    if (cache) {
      if (cache.role === 'owner' || cache.role === 'solo_owner') return true;
      return cache.permissions.includes(key);
    }
    
    // During loading, check if likely owner
    if (isBusinessOwner(businessSettings, userId)) return true;
    
    // Otherwise deny (safe default)
    return false;
  }, [userId, cache, businessSettings]);

  // Role booleans
  const isOwner = role === 'owner' || role === 'solo_owner';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isSolo = role === 'solo_owner';
  const hasTeamAccess = isOwner || isManager;

  return {
    role,
    isOwner,
    isManager,
    isStaff,
    isSolo,
    hasTeamAccess,
    isLoading,
    permissions,
    hasPermission,
    
    // Client permissions
    canViewClients: hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    canCreateClients: hasPermission(PERMISSION_KEYS.CREATE_CLIENTS),
    canEditClients: hasPermission(PERMISSION_KEYS.EDIT_CLIENTS),
    canDeleteClients: hasPermission(PERMISSION_KEYS.DELETE_CLIENTS),
    canAccessClients: hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    
    // Job permissions
    canViewJobs: hasPermission(PERMISSION_KEYS.VIEW_JOBS),
    canCreateJobs: hasPermission(PERMISSION_KEYS.CREATE_JOBS),
    canEditJobs: hasPermission(PERMISSION_KEYS.EDIT_JOBS),
    canDeleteJobs: hasPermission(PERMISSION_KEYS.DELETE_JOBS),
    canAssignJobs: hasPermission(PERMISSION_KEYS.ASSIGN_JOBS),
    
    // Quote permissions
    canViewQuotes: hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    canCreateQuotes: hasPermission(PERMISSION_KEYS.CREATE_QUOTES),
    canEditQuotes: hasPermission(PERMISSION_KEYS.EDIT_QUOTES),
    canDeleteQuotes: hasPermission(PERMISSION_KEYS.DELETE_QUOTES),
    canSendQuotes: hasPermission(PERMISSION_KEYS.SEND_QUOTES),
    canAccessQuotes: hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    
    // Invoice permissions
    canViewInvoices: hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    canCreateInvoices: hasPermission(PERMISSION_KEYS.CREATE_INVOICES),
    canEditInvoices: hasPermission(PERMISSION_KEYS.EDIT_INVOICES),
    canDeleteInvoices: hasPermission(PERMISSION_KEYS.DELETE_INVOICES),
    canSendInvoices: hasPermission(PERMISSION_KEYS.SEND_INVOICES),
    canCollectPayments: hasPermission(PERMISSION_KEYS.COLLECT_PAYMENTS),
    canAccessInvoices: hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    
    // Team permissions
    canViewTeam: hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    canManageTeam: hasPermission(PERMISSION_KEYS.MANAGE_TEAM),
    canManageRoles: hasPermission(PERMISSION_KEYS.MANAGE_ROLES),
    canAccessTeamManagement: hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    
    // Other permissions
    canAccessReports: hasPermission(PERMISSION_KEYS.VIEW_REPORTS),
    canAccessSettings: hasPermission(PERMISSION_KEYS.MANAGE_SETTINGS),
    canAccessBilling: hasPermission(PERMISSION_KEYS.MANAGE_BILLING),
    canAccessMap: hasPermission(PERMISSION_KEYS.VIEW_MAP),
    canAccessDispatch: hasPermission(PERMISSION_KEYS.VIEW_DISPATCH),
    canManageTemplates: hasPermission(PERMISSION_KEYS.MANAGE_TEMPLATES),
    canManageCatalog: hasPermission(PERMISSION_KEYS.MANAGE_CATALOG),
  };
}
