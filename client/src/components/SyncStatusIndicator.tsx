import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle,
  Check,
  Loader2
} from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { syncManager } from '@/lib/syncManager';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusIndicatorProps {
  compact?: boolean;
}

export default function SyncStatusIndicator({ compact = true }: SyncStatusIndicatorProps) {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync } = useNetwork();
  const [conflictsCount, setConflictsCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    const updateConflicts = () => {
      const conflicts = syncManager.getConflicts();
      setConflictsCount(conflicts.filter(c => !c.resolvedAt).length);
    };

    updateConflicts();

    const unsubscribe = syncManager.on('conflict', updateConflicts);
    const unsubscribeSyncComplete = syncManager.on('syncComplete', updateConflicts);

    return () => {
      unsubscribe();
      unsubscribeSyncComplete();
    };
  }, []);

  const handleSyncNow = async () => {
    if (!isOnline || isSyncing) return;
    await sync();
    setIsPopoverOpen(false);
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOff className="h-4 w-4 text-muted-foreground" />;
    }
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
    if (conflictsCount > 0) {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    if (pendingSyncCount > 0) {
      return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
    return <Cloud className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (conflictsCount > 0) return `${conflictsCount} conflict${conflictsCount > 1 ? 's' : ''}`;
    if (pendingSyncCount > 0) return `${pendingSyncCount} pending`;
    return 'Synced';
  };

  const getLastSyncText = () => {
    if (!lastSyncTime) return 'Never synced';
    return `Last synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`;
  };

  const showBadge = !isOnline || pendingSyncCount > 0 || conflictsCount > 0;
  const badgeCount = pendingSyncCount + conflictsCount;

  if (compact) {
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-sync-status"
          >
            {getStatusIcon()}
            {showBadge && badgeCount > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                data-testid="badge-sync-count"
              >
                {badgeCount > 9 ? '9+' : badgeCount}
              </Badge>
            )}
            {!isOnline && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
              {isOnline && !isSyncing && pendingSyncCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSyncNow}
                  data-testid="button-sync-now"
                >
                  Sync now
                </Button>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {getLastSyncText()}
            </div>

            {!isOnline && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <CloudOff className="h-3 w-3 flex-shrink-0" />
                <span>Changes will sync when you're back online</span>
              </div>
            )}

            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                <span>{pendingSyncCount} item{pendingSyncCount > 1 ? 's' : ''} waiting to sync</span>
              </div>
            )}

            {conflictsCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>{conflictsCount} conflict{conflictsCount > 1 ? 's' : ''} need resolution</span>
              </div>
            )}

            {isOnline && pendingSyncCount === 0 && conflictsCount === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                <Check className="h-3 w-3" />
                <span>All changes synced</span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50" data-testid="sync-status-expanded">
      {getStatusIcon()}
      <div className="flex flex-col">
        <span className="text-sm font-medium">{getStatusText()}</span>
        <span className="text-xs text-muted-foreground">{getLastSyncText()}</span>
      </div>
      {isOnline && !isSyncing && pendingSyncCount > 0 && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSyncNow}
          className="ml-auto"
          data-testid="button-sync-now-expanded"
        >
          Sync now
        </Button>
      )}
    </div>
  );
}
