// Frontend permissions configuration
// Mirrors backend server/permissions.ts for consistent access control

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
  MANAGE_AUTOMATIONS: 'manage_automations',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  VIEW_MAP: 'view_map',
  ACCESS_DISPATCH: 'access_dispatch',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role types for the UI
export type UserRole = 'owner' | 'solo_owner' | 'manager' | 'staff_tradie';

// Page access configuration - which pages each role can access
export interface PagePermission {
  path: string;
  label: string;
  allowedRoles: UserRole[];
  requiredPermissions?: Permission[];
  showInNav?: boolean;
}

// Define page-level access control
export const PAGE_PERMISSIONS: PagePermission[] = [
  // Always accessible
  { path: '/', label: 'Dashboard', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  { path: '/profile', label: 'Profile', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  { path: '/my-account', label: 'My Account', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Work - unified job view for all roles
  { path: '/work', label: 'Work', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Jobs - all roles can see, but staff only sees assigned
  { path: '/jobs', label: 'Jobs', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  { path: '/jobs/new', label: 'New Job', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/jobs/:id', label: 'Job Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  
  // Clients - staff can only view (not in nav for staff)
  { path: '/clients', label: 'Clients', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/clients/new', label: 'New Client', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/clients/:id', label: 'Client Details', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  
  // Documents Hub - unified view for quotes, invoices, and receipts
  { path: '/documents', label: 'Documents', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Quotes - not for staff
  { path: '/quotes', label: 'Quotes', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/quotes/new', label: 'New Quote', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/quotes/:id', label: 'Quote Details', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/quote-editor/:id', label: 'Quote Editor', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Invoices - not for staff
  { path: '/invoices', label: 'Invoices', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/invoices/new', label: 'New Invoice', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/invoices/:id', label: 'Invoice Details', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/invoice-editor/:id', label: 'Invoice Editor', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Receipts - not for staff
  { path: '/receipts/:id', label: 'Receipt Details', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Calendar/Schedule - staff sees only their assigned jobs
  { path: '/calendar', label: 'Calendar', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  { path: '/schedule', label: 'Schedule', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Dispatch - owner/manager only
  { path: '/dispatch', label: 'Dispatch', allowedRoles: ['owner', 'manager'], showInNav: true },
  
  // Time Tracking - all roles
  { path: '/time-tracking', label: 'Time Tracking', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  
  // Team - owner/solo_owner/manager (solo owners can invite first team member)
  { path: '/team', label: 'Team', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  { path: '/team/invite', label: 'Invite Team', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  { path: '/team-dashboard', label: 'Team Hub', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  
  // Chat - all roles including solo owners for SMS conversations
  { path: '/chat', label: 'Chat', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
  { path: '/team-chat', label: 'Team Chat', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: false },
  
  // Map - owner/solo_owner/manager (solo owners can view job locations)
  { path: '/map', label: 'Map', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Reports - owner/manager only
  { path: '/reports', label: 'Reports', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Collect Payment - owner/manager only
  { path: '/collect-payment', label: 'Collect Payment', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Payment Hub - owner/manager only
  { path: '/payment-hub', label: 'Payment Hub', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Automations - owner only
  { path: '/automations', label: 'Automations', allowedRoles: ['owner', 'solo_owner'], showInNav: true },
  
  // Custom Forms - owner/manager only (redirects to /templates)
  { path: '/custom-forms', label: 'Forms', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: false },
  
  // Templates Hub - owner/manager only
  { path: '/templates', label: 'Templates', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Integrations - owner only
  { path: '/integrations', label: 'Integrations', allowedRoles: ['owner', 'solo_owner'], showInNav: true },
  
  // Settings - owner/solo full, manager limited, staff profile only
  { path: '/settings', label: 'Settings', allowedRoles: ['owner', 'solo_owner', 'manager'], showInNav: true },
  
  // Billing - owner only
  { path: '/billing', label: 'Billing', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  { path: '/payouts', label: 'Payouts', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  { path: '/stripe-connect', label: 'Stripe Connect', allowedRoles: ['owner', 'solo_owner'], showInNav: false },
  
  // More page - all roles
  { path: '/more', label: 'More', allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'], showInNav: true },
];

// Check if a role can access a specific path
export function canAccessPath(role: UserRole, path: string): boolean {
  // Normalize path - remove trailing slashes BUT preserve root path "/"
  let normalizedPath = path.replace(/\/$/, '');
  if (normalizedPath === '') {
    normalizedPath = '/';
  }
  
  // Find matching permission entry
  const permission = PAGE_PERMISSIONS.find(p => {
    // Handle exact match
    if (p.path === normalizedPath) return true;
    
    // Handle dynamic routes like /jobs/:id
    const pattern = p.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(normalizedPath);
  });
  
  // If no permission defined, deny access by default
  if (!permission) {
    // Allow public routes
    if (['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding', '/privacy', '/terms'].some(p => normalizedPath.startsWith(p))) {
      return true;
    }
    return false;
  }
  
  return permission.allowedRoles.includes(role);
}

// Get navigation items filtered by role
export function getNavItemsForRole(role: UserRole, isTeam: boolean): PagePermission[] {
  return PAGE_PERMISSIONS.filter(p => {
    if (!p.showInNav) return false;
    if (!p.allowedRoles.includes(role)) return false;
    
    // Hide team-specific items for solo users (but keep /team for upgrading)
    if (!isTeam && ['/chat', '/map', '/dispatch'].includes(p.path)) {
      return false;
    }
    
    return true;
  });
}

// Action permissions - what actions each role can perform
export interface ActionPermissions {
  canCreateJobs: boolean;
  canEditJobs: boolean;
  canDeleteJobs: boolean;
  canAssignJobs: boolean;
  canCreateClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canCreateQuotes: boolean;
  canEditQuotes: boolean;
  canDeleteQuotes: boolean;
  canSendQuotes: boolean;
  canCreateInvoices: boolean;
  canEditInvoices: boolean;
  canDeleteInvoices: boolean;
  canSendInvoices: boolean;
  canManageTeam: boolean;
  canInviteTeam: boolean;
  canRemoveTeam: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canManageTemplates: boolean;
  canManageAutomations: boolean;
  canManageIntegrations: boolean;
  canViewAllJobs: boolean;
  canViewReports: boolean;
  canViewMap: boolean;
  canUseDispatch: boolean;
}

// Get action permissions for a role
export function getActionPermissions(role: UserRole): ActionPermissions {
  switch (role) {
    case 'owner':
    case 'solo_owner':
      return {
        canCreateJobs: true,
        canEditJobs: true,
        canDeleteJobs: true,
        canAssignJobs: true,
        canCreateClients: true,
        canEditClients: true,
        canDeleteClients: true,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: true,
        canSendQuotes: true,
        canCreateInvoices: true,
        canEditInvoices: true,
        canDeleteInvoices: true,
        canSendInvoices: true,
        canManageTeam: true,
        canInviteTeam: true,
        canRemoveTeam: true,
        canManageSettings: true,
        canManageBilling: true,
        canManageTemplates: true,
        canManageAutomations: true,
        canManageIntegrations: true,
        canViewAllJobs: true,
        canViewReports: true,
        canViewMap: true,
        canUseDispatch: true,
      };
      
    case 'manager':
      return {
        canCreateJobs: true,
        canEditJobs: true,
        canDeleteJobs: false,
        canAssignJobs: true,
        canCreateClients: true,
        canEditClients: true,
        canDeleteClients: false,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: false,
        canSendQuotes: true,
        canCreateInvoices: true,
        canEditInvoices: true,
        canDeleteInvoices: false,
        canSendInvoices: true,
        canManageTeam: true,
        canInviteTeam: true,
        canRemoveTeam: false,
        canManageSettings: false,
        canManageBilling: false,
        canManageTemplates: false,
        canManageAutomations: false,
        canManageIntegrations: false,
        canViewAllJobs: true,
        canViewReports: true,
        canViewMap: true,
        canUseDispatch: true,
      };
      
    case 'staff_tradie':
      return {
        canCreateJobs: false,
        canEditJobs: false, // Can only update status on assigned jobs
        canDeleteJobs: false,
        canAssignJobs: false,
        canCreateClients: false,
        canEditClients: false,
        canDeleteClients: false,
        canCreateQuotes: false,
        canEditQuotes: false,
        canDeleteQuotes: false,
        canSendQuotes: false,
        canCreateInvoices: false,
        canEditInvoices: false,
        canDeleteInvoices: false,
        canSendInvoices: false,
        canManageTeam: false,
        canInviteTeam: false,
        canRemoveTeam: false,
        canManageSettings: false,
        canManageBilling: false,
        canManageTemplates: false,
        canManageAutomations: false,
        canManageIntegrations: false,
        canViewAllJobs: false,
        canViewReports: false,
        canViewMap: false,
        canUseDispatch: false,
      };
      
    default:
      // Default to staff permissions for safety
      return getActionPermissions('staff_tradie');
  }
}
