import { storage } from './storage';

export const PERMISSIONS = {
  READ_JOBS: 'read_jobs',
  WRITE_JOBS: 'write_jobs',
  READ_QUOTES: 'read_quotes',
  WRITE_QUOTES: 'write_quotes',
  READ_INVOICES: 'read_invoices',
  WRITE_INVOICES: 'write_invoices',
  READ_CLIENTS: 'read_clients',
  WRITE_CLIENTS: 'write_clients',
  MANAGE_TEAM: 'manage_team',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PAYMENTS: 'manage_payments',
  READ_REPORTS: 'read_reports',
  MANAGE_TEMPLATES: 'manage_templates',
  READ_TIME_ENTRIES: 'read_time_entries',
  WRITE_TIME_ENTRIES: 'write_time_entries',
  READ_EXPENSES: 'read_expenses',
  WRITE_EXPENSES: 'write_expenses',
  MANAGE_CATALOG: 'manage_catalog',
  VIEW_ALL: 'view_all',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_TEMPLATES = {
  OWNER: {
    name: 'Owner',
    permissions: Object.values(PERMISSIONS),
    description: 'Full access to all features',
  },
  ADMIN: {
    name: 'Admin',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS,
      PERMISSIONS.READ_QUOTES, PERMISSIONS.WRITE_QUOTES,
      PERMISSIONS.READ_INVOICES, PERMISSIONS.WRITE_INVOICES,
      PERMISSIONS.READ_CLIENTS, PERMISSIONS.WRITE_CLIENTS,
      PERMISSIONS.MANAGE_TEAM,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.MANAGE_TEMPLATES,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES, PERMISSIONS.WRITE_EXPENSES,
      PERMISSIONS.MANAGE_CATALOG,
      PERMISSIONS.VIEW_ALL,
    ],
    description: 'Almost full access, except payment management',
  },
  SUPERVISOR: {
    name: 'Supervisor',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS,
      PERMISSIONS.READ_QUOTES,
      PERMISSIONS.READ_INVOICES,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES,
      PERMISSIONS.VIEW_ALL,
    ],
    description: 'Can manage jobs and view most data',
  },
  STAFF: {
    name: 'Staff',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
    ],
    description: 'Basic access to view jobs and manage own time entries',
  },
};

export interface UserContext {
  userId: string;
  isOwner: boolean;
  effectiveUserId: string;
  businessOwnerId: string | null;
  permissions: Permission[];
  teamMemberId: string | null;
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const teamMembership = await storage.getTeamMembershipByMemberId(userId);
  
  if (teamMembership && teamMembership.inviteStatus === 'accepted') {
    const role = await storage.getUserRole(teamMembership.roleId);
    
    // Use custom permissions if enabled for this team member, otherwise use role defaults
    let permissions: Permission[];
    if (teamMembership.useCustomPermissions && teamMembership.customPermissions) {
      permissions = teamMembership.customPermissions as Permission[];
    } else {
      permissions = (role?.permissions as Permission[]) || [];
    }
    
    return {
      userId,
      isOwner: false,
      effectiveUserId: teamMembership.businessOwnerId,
      businessOwnerId: teamMembership.businessOwnerId,
      permissions,
      teamMemberId: teamMembership.id,
    };
  }
  
  return {
    userId,
    isOwner: true,
    effectiveUserId: userId,
    businessOwnerId: null,
    permissions: Object.values(PERMISSIONS),
    teamMemberId: null,
  };
}

export function hasPermission(userContext: UserContext, requiredPermission: Permission): boolean {
  if (userContext.isOwner) return true;
  return userContext.permissions.includes(requiredPermission);
}

export function hasAnyPermission(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  return requiredPermissions.some(p => userContext.permissions.includes(p));
}

export function hasAllPermissions(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  return requiredPermissions.every(p => userContext.permissions.includes(p));
}

export function createPermissionMiddleware(requiredPermission: Permission | Permission[]) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userContext = await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;
      
      const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const hasAccess = hasAnyPermission(userContext, permissions);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: `You don't have permission to perform this action`,
          requiredPermission: permissions,
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function ownerOnly() {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userContext = await getUserContext(req.userId);
      req.userContext = userContext;
      req.effectiveUserId = userContext.effectiveUserId;
      
      if (!userContext.isOwner) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'This action is restricted to business owners only',
        });
      }
      
      next();
    } catch (error) {
      console.error('Owner check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
