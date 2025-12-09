import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

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
  // Client permissions
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENTS: 'create_clients',
  EDIT_CLIENTS: 'edit_clients',
  DELETE_CLIENTS: 'delete_clients',
  
  // Job permissions
  VIEW_JOBS: 'view_jobs',
  CREATE_JOBS: 'create_jobs',
  EDIT_JOBS: 'edit_jobs',
  DELETE_JOBS: 'delete_jobs',
  ASSIGN_JOBS: 'assign_jobs',
  
  // Quote permissions
  VIEW_QUOTES: 'view_quotes',
  CREATE_QUOTES: 'create_quotes',
  EDIT_QUOTES: 'edit_quotes',
  DELETE_QUOTES: 'delete_quotes',
  SEND_QUOTES: 'send_quotes',
  
  // Invoice permissions
  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICES: 'create_invoices',
  EDIT_INVOICES: 'edit_invoices',
  DELETE_INVOICES: 'delete_invoices',
  SEND_INVOICES: 'send_invoices',
  COLLECT_PAYMENTS: 'collect_payments',
  
  // Team permissions
  VIEW_TEAM: 'view_team',
  MANAGE_TEAM: 'manage_team',
  MANAGE_ROLES: 'manage_roles',
  
  // Other permissions
  VIEW_REPORTS: 'view_reports',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BILLING: 'manage_billing',
  VIEW_MAP: 'view_map',
  VIEW_DISPATCH: 'view_dispatch',
  MANAGE_TEMPLATES: 'manage_templates',
  MANAGE_CATALOG: 'manage_catalog',
} as const;

export function useUserRole() {
  const { user, businessSettings } = useAuthStore();
  const [teamMemberInfo, setTeamMemberInfo] = useState<TeamMemberInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleCheckComplete, setRoleCheckComplete] = useState(false);
  const [is404Response, setIs404Response] = useState(false);

  useEffect(() => {
    async function fetchRoleInfo() {
      if (!user) {
        setIsLoading(false);
        setRoleCheckComplete(true);
        return;
      }

      try {
        const response = await api.get<TeamMemberInfo>('/api/team/my-role');
        setTeamMemberInfo(response.data || null);
        setIs404Response(false);
      } catch (error: any) {
        setTeamMemberInfo(null);
        setIs404Response(error?.response?.status === 404);
      } finally {
        setIsLoading(false);
        setRoleCheckComplete(true);
      }
    }

    fetchRoleInfo();
  }, [user?.id]);

  const getUserRole = (): UserRoleType => {
    if (isLoading) return 'loading';
    
    if (teamMemberInfo) {
      const roleName = teamMemberInfo.roleName.toLowerCase();
      
      if (roleName.includes('owner')) {
        return 'owner';
      }
      if (roleName.includes('manager') || roleName.includes('admin') || roleName.includes('supervisor')) {
        return 'manager';
      }
      return 'staff';
    }
    
    if (is404Response && businessSettings && user) {
      const settings = businessSettings as any;
      const isBusinessOwner = settings.userId === user.id || settings.user_id === user.id;
      
      if (isBusinessOwner) {
        const teamSize = settings.teamSize || settings.team_size || '1';
        if (teamSize === '1' || teamSize === 'solo') {
          return 'solo_owner';
        }
        return 'owner';
      }
    }
    
    return 'staff';
  };

  // Get the effective permissions - use custom if enabled, else role defaults
  const getEffectivePermissions = (): string[] => {
    if (!teamMemberInfo) {
      // Solo owners and business owners get all permissions
      if (is404Response && businessSettings && user) {
        const settings = businessSettings as any;
        const isBusinessOwner = settings.userId === user.id || settings.user_id === user.id;
        if (isBusinessOwner) {
          return Object.values(PERMISSION_KEYS);
        }
      }
      return [];
    }
    
    // The API now returns the merged permissions (custom or role-based)
    return teamMemberInfo.permissions || [];
  };

  // Check if user has a specific permission
  const hasPermission = (permissionKey: string): boolean => {
    const role = getUserRole();
    
    // Owners and solo owners have all permissions
    if (role === 'owner' || role === 'solo_owner') {
      return true;
    }
    
    const permissions = getEffectivePermissions();
    return permissions.includes(permissionKey);
  };

  const role = getUserRole();
  const isResolved = roleCheckComplete && !isLoading;
  
  const isOwner = isResolved && (role === 'owner' || role === 'solo_owner');
  const isManager = isResolved && role === 'manager';
  const isStaff = !isResolved || role === 'staff';
  const isSolo = isResolved && role === 'solo_owner';
  const hasTeamAccess = isOwner || isManager;

  // Dynamic permission checks using the actual permissions from API
  const effectivePermissions = getEffectivePermissions();

  return {
    role: isResolved ? role : 'staff',
    isOwner,
    isManager,
    isStaff,
    isSolo,
    hasTeamAccess,
    isLoading,
    permissions: effectivePermissions,
    
    // Permission check function for custom checks
    hasPermission,
    
    // Client permissions
    canViewClients: isOwner || hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    canCreateClients: isOwner || hasPermission(PERMISSION_KEYS.CREATE_CLIENTS),
    canEditClients: isOwner || hasPermission(PERMISSION_KEYS.EDIT_CLIENTS),
    canDeleteClients: isOwner || hasPermission(PERMISSION_KEYS.DELETE_CLIENTS),
    canAccessClients: isOwner || hasPermission(PERMISSION_KEYS.VIEW_CLIENTS),
    
    // Job permissions
    canViewJobs: isOwner || hasPermission(PERMISSION_KEYS.VIEW_JOBS),
    canCreateJobs: isOwner || hasPermission(PERMISSION_KEYS.CREATE_JOBS),
    canEditJobs: isOwner || hasPermission(PERMISSION_KEYS.EDIT_JOBS),
    canDeleteJobs: isOwner || hasPermission(PERMISSION_KEYS.DELETE_JOBS),
    canAssignJobs: isOwner || hasPermission(PERMISSION_KEYS.ASSIGN_JOBS),
    
    // Quote permissions
    canViewQuotes: isOwner || hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    canCreateQuotes: isOwner || hasPermission(PERMISSION_KEYS.CREATE_QUOTES),
    canEditQuotes: isOwner || hasPermission(PERMISSION_KEYS.EDIT_QUOTES),
    canDeleteQuotes: isOwner || hasPermission(PERMISSION_KEYS.DELETE_QUOTES),
    canSendQuotes: isOwner || hasPermission(PERMISSION_KEYS.SEND_QUOTES),
    canAccessQuotes: isOwner || hasPermission(PERMISSION_KEYS.VIEW_QUOTES),
    
    // Invoice permissions
    canViewInvoices: isOwner || hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    canCreateInvoices: isOwner || hasPermission(PERMISSION_KEYS.CREATE_INVOICES),
    canEditInvoices: isOwner || hasPermission(PERMISSION_KEYS.EDIT_INVOICES),
    canDeleteInvoices: isOwner || hasPermission(PERMISSION_KEYS.DELETE_INVOICES),
    canSendInvoices: isOwner || hasPermission(PERMISSION_KEYS.SEND_INVOICES),
    canCollectPayments: isOwner || hasPermission(PERMISSION_KEYS.COLLECT_PAYMENTS),
    canAccessInvoices: isOwner || hasPermission(PERMISSION_KEYS.VIEW_INVOICES),
    
    // Team permissions
    canViewTeam: isOwner || hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    canManageTeam: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_TEAM),
    canManageRoles: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_ROLES),
    canAccessTeamManagement: isOwner || hasPermission(PERMISSION_KEYS.VIEW_TEAM),
    
    // Other permissions
    canAccessReports: isOwner || hasPermission(PERMISSION_KEYS.VIEW_REPORTS),
    canAccessSettings: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_SETTINGS),
    canAccessBilling: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_BILLING),
    canAccessMap: isOwner || hasPermission(PERMISSION_KEYS.VIEW_MAP),
    canAccessDispatch: isOwner || hasPermission(PERMISSION_KEYS.VIEW_DISPATCH),
    canManageTemplates: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_TEMPLATES),
    canManageCatalog: isOwner || hasPermission(PERMISSION_KEYS.MANAGE_CATALOG),
  };
}
