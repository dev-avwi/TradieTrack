import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LogOut, User, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useAppMode } from "@/hooks/use-app-mode";
import { 
  getSidebarMenuItems, 
  getSidebarSettingsItems,
  type NavItem 
} from "@/lib/navigation-config";
import appIconUrl from '@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png';

interface AppSidebarProps {
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}

export default function AppSidebar({ onLogout, onNavigate }: AppSidebarProps) {
  const [location] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { isTeam, isTradie, isOwner, isManager, userRole } = useAppMode();

  const filterOptions = { isTeam, isTradie, isOwner, isManager, userRole };
  const visibleMenuItems = getSidebarMenuItems(filterOptions);
  const visibleSettingsItems = getSidebarSettingsItems(filterOptions);

  const businessName = businessSettings?.businessName || 'TradieTrack';
  const initials = businessName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          {businessSettings?.logoUrl ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img 
                src={businessSettings.logoUrl} 
                alt="Business logo" 
                className="w-full h-full object-contain"
                data-testid="img-business-logo"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-blue-500/10 rounded-lg"></div>
              <img 
                src={appIconUrl} 
                alt="TradieTrack" 
                className="w-full h-full object-contain relative z-10"
                data-testid="img-tradietrack-icon"
              />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg" data-testid="text-business-name">
              {businessName}
            </h1>
            <p className="text-xs text-muted-foreground">Job Management</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item: NavItem) => {
                const isActive = location === item.url;
                const Icon = item.icon || LayoutDashboard;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={isActive}
                      data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => onNavigate?.(item.url)}
                      className={isActive ? 'text-white' : ''}
                      style={isActive ? { 
                        backgroundColor: 'hsl(var(--trade))', 
                        color: 'white',

                      } : {}}
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

        {visibleSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSettingsItems.map((item: NavItem) => {
                  const isActive = location === item.url;
                  const Icon = item.icon || LayoutDashboard;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => onNavigate?.(item.url)}
                        className={isActive ? 'text-white' : ''}
                        style={isActive ? { 
                          backgroundColor: 'hsl(var(--trade))', 
                          color: 'white',

                        } : {}}
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
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="space-y-2">
          <div 
            className="flex items-center gap-3 p-2 rounded-lg border"
            style={{ 
              backgroundColor: 'hsl(var(--trade) / 0.08)', 
              borderColor: 'hsl(var(--trade) / 0.2)' 
            }}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={businessSettings?.logoUrl || ''} />
              <AvatarFallback>{initials || <User className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-footer-business-name">
                {businessName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {businessSettings?.subscriptionTier === 'pro' ? 'Pro Plan' : 'Free Plan'}
              </p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
