import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import type { SyncConflict } from '@/lib/syncManager';

interface ConflictResolutionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: SyncConflict[];
  onResolve: (conflictId: string, useLocal: boolean) => Promise<void>;
}

const DISPLAY_FIELDS: Record<string, string[]> = {
  clients: ['name', 'email', 'phone', 'address', 'company'],
  jobs: ['title', 'description', 'status', 'priority', 'scheduledDate', 'address'],
  quotes: ['title', 'status', 'total', 'validUntil', 'notes'],
  invoices: ['invoiceNumber', 'status', 'total', 'dueDate', 'notes'],
  timeEntries: ['description', 'startTime', 'endTime', 'duration'],
  payments: ['amount', 'method', 'status', 'date'],
};

function formatFieldName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(value).toLocaleDateString('en-AU');
      } catch {
        return value;
      }
    }
    return value;
  }
  return JSON.stringify(value);
}

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: SyncConflict;
  onResolve: (useLocal: boolean) => Promise<void>;
}) {
  const [resolving, setResolving] = useState<'local' | 'server' | null>(null);

  const fields = DISPLAY_FIELDS[conflict.storeName] || Object.keys(conflict.localVersion || {}).filter(k => k !== 'id');
  const changedFields = fields.filter(f => {
    const l = formatValue(conflict.localVersion?.[f]);
    const s = formatValue(conflict.serverVersion?.[f]);
    return l !== s;
  });

  const handleResolve = async (useLocal: boolean) => {
    setResolving(useLocal ? 'local' : 'server');
    try {
      await onResolve(useLocal);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
          <span className="text-sm font-medium capitalize">{conflict.storeName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} differ
        </Badge>
      </div>

      {changedFields.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium px-1">
            <span>Field</span>
            <span>Your version</span>
            <span>Server version</span>
          </div>
          {changedFields.map(field => (
            <div key={field} className="grid grid-cols-3 gap-2 text-xs bg-muted/30 rounded-md p-1.5">
              <span className="text-muted-foreground">{formatFieldName(field)}</span>
              <span className="break-words">{formatValue(conflict.localVersion?.[field])}</span>
              <span className="break-words">{formatValue(conflict.serverVersion?.[field])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => handleResolve(true)}
          disabled={resolving !== null}
        >
          {resolving === 'local' ? (
            <ArrowRight className="h-3 w-3 mr-1 animate-pulse" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Keep mine
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => handleResolve(false)}
          disabled={resolving !== null}
        >
          {resolving === 'server' ? (
            <ArrowRight className="h-3 w-3 mr-1 animate-pulse" />
          ) : (
            <X className="h-3 w-3 mr-1" />
          )}
          Keep server
        </Button>
      </div>
    </div>
  );
}

export default function ConflictResolutionPanel({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}: ConflictResolutionPanelProps) {
  const unresolvedConflicts = conflicts.filter(c => !c.resolvedAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
            Sync Conflicts
          </SheetTitle>
          <SheetDescription>
            {unresolvedConflicts.length === 0
              ? 'No conflicts to resolve.'
              : `${unresolvedConflicts.length} conflict${unresolvedConflicts.length > 1 ? 's' : ''} found. Review the differences and choose which version to keep.`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-10rem)]">
          <div className="space-y-3 pr-3">
            {unresolvedConflicts.map(conflict => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={(useLocal) => onResolve(conflict.id, useLocal)}
              />
            ))}

            {unresolvedConflicts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500 dark:text-green-400" />
                All conflicts have been resolved.
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
