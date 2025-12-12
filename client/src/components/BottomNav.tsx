import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { 
  getUnifiedNavItems, 
  type NavItem 
} from "@/lib/navigation-config";

interface UnreadCountsResponse {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  total: number;
}

interface BottomNavProps {
  onNavigate?: (path: string) => void;
}

export const BOTTOM_NAV_HEIGHT = 80;

export default function BottomNav({ onNavigate }: BottomNavProps) {
  const [location] = useLocation();
  const { isTeam, isTradie, isOwner, isManager, userRole } = useAppMode();
  const { openMobile, isMobile } = useSidebar();

  const navItems = getUnifiedNavItems({ isTeam, isTradie, isOwner, isManager, userRole });

  const isActiveRoute = (itemUrl: string) => {
    if (itemUrl === '/') {
      return location === '/';
    }
    if (itemUrl === '/money') {
      return location === '/money' || location.startsWith('/quotes') || location.startsWith('/invoices') || location === '/reports' || location === '/collect-payment';
    }
    if (itemUrl === '/settings') {
      return location === '/settings' || location.startsWith('/settings/') || location === '/integrations' || location === '/team' || location === '/my-account';
    }
    return location.startsWith(itemUrl);
  };
  
  if (isMobile && openMobile) {
    return null;
  }
  
  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-[55]"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitTapHighlightColor: 'transparent'
      }}
      data-testid="bottom-nav"
    >
      <div 
        className="mx-3 mb-2 rounded-2xl bg-background/95 backdrop-blur-lg shadow-lg"
        style={{ 
          border: '1px solid hsl(var(--border) / 0.5)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08), 0 -2px 8px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.filter(item => item.showInBottomNav).map((item: NavItem) => {
            const isActive = isActiveRoute(item.url);
            
            return (
              <Button
                key={item.title}
                variant="ghost"
                size="xl"
                className={`
                  flex flex-col items-center gap-1 h-auto py-2.5 px-4 rounded-xl
                  min-w-[60px] relative
                `}
                style={isActive ? {
                  backgroundColor: 'hsl(var(--trade) / 0.12)',
                } : {}}
                data-testid={`bottom-nav-${item.title.toLowerCase()}`}
                onClick={() => onNavigate?.(item.url)}
              >
                {isActive && (
                  <div 
                    className="absolute inset-0 rounded-xl"
                    style={{
                      backgroundColor: 'hsl(var(--trade) / 0.1)',
                    }}
                  />
                )}
                <div className="relative">
                  <item.icon 
                    className="h-6 w-6 relative z-10"
                    style={{ 
                      color: isActive ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))',
                      strokeWidth: isActive ? 2.5 : 2
                    }}
                  />
                </div>
                <span 
                  className={`text-[11px] relative z-10 ${isActive ? 'font-semibold' : 'font-medium'}`}
                  style={{ 
                    color: isActive ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  {item.title}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
