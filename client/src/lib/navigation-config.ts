import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  Settings,
  Zap,
  Clock,
  UserPlus,
  BarChart3,
  MessageCircle,
  Map,
  Home,
  MoreHorizontal,
  LayoutGrid,
  Smartphone,
  UserCircle,
  Wallet,
  ClipboardList,
  Files,
  type LucideIcon
} from "lucide-react";

import { type UserRole } from "./permissions";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  description?: string;
  color?: string;
  bgColor?: string;
  requiresTeam?: boolean;
  requiresOwnerOrManager?: boolean;
  hideForTradie?: boolean;
  hideForStaff?: boolean;  // Hide from staff tradies completely
  allowedRoles?: UserRole[];  // Explicit role whitelist
  showInBottomNav?: boolean;
  showInSidebar?: boolean;
  showInMore?: boolean;
  showBadge?: boolean;
}

export const mainMenuItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    description: "Overview of your business",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Work",
    url: "/work",
    icon: Briefcase,
    description: "Manage your jobs and work",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    description: "Manage your customers",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Quotes",
    url: "/quotes",
    icon: FileText,
    description: "Create and manage customer quotes",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    showInBottomNav: false,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: Receipt,
    description: "Send and track invoices",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    showInBottomNav: false,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Payment Hub",
    url: "/payment-hub",
    icon: Wallet,
    description: "Track invoices, payments, and quotes",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Schedule",
    url: "/schedule",
    icon: Calendar,
    description: "Calendar and dispatch board",
    color: "text-success",
    bgColor: "bg-success/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Time Tracking",
    url: "/time-tracking",
    icon: Clock,
    description: "Track work hours and manage timesheets",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Team",
    url: "/team",
    icon: UserPlus,
    description: "Manage team members and roles",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    description: "Team and job messaging",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    showBadge: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Map",
    url: "/map",
    icon: Map,
    description: "View jobs and team on map",
    color: "text-success",
    bgColor: "bg-success/10",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInBottomNav: false,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    description: "Business reports and analytics",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Collect Payment",
    url: "/collect-payment",
    icon: Smartphone,
    description: "Get paid on-site with Tap to Pay",
    color: "text-success",
    bgColor: "bg-success/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Templates",
    url: "/templates",
    icon: Files,
    description: "Manage email, SMS, and document templates",
    color: "text-primary",
    bgColor: "bg-primary/10",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
];

export const settingsMenuItems: NavItem[] = [
  {
    title: "Integrations",
    url: "/integrations",
    icon: Zap,
    description: "Connect Stripe & SendGrid",
    color: "text-warning",
    bgColor: "bg-warning/10",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Business details and preferences",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
];

export const moreNavItem: NavItem = {
  title: "More",
  url: "/more",
  icon: MoreHorizontal,
  showInBottomNav: true,
};

export interface FilterOptions {
  isTeam: boolean;
  isTradie: boolean;
  isOwner: boolean;
  isManager: boolean;
  userRole?: UserRole;
}

export function filterNavItems(items: NavItem[], options: FilterOptions): NavItem[] {
  const isOwnerOrManager = options.isOwner || options.isManager;
  const isStaffTradie = options.isTradie && !isOwnerOrManager;
  
  return items.filter(item => {
    // Use allowedRoles if specified (new permission system)
    if (item.allowedRoles && options.userRole) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    // Hide from staff tradies
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

export function getSidebarMenuItems(options: FilterOptions): NavItem[] {
  const filtered = filterNavItems(mainMenuItems, options);
  return filtered.filter(item => item.showInSidebar);
}

export function getSidebarSettingsItems(options: FilterOptions): NavItem[] {
  return filterNavItems(settingsMenuItems, options);
}

export function getMorePageItems(options: FilterOptions): NavItem[] {
  const allItems = [...mainMenuItems, ...settingsMenuItems];
  const filtered = filterNavItems(allItems, options);
  return filtered.filter(item => item.showInMore);
}

export function getMorePagesPattern(): RegExp {
  const allItems = [...mainMenuItems, ...settingsMenuItems];
  const morePaths = allItems
    .filter(item => item.showInMore)
    .map(item => item.url.replace('/', ''))
    .filter(Boolean);
  return new RegExp(`^\\/(${morePaths.join('|')})`);
}
