import { Feather } from '@expo/vector-icons';

export type UserRole = 'owner' | 'solo_owner' | 'manager' | 'staff_tradie' | 'staff';

export interface NavItem {
  title: string;
  url: string;
  icon: keyof typeof Feather.glyphMap;
  description?: string;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'destructive';
  bgColor?: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'destructive';
  requiresTeam?: boolean;
  requiresOwnerOrManager?: boolean;
  requiresPlatformAdmin?: boolean;
  hideForTradie?: boolean;
  hideForStaff?: boolean;
  allowedRoles?: UserRole[];
  showInBottomNav?: boolean;
  showInMore?: boolean;
  showBadge?: boolean;
  badge?: string;
  category?: 'work' | 'money' | 'team' | 'automations' | 'communication' | 'settings' | 'legal' | 'account' | 'featured' | 'admin';
}

export const mainMenuItems: NavItem[] = [
  {
    title: "AI Assistant",
    url: "/more/ai-assistant",
    icon: "star",
    description: "Get smart business suggestions",
    color: "warning",
    bgColor: "warning",
    badge: "New",
    showInMore: true,
    category: "featured",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Documents",
    url: "/more/documents",
    icon: "folder",
    description: "Quotes, invoices, and receipts",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Clients",
    url: "/more/clients",
    icon: "users",
    description: "Manage your customers",
    color: "info",
    bgColor: "info",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Schedule",
    url: "/more/calendar",
    icon: "calendar",
    description: "Calendar and appointments",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Time Tracking",
    url: "/more/time-tracking",
    icon: "clock",
    description: "Track work hours and timesheets",
    color: "warning",
    bgColor: "warning",
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Custom Forms",
    url: "/more/custom-forms",
    icon: "clipboard",
    description: "Create form templates for jobs",
    color: "success",
    bgColor: "success",
    badge: "Popular",
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Reports",
    url: "/more/reports",
    icon: "bar-chart-2",
    description: "Business analytics and insights",
    color: "info",
    bgColor: "info",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Money Hub",
    url: "/more/money-hub",
    icon: "dollar-sign",
    description: "Invoices, quotes & payments",
    color: "success",
    bgColor: "success",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Quotes",
    url: "/more/quotes",
    icon: "file-text",
    description: "Create and manage quotes",
    color: "info",
    bgColor: "info",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Invoices",
    url: "/more/invoices",
    icon: "file-text",
    description: "Send and track invoices",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Collect Payment",
    url: "/(tabs)/collect",
    icon: "credit-card",
    description: "Tap to Pay, QR codes, links",
    color: "success",
    bgColor: "success",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Expense Tracking",
    url: "/more/expense-tracking",
    icon: "file-minus",
    description: "Monitor business expenses",
    color: "destructive",
    bgColor: "destructive",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Document Templates",
    url: "/more/templates",
    icon: "file",
    description: "Quote and invoice templates",
    color: "muted",
    bgColor: "muted",
    hideForStaff: true,
    showInMore: true,
    category: "money",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Business Templates",
    url: "/more/business-templates",
    icon: "mail",
    description: "Email, SMS, terms & conditions",
    color: "info",
    bgColor: "info",
    hideForStaff: true,
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Team Hub",
    url: "/more/team-hub",
    icon: "activity",
    description: "Live team status, map, and activity",
    color: "success",
    bgColor: "success",
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Manage Team",
    url: "/more/team-management",
    icon: "user-plus",
    description: "Manage team members and roles",
    color: "primary",
    bgColor: "primary",
    requiresTeam: false,
    requiresOwnerOrManager: false,
    hideForStaff: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Dispatch Board",
    url: "/more/dispatch-board",
    icon: "layout",
    description: "Schedule and assign jobs",
    color: "info",
    bgColor: "info",
    requiresTeam: true,
    showInMore: true,
    category: "team",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Map",
    url: "/(tabs)/map",
    icon: "map-pin",
    description: "View jobs and team on map",
    color: "success",
    bgColor: "success",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInMore: true,
    category: "work",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Workflow Automations",
    url: "/more/automations",
    icon: "zap",
    description: "Set up automatic workflows",
    color: "warning",
    bgColor: "warning",
    badge: "New",
    hideForStaff: true,
    showInMore: true,
    category: "automations",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Chat Hub",
    url: "/more/chat-hub",
    icon: "message-circle",
    description: "All your conversations",
    color: "primary",
    bgColor: "primary",
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Team Chat",
    url: "/more/team-chat",
    icon: "users",
    description: "Chat with your team",
    color: "info",
    bgColor: "info",
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Direct Messages",
    url: "/more/direct-messages",
    icon: "send",
    description: "Private conversations",
    color: "success",
    bgColor: "success",
    showInMore: true,
    category: "communication",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
];

export const settingsMenuItems: NavItem[] = [
  {
    title: "Business Settings",
    url: "/more/business-settings",
    icon: "briefcase",
    description: "Logo, ABN, and company details",
    color: "primary",
    bgColor: "primary",
    hideForStaff: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Branding",
    url: "/more/branding",
    icon: "droplet",
    description: "Colors and visual identity",
    color: "info",
    bgColor: "info",
    hideForStaff: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Integrations",
    url: "/more/integrations",
    icon: "link",
    description: "Connect external services",
    color: "warning",
    bgColor: "warning",
    hideForStaff: true,
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Notifications",
    url: "/more/notifications",
    icon: "bell",
    description: "Push and email preferences",
    color: "destructive",
    bgColor: "destructive",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "App Settings",
    url: "/more/app-settings",
    icon: "settings",
    description: "Theme and preferences",
    color: "muted",
    bgColor: "muted",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Help & Support",
    url: "/more/support",
    icon: "help-circle",
    description: "FAQs, guides, and contact us",
    color: "info",
    bgColor: "info",
    showInMore: true,
    category: "settings",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
];

export const legalMenuItems: NavItem[] = [
  {
    title: "Privacy Policy",
    url: "/more/privacy-policy",
    icon: "shield",
    description: "How we protect your data",
    color: "success",
    bgColor: "success",
    showInMore: true,
    category: "legal",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
  {
    title: "Terms of Service",
    url: "/more/terms-of-service",
    icon: "file-text",
    description: "Terms and conditions",
    color: "muted",
    bgColor: "muted",
    showInMore: true,
    category: "legal",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
];

export const accountMenuItems: NavItem[] = [
  {
    title: "Subscription",
    url: "/more/subscription",
    icon: "star",
    description: "Free During Beta",
    color: "warning",
    bgColor: "warning",
    badge: "Beta",
    hideForStaff: true,
    showInMore: true,
    category: "account",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Delete Account",
    url: "/more/delete-account",
    icon: "trash-2",
    description: "Permanently delete your account",
    color: "destructive",
    bgColor: "destructive",
    showInMore: true,
    category: "account",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
];

export const adminMenuItems: NavItem[] = [
  {
    title: "Admin Dashboard",
    url: "/more/admin",
    icon: "shield",
    description: "Platform management",
    color: "destructive",
    bgColor: "destructive",
    requiresPlatformAdmin: true,
    showInMore: true,
    category: "admin",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie', 'staff'],
  },
];

export const moreNavItem: NavItem = {
  title: "More",
  url: "/more",
  icon: "more-horizontal",
  showInBottomNav: true,
};

export interface FilterOptions {
  isTeam: boolean;
  isTradie: boolean;
  isOwner: boolean;
  isManager: boolean;
  isSolo: boolean;
  userRole?: UserRole;
  isPlatformAdmin?: boolean;
}

export function filterNavItems(items: NavItem[], options: FilterOptions): NavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = options.isTradie && !isOwnerOrManager;
  
  return items.filter(item => {
    // Platform admin only items
    if (item.requiresPlatformAdmin && !options.isPlatformAdmin) {
      return false;
    }
    
    // Use allowedRoles if specified (new permission system)
    // Match web's filtering logic from client/src/lib/navigation-config.ts
    if (item.allowedRoles && options.userRole) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    // Hide from staff tradies (staff who are not owners/managers)
    if (item.hideForStaff && isStaffTradie) {
      return false;
    }
    
    // Legacy checks for backwards compatibility
    if (item.requiresTeam && !options.isTeam) {
      return false;
    }
    if (item.requiresOwnerOrManager && !isOwnerOrManager) {
      return false;
    }
    if (item.hideForTradie && isStaffTradie) {
      return false;
    }
    
    return true;
  });
}

export function getBottomNavItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(mainMenuItems, options);
  const bottomItems = filtered.filter(item => item.showInBottomNav);
  return [...bottomItems, moreNavItem];
}

export function getMorePageItems(options: FilterOptions): NavItem[] {
  const allItems = [...mainMenuItems, ...settingsMenuItems, ...legalMenuItems, ...accountMenuItems, ...adminMenuItems];
  const filtered = filterNavItems(allItems, options);
  return filtered.filter(item => item.showInMore);
}

export function getMorePageItemsByCategory(options: FilterOptions): Record<string, NavItem[]> {
  const items = getMorePageItems(options);
  const categories: Record<string, NavItem[]> = {
    featured: [],
    work: [],
    money: [],
    team: [],
    automations: [],
    communication: [],
    settings: [],
    legal: [],
    account: [],
    admin: [],
  };
  
  items.forEach(item => {
    const category = item.category || 'work';
    if (categories[category]) {
      categories[category].push(item);
    }
  });
  
  return categories;
}

export const categoryLabels: Record<string, string> = {
  featured: '',
  work: 'Work',
  money: 'Money Hub',
  team: 'Team',
  automations: 'Automations',
  communication: 'Communication',
  settings: 'Settings',
  legal: 'Legal',
  account: 'Account',
  admin: 'Platform Admin',
};

export const categoryOrder = [
  'featured',
  'work', 
  'money',
  'team',
  'automations',
  'communication',
  'settings',
  'legal',
  'account',
  'admin',
];

export interface SidebarNavItem {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  path: string;
  matchPaths?: string[];
  section: 'main' | 'settings';
}

export const sidebarMainItems: SidebarNavItem[] = [
  { 
    id: 'dashboard',
    title: 'Dashboard', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index'],
    section: 'main',
  },
  { 
    id: 'work',
    title: 'Jobs', 
    icon: 'briefcase', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job'],
    section: 'main',
  },
  { 
    id: 'chat',
    title: 'Chat', 
    icon: 'message-circle', 
    path: '/more/chat-hub',
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'],
    section: 'main',
  },
  { 
    id: 'map',
    title: 'Map', 
    icon: 'map-pin', 
    path: '/map',
    matchPaths: ['/map'],
    section: 'main',
  },
  { 
    id: 'money',
    title: 'Money', 
    icon: 'dollar-sign', 
    path: '/money',
    matchPaths: ['/money', '/more/invoices', '/more/quotes', '/more/money-hub'],
    section: 'main',
  },
  { 
    id: 'clients',
    title: 'Clients', 
    icon: 'users', 
    path: '/more/clients',
    matchPaths: ['/more/clients', '/more/client'],
    section: 'main',
  },
  { 
    id: 'calendar',
    title: 'Schedule', 
    icon: 'calendar', 
    path: '/more/calendar',
    matchPaths: ['/more/calendar'],
    section: 'main',
  },
  { 
    id: 'reports',
    title: 'Reports', 
    icon: 'bar-chart-2', 
    path: '/more/reports',
    matchPaths: ['/more/reports'],
    section: 'main',
  },
];

export const sidebarSettingsItems: SidebarNavItem[] = [
  { 
    id: 'team',
    title: 'Team', 
    icon: 'user-plus', 
    path: '/more/team-management',
    matchPaths: ['/more/team-management', '/more/team'],
    section: 'settings',
  },
  { 
    id: 'integrations',
    title: 'Integrations', 
    icon: 'link', 
    path: '/more/integrations',
    matchPaths: ['/more/integrations'],
    section: 'settings',
  },
  { 
    id: 'settings',
    title: 'Settings', 
    icon: 'settings', 
    path: '/more/business-settings',
    matchPaths: ['/more/settings', '/more/business-settings', '/more/app-settings', '/more/branding'],
    section: 'settings',
  },
];

export function isSidebarPathActive(pathname: string, item: SidebarNavItem): boolean {
  const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'];
  const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
  
  if (isChatRoute && item.id === 'chat') {
    return true;
  }
  if (isChatRoute && item.id !== 'chat') {
    return false;
  }
  
  if (item.matchPaths) {
    return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  }
  return pathname === item.path;
}
