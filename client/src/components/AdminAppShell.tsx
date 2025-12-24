import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  LogOut,
  Shield,
  HeartPulse,
} from "lucide-react";
import appIconUrl from "@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png";

interface AdminAppShellProps {
  children: ReactNode;
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}

const adminNavItems = [
  {
    title: "Overview",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Platform Activity",
    url: "/admin/activity",
    icon: Activity,
  },
  {
    title: "System Health",
    url: "/admin/health",
    icon: HeartPulse,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
];

function AdminSidebar({
  onLogout,
  onNavigate,
}: {
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}) {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="admin-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <img
              src={appIconUrl}
              alt="TradieTrack Admin"
              className="w-full h-full object-contain"
              data-testid="img-admin-logo"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1
                className="font-bold text-base leading-none"
                data-testid="text-admin-title"
              >
                TradieTrack
              </h1>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 bg-slate-700 text-slate-100 border-slate-600"
                data-testid="badge-admin"
              >
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-none">
              Platform Management
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => {
                const isActive =
                  location === item.url ||
                  (item.url === "/admin" && location === "/admin/");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      data-testid={`admin-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => onNavigate?.(item.url)}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onLogout}
          data-testid="button-admin-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminAppShell({
  children,
  onLogout,
  onNavigate,
}: AdminAppShellProps) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AdminSidebar onLogout={onLogout} onNavigate={onNavigate} />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-20" style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)' }}>
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Admin Console
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="hidden sm:flex text-xs"
                data-testid="badge-admin-status"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                System Online
              </Badge>
            </div>
          </header>

          <main className="flex-1 overflow-auto" data-testid="admin-main-content">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
