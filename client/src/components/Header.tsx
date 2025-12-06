import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationDropdown from "@/components/NotificationDropdown";
import { 
  Search, 
  Sun, 
  Moon,
  Plus,
  Map
} from "lucide-react";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import appIconUrl from '@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
}

export default function Header({ 
  title,
  showSearch = true,
  showAddButton = false,
  addButtonText = "Add",
  onAddClick,
  onThemeToggle,
  isDarkMode = false,
  onProfileClick,
  onSettingsClick,
  onLogoutClick
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { isOwner, isManager } = useAppMode();
  const canViewMap = isOwner || isManager;
  
  // Add keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <header 
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 relative z-[20]"
      style={{ borderBottom: '2px solid hsl(var(--trade) / 0.3)' }}
    >
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* SidebarTrigger - shown on both mobile and desktop */}
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          
          {/* TradieTrack branding */}
          <div className="flex items-center gap-2">
            <img 
              src={appIconUrl} 
              alt="TradieTrack" 
              className="h-8 w-8 object-contain"
              data-testid="img-header-logo"
            />
            <span 
              className="text-base sm:text-xl font-bold"
              style={{ color: 'hsl(var(--trade))' }}
              data-testid="header-brand"
            >
              TradieTrack
            </span>
          </div>
          
          {title && (
            <h1 className="text-xl font-semibold hidden md:block" data-testid="header-title">
              {title}
            </h1>
          )}
        </div>

      <div className="flex items-center gap-3">
        {showSearch && (
          <>
            <Button
              variant="ghost"
              className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground px-3"
              onClick={() => setSearchOpen(true)}
              data-testid="button-open-search"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setSearchOpen(true)}
              data-testid="button-open-search-mobile"
            >
              <Search className="h-4 w-4" />
            </Button>
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          </>
        )}

        {canViewMap && (
          <Button
            variant={location === '/map' ? "default" : "outline"}
            size="sm"
            onClick={() => setLocation('/map')}
            className="hidden sm:flex items-center gap-2"
            data-testid="button-header-map"
            style={location === '/map' ? {
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade))'
            } : {}}
          >
            <Map className="h-4 w-4" />
            <span className="hidden md:inline">Job Map</span>
          </Button>
        )}

        {showAddButton && (
          <Button 
            onClick={onAddClick}
            data-testid="button-add-primary"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              color: 'white',
              borderColor: 'hsl(var(--trade))'
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {addButtonText}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onThemeToggle}
          data-testid="button-theme-toggle"
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback>M</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Mike's Plumbing</p>
                <p className="text-xs text-muted-foreground">mike@mikesplumbing.com.au</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfileClick} data-testid="menu-profile">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettingsClick} data-testid="menu-settings">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogoutClick} data-testid="menu-logout">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}