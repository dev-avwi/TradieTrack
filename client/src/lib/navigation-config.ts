import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  Settings,
  Zap,
  FileType,
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
  DollarSign,
  Sun,
  Palette,
  Bell,
  Mail,
  CreditCard,
  HelpCircle,
  Building2,
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
  hideForStaff?: boolean;
  allowedRoles?: UserRole[];
  showInBottomNav?: boolean;
  showInSidebar?: boolean;
  showInMore?: boolean;
  showBadge?: boolean;
}

// ============================================
// UNIFIED 5-TAB NAVIGATION SYSTEM
// Today | Jobs | Calendar | Money | Settings
// ============================================

// Primary navigation tabs (both sidebar and bottom nav)
export const unifiedNavItems: NavItem[] = [
  {
    title: "Today",
    url: "/",
    icon: Home,
    description: "Your command center - what to do now",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Jobs",
    url: "/jobs",
    icon: Briefcase,
    description: "Manage your jobs and work",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    description: "Schedule and track appointments",
    color: "text-success",
    bgColor: "bg-success/10",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Money",
    url: "/money",
    icon: DollarSign,
    description: "Quotes, invoices, payments & reports",
    color: "text-success",
    bgColor: "bg-success/10",
    showInBottomNav: true,
    showInSidebar: true,
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Business settings and preferences",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    showInBottomNav: true,
    showInSidebar: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
];

// Settings sub-pages (shown within Settings page)
export const settingsSubItems: NavItem[] = [
  {
    title: "Profile",
    url: "/settings/profile",
    icon: UserCircle,
    description: "Your personal profile",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Business",
    url: "/settings/business",
    icon: Building2,
    description: "Business details and ABN",
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Branding",
    url: "/settings/branding",
    icon: Palette,
    description: "Logo, colors, and themes",
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Team",
    url: "/settings/team",
    icon: UserPlus,
    description: "Manage team members and roles",
    requiresTeam: true,
    requiresOwnerOrManager: true,
    hideForStaff: true,
    allowedRoles: ['owner', 'manager'],
  },
  {
    title: "Automations",
    url: "/settings/automations",
    icon: Zap,
    description: "Auto-reminders and follow-ups",
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Integrations",
    url: "/settings/integrations",
    icon: Zap,
    description: "Email, SMS, Stripe, accounting",
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Plan & Billing",
    url: "/settings/billing",
    icon: CreditCard,
    description: "Your subscription and payments",
    hideForStaff: true,
    allowedRoles: ['owner', 'solo_owner'],
  },
  {
    title: "Help & Support",
    url: "/settings/help",
    icon: HelpCircle,
    description: "FAQ and contact support",
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
];

// Money Hub sub-sections (tabs within Money page)
export const moneySubItems: NavItem[] = [
  {
    title: "Quotes",
    url: "/money/quotes",
    icon: FileText,
    description: "Create and manage quotes",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Invoices",
    url: "/money/invoices",
    icon: Receipt,
    description: "Send and track invoices",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Payments",
    url: "/money/payments",
    icon: DollarSign,
    description: "View payment history",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Reports",
    url: "/money/reports",
    icon: BarChart3,
    description: "Business analytics and reports",
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
];

// ============================================
// LEGACY NAVIGATION (for backwards compatibility)
// Will be removed after full migration
// ============================================

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
    title: "Jobs",
    url: "/jobs",
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
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    description: "Schedule and track appointments",
    color: "text-success",
    bgColor: "bg-success/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
  {
    title: "Dispatch",
    url: "/dispatch",
    icon: LayoutGrid,
    description: "Dispatch board for scheduling team",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresTeam: true,
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'manager'],
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
    title: "Templates",
    url: "/templates",
    icon: FileType,
    description: "Quote and invoice templates",
    color: "text-info",
    bgColor: "bg-info/10",
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager'],
  },
  {
    title: "Team",
    url: "/team",
    icon: UserPlus,
    description: "Manage team members and roles",
    color: "text-success",
    bgColor: "bg-success/10",
    requiresTeam: true,
    requiresOwnerOrManager: true,
    hideForStaff: true,
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'manager'],
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    description: "Team and job messaging",
    color: "text-primary",
    bgColor: "bg-primary/10",
    requiresTeam: true,
    showInBottomNav: true,
    showInSidebar: true,
    showBadge: true,
    allowedRoles: ['owner', 'manager', 'staff_tradie'],
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
    showInBottomNav: true,
    showInSidebar: true,
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
];

export const settingsMenuItems: NavItem[] = [
  {
    title: "My Account",
    url: "/my-account",
    icon: UserCircle,
    description: "Your profile and permissions",
    color: "text-primary",
    bgColor: "bg-primary/10",
    showInSidebar: true,
    showInMore: true,
    allowedRoles: ['owner', 'solo_owner', 'manager', 'staff_tradie'],
  },
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
    if (item.allowedRoles && options.userRole) {
      if (!item.allowedRoles.includes(options.userRole)) {
        return false;
      }
    }
    
    if (item.hideForStaff && isStaffTradie) {
      return false;
    }
    
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

// ============================================
// UNIFIED NAVIGATION GETTERS
// ============================================

export function getUnifiedNavItems(options: FilterOptions): NavItem[] {
  return filterNavItems(unifiedNavItems, options);
}

export function getSettingsSubItems(options: FilterOptions): NavItem[] {
  return filterNavItems(settingsSubItems, options);
}

export function getMoneySubItems(options: FilterOptions): NavItem[] {
  return filterNavItems(moneySubItems, options);
}

// ============================================
// LEGACY NAVIGATION GETTERS (for backwards compatibility)
// ============================================

export function getBottomNavItems(options: FilterOptions): NavItem[] {
  // Use unified nav for bottom nav
  const filtered = filterNavItems(unifiedNavItems, options);
  return filtered.filter(item => item.showInBottomNav);
}

export function getSidebarMenuItems(options: FilterOptions): NavItem[] {
  // Use unified nav for sidebar
  return filterNavItems(unifiedNavItems, options).filter(item => item.showInSidebar);
}

export function getSidebarSettingsItems(options: FilterOptions): NavItem[] {
  // No separate settings section in unified nav - it's a tab
  return [];
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
