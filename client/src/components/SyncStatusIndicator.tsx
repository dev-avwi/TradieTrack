import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Loader2,
  Paperclip,
} from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { syncManager } from '@/lib/syncManager';
import { getOfflineSyncStats } from '@/lib/offlineStorage';
import { formatDistanceToNow } from 'date-fns';
import ConflictResolutionPanel from './ConflictResolutionPanel';

interface SyncStatusIndicatorProps {
  compact?: boolean;
}

export default function SyncStatusIndicator({ compact = true }: SyncStatusIndicatorProps) {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync } = useNetwork();
  const [conflictsCount, setConflictsCount] = useState(0);
  const [pendingFileCount, setPendingFileCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState(syncManager.getConflicts());

  const refreshCounts = useCallback(async () => {
    const c = syncManager.getConflicts();
    setConflicts(c);
    setConflictsCount(c.filter(x => !x.resolvedAt).length);
    try {
      const stats = await getOfflineSyncStats();
      setPendingFileCount(stats.fileAttachmentCount);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    refreshCounts();

    const unsubConflict = syncManager.on('conflict', refreshCounts);
    const unsubComplete = syncManager.on('syncComplete', refreshCounts);

    return () => {
      unsubConflict();
      unsubComplete();
    };
  }, [refreshCounts]);

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
      return <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
    }
    if (pendingSyncCount > 0 || pendingFileCount > 0) {
      return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
    return <Cloud className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (conflictsCount > 0) return `${conflictsCount} conflict${conflictsCount > 1 ? 's' : ''}`;
    if (totalPending > 0) return `${totalPending} pending`;
    return 'Synced';
  };

  const getLastSyncText = () => {
    if (!lastSyncTime) return 'Never synced';
    return `Last synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`;
  };

  const totalPending = pendingSyncCount + pendingFileCount;
  const showBadge = !isOnline || totalPending > 0 || conflictsCount > 0;
  const badgeCount = totalPending + conflictsCount;

  if (compact) {
    return (
      <>
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
          <PopoverContent className="w-72 p-3" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="text-sm font-medium">{getStatusText()}</span>
                </div>
                {isOnline && !isSyncing && totalPending > 0 && (
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

              {pendingFileCount > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span>{pendingFileCount} file{pendingFileCount > 1 ? 's' : ''} to upload</span>
                </div>
              )}

              {conflictsCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsPopoverOpen(false);
                    setShowConflicts(true);
                  }}
                >
                  <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500 dark:text-yellow-400" />
                  {conflictsCount} conflict{conflictsCount > 1 ? 's' : ''} need resolution
                </Button>
              )}

              {isOnline && totalPending === 0 && conflictsCount === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                  <Check className="h-3 w-3" />
                  <span>All changes synced</span>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <ConflictResolutionPanel
          open={showConflicts}
          onOpenChange={setShowConflicts}
          conflicts={conflicts}
          onResolve={async (conflictId, useLocal, mergedData) => {
            await syncManager.resolveConflict(conflictId, useLocal, mergedData);
            refreshCounts();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50" data-testid="sync-status-expanded">
        {getStatusIcon()}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{getStatusText()}</span>
          <span className="text-xs text-muted-foreground">{getLastSyncText()}</span>
        </div>
        {pendingFileCount > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            <Paperclip className="h-3 w-3 mr-1" />
            {pendingFileCount}
          </Badge>
        )}
        {isOnline && !isSyncing && totalPending > 0 && (
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
        {conflictsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConflicts(true)}
            className="ml-auto"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Conflicts
          </Button>
        )}
      </div>

      <ConflictResolutionPanel
        open={showConflicts}
        onOpenChange={setShowConflicts}
        conflicts={conflicts}
        onResolve={async (conflictId, useLocal, mergedData) => {
          await syncManager.resolveConflict(conflictId, useLocal, mergedData);
          refreshCounts();
        }}
      />
    </>
  );
}
