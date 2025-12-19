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
  READ_CLIENTS_SENSITIVE: 'read_clients_sensitive',
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
  ASSIGN_JOBS: 'assign_jobs',
  WRITE_JOB_NOTES: 'write_job_notes',
  WRITE_JOB_MEDIA: 'write_job_media',
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
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS, PERMISSIONS.ASSIGN_JOBS,
      PERMISSIONS.READ_QUOTES, PERMISSIONS.WRITE_QUOTES,
      PERMISSIONS.READ_INVOICES, PERMISSIONS.WRITE_INVOICES,
      PERMISSIONS.READ_CLIENTS, PERMISSIONS.WRITE_CLIENTS, PERMISSIONS.READ_CLIENTS_SENSITIVE,
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
  MANAGER: {
    name: 'Manager',
    permissions: [
      PERMISSIONS.READ_JOBS, PERMISSIONS.WRITE_JOBS, PERMISSIONS.ASSIGN_JOBS,
      PERMISSIONS.READ_QUOTES, PERMISSIONS.WRITE_QUOTES,
      PERMISSIONS.READ_INVOICES, PERMISSIONS.WRITE_INVOICES,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_REPORTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.READ_EXPENSES, PERMISSIONS.WRITE_EXPENSES,
      PERMISSIONS.MANAGE_CATALOG,
      PERMISSIONS.VIEW_ALL,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'Manages jobs, quotes, invoices - assigns to workers only',
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
  WORKER: {
    name: 'Worker',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'Field worker - works on assigned jobs, adds photos and notes',
  },
  STAFF: {
    name: 'Staff',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.READ_CLIENTS,
      PERMISSIONS.READ_TIME_ENTRIES, PERMISSIONS.WRITE_TIME_ENTRIES,
      PERMISSIONS.WRITE_JOB_NOTES,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    description: 'Basic access to assigned jobs - can add photos, notes, and track time',
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
  if (userContext.permissions.includes('*' as Permission)) return true;
  return userContext.permissions.includes(requiredPermission);
}

export function hasAnyPermission(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  if (userContext.permissions.includes('*' as Permission)) return true;
  return requiredPermissions.some(p => userContext.permissions.includes(p));
}

export function hasAllPermissions(userContext: UserContext, requiredPermissions: Permission[]): boolean {
  if (userContext.isOwner) return true;
  if (userContext.permissions.includes('*' as Permission)) return true;
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

/**
 * Checks if a user can access a specific job's media (photos, notes, videos, voice)
 * 
 * Access rules (granular job media separation):
 * - Business owners: Full access to all jobs
 * - True admins (VIEW_ALL + MANAGE_TEAM): Full access to all jobs (for oversight)
 * - All other users: Must have WRITE_JOB_MEDIA/WRITE_JOB_NOTES AND be assigned to the job
 * 
 * Note: VIEW_ALL alone (without MANAGE_TEAM) or WRITE_JOBS alone do NOT grant media access.
 * This ensures staff assigned to scheduling/viewing duties cannot access job media 
 * unless they are explicitly granted media permissions AND assigned to the job.
 * 
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessJobMedia(userContext: UserContext, jobId: string): Promise<boolean> {
  // Owners have full access
  if (userContext.isOwner) {
    return true;
  }
  
  // True admins (VIEW_ALL + MANAGE_TEAM) can access all jobs for oversight
  // This ensures only actual admins, not supervisors with VIEW_ALL for job visibility, 
  // have unrestricted media access
  const isTrueAdmin = userContext.permissions.includes(PERMISSIONS.VIEW_ALL) && 
                      userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM);
  if (isTrueAdmin) {
    return true;
  }
  
  // All other users need:
  // 1. Job media permissions (WRITE_JOB_MEDIA or WRITE_JOB_NOTES)
  // 2. Be assigned to this specific job
  const hasMediaPermission = userContext.permissions.includes(PERMISSIONS.WRITE_JOB_MEDIA) ||
                              userContext.permissions.includes(PERMISSIONS.WRITE_JOB_NOTES);
  
  if (!hasMediaPermission) {
    return false;
  }
  
  // Check if assigned to this job
  try {
    const job = await storage.getJob(jobId, userContext.effectiveUserId);
    if (!job) {
      return false;
    }
    
    // Check if user is assigned to this job
    // assignedTo typically stores userId of the team member
    // Also check teamMemberId for backwards compatibility with legacy data
    const isAssigned = job.assignedTo === userContext.userId ||
                       (userContext.teamMemberId && job.assignedTo === userContext.teamMemberId);
    return isAssigned;
  } catch (error) {
    console.error('Error checking job access:', error);
    return false;
  }
}

/**
 * Checks if a user can write/modify a specific job's media (photos, notes, videos, voice)
 * 
 * Write rules (granular job media separation):
 * - Business owners: Full write access to all jobs
 * - True admins (VIEW_ALL + MANAGE_TEAM): Full write access to all jobs
 * - All other users: Must have WRITE_JOB_MEDIA/WRITE_JOB_NOTES AND be assigned to the job
 * 
 * Note: VIEW_ALL alone or WRITE_JOBS alone do NOT grant media write access.
 */
export async function canWriteJobMedia(userContext: UserContext, jobId: string): Promise<boolean> {
  // Owners have full access
  if (userContext.isOwner) {
    return true;
  }
  
  // True admins (VIEW_ALL + MANAGE_TEAM) can write to all jobs
  const isTrueAdmin = userContext.permissions.includes(PERMISSIONS.VIEW_ALL) && 
                      userContext.permissions.includes(PERMISSIONS.MANAGE_TEAM);
  if (isTrueAdmin) {
    return true;
  }
  
  // All other users need WRITE_JOB_MEDIA or WRITE_JOB_NOTES permission AND must be assigned to the job
  const hasMediaPermission = userContext.permissions.includes(PERMISSIONS.WRITE_JOB_MEDIA) ||
                              userContext.permissions.includes(PERMISSIONS.WRITE_JOB_NOTES);
  
  if (!hasMediaPermission) {
    return false;
  }
  
  // Check if assigned to this job
  try {
    const job = await storage.getJob(jobId, userContext.effectiveUserId);
    if (!job) {
      return false;
    }
    // Check both userId and teamMemberId for assignment
    const isAssigned = job.assignedTo === userContext.userId ||
                       (userContext.teamMemberId && job.assignedTo === userContext.teamMemberId);
    return isAssigned;
  } catch (error) {
    console.error('Error checking job write access:', error);
    return false;
  }
}

/**
 * Helper to check if user is assigned to a job (for staff assignment validation)
 */
export async function isUserAssignedToJob(userId: string, jobId: string, effectiveUserId: string): Promise<boolean> {
  try {
    const job = await storage.getJob(jobId, effectiveUserId);
    if (!job) {
      return false;
    }
    return job.assignedTo === userId;
  } catch (error) {
    console.error('Error checking job assignment:', error);
    return false;
  }
}

/**
 * Role hierarchy for job assignments:
 * - OWNER/ADMIN: Can assign to MANAGER, SUPERVISOR, WORKER, STAFF
 * - MANAGER: Can only assign to WORKER, STAFF (not to other managers or admins)
 * - SUPERVISOR: Can only assign to WORKER, STAFF
 * - WORKER/STAFF: Cannot assign jobs
 */
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  'OWNER': ['ADMIN', 'MANAGER', 'SUPERVISOR', 'WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'ADMIN': ['MANAGER', 'SUPERVISOR', 'WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'MANAGER': ['WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'SUPERVISOR': ['WORKER', 'STAFF', 'TECHNICIAN', 'TRADESMAN', 'APPRENTICE'],
  'WORKER': [],
  'STAFF': [],
};

/**
 * Maps various role names to their category for RBAC matching
 */
function normalizeRoleName(roleName: string): string {
  const upperName = roleName.toUpperCase();
  
  // Map common tradie role names to categories
  if (['TECHNICIAN', 'TRADESMAN', 'APPRENTICE', 'WORKER', 'STAFF', 'LABOURER', 'ASSISTANT'].includes(upperName)) {
    return upperName;
  }
  if (['ADMINISTRATOR', 'ADMIN'].includes(upperName)) {
    return 'ADMIN';
  }
  if (['MANAGER', 'SUPERVISOR', 'FOREMAN', 'LEAD'].includes(upperName)) {
    return upperName;
  }
  
  return upperName;
}

/**
 * Determines a user's effective role based on their permissions
 */
export function getEffectiveRole(userContext: UserContext): string {
  if (userContext.isOwner) return 'OWNER';
  
  const perms = userContext.permissions;
  const hasAll = perms.includes('*' as Permission);
  
  // Wildcard permission means Admin (full access except owner-specific)
  if (hasAll) return 'ADMIN';
  
  // Check for Admin (has MANAGE_TEAM)
  if (perms.includes(PERMISSIONS.MANAGE_TEAM)) return 'ADMIN';
  
  // Check for Manager (has ASSIGN_JOBS + quotes/invoices write)
  if (perms.includes(PERMISSIONS.ASSIGN_JOBS) && 
      perms.includes(PERMISSIONS.WRITE_QUOTES) && 
      perms.includes(PERMISSIONS.WRITE_INVOICES)) return 'MANAGER';
  
  // Check for Supervisor (has VIEW_ALL but not MANAGE_TEAM)
  if (perms.includes(PERMISSIONS.VIEW_ALL)) return 'SUPERVISOR';
  
  // Default to Worker/Staff
  return 'WORKER';
}

/**
 * Validates if a user can assign a job to a target team member
 * 
 * Assignment rules:
 * - Owner can assign to anyone (managers, supervisors, workers)
 * - Manager can only assign to workers (not to other managers or owner)
 * - Workers cannot assign jobs
 * 
 * @returns { allowed: boolean, reason?: string }
 */
export async function canAssignJobTo(
  assignerContext: UserContext, 
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // First check if user has ASSIGN_JOBS permission or is owner (handles wildcard *)
  if (!hasPermission(assignerContext, PERMISSIONS.ASSIGN_JOBS)) {
    return { allowed: false, reason: 'You do not have permission to assign jobs' };
  }
  
  const assignerRole = getEffectiveRole(assignerContext);
  const allowedTargetRoles = ASSIGNABLE_ROLES[assignerRole] || [];
  
  // Owner can assign to anyone
  if (assignerContext.isOwner) {
    return { allowed: true };
  }
  
  // Check if target is the business owner - admins/managers cannot assign to the owner
  // But owner can still assign to themselves via the PATCH /api/jobs route (different flow)
  if (targetUserId === assignerContext.businessOwnerId || targetUserId === assignerContext.effectiveUserId) {
    // Non-owners cannot assign to the business owner
    return { allowed: false, reason: 'You cannot assign jobs to the business owner' };
  }
  
  // Get target user's role
  const targetMembership = await storage.getTeamMembershipByMemberId(targetUserId);
  if (!targetMembership) {
    return { allowed: false, reason: 'Target user is not a team member' };
  }
  
  // Get target's role and normalize it for matching
  const targetRole = await storage.getUserRole(targetMembership.roleId);
  const targetRoleName = normalizeRoleName(targetRole?.name || 'STAFF');
  
  if (allowedTargetRoles.includes(targetRoleName)) {
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    reason: `${assignerRole}s can only assign jobs to workers and staff members` 
  };
}

/**
 * Sanitizes client data based on user permissions
 * Removes sensitive fields (email, phone, address, etc.) for users without READ_CLIENTS_SENSITIVE
 */
export function sanitizeClientData(client: any, userContext: UserContext): any {
  // Owners always get full access
  if (userContext.isOwner) return client;
  
  // Wildcard permission grants full access
  if (userContext.permissions.includes('*' as Permission)) {
    // But still check if they have READ_CLIENTS_SENSITIVE explicitly
    if (!userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE)) {
      // Admins with wildcard but no explicit sensitive permission still get masked data
      return maskSensitiveClientFields(client);
    }
    return client;
  }
  
  // Users with READ_CLIENTS_SENSITIVE get full access
  if (userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE)) {
    return client;
  }
  
  return maskSensitiveClientFields(client);
}

/**
 * Masks sensitive fields in client data
 */
function maskSensitiveClientFields(client: any): any {
  const { 
    email, phone, mobile, 
    address, addressLine2, suburb, postcode, state, country,
    ...safeClient 
  } = client;
  
  return {
    ...safeClient,
    // Mask sensitive contact data
    email: email ? '***@***.com' : null,
    phone: phone ? '*** *** ***' : null,
    mobile: mobile ? '*** *** ***' : null,
    // Mask full address components
    address: address ? '(Address hidden)' : null,
    addressLine2: addressLine2 ? '(Hidden)' : null,
    suburb: suburb ? '***' : null,
    postcode: postcode ? '****' : null,
    state: state || null,
    country: country || null,
  };
}

/**
 * Checks if user can view sensitive client data
 */
export function canViewClientSensitiveData(userContext: UserContext): boolean {
  return userContext.isOwner || userContext.permissions.includes(PERMISSIONS.READ_CLIENTS_SENSITIVE);
}
