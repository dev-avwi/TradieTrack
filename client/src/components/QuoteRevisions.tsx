import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { History, ChevronRight, FileText, Clock, User, DollarSign } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice?: number;
  rate?: number;
  amount?: number;
  total?: number;
}

interface QuoteRevision {
  id: string;
  quoteId: string;
  userId: string;
  revisionNumber: number;
  title: string;
  description?: string;
  subtotal: string | number;
  gstAmount: string | number;
  total: string | number;
  lineItems: LineItem[];
  notes?: string;
  changeReason?: string;
  changedBy?: string;
  createdAt: string;
}

interface QuoteRevisionsProps {
  quoteId: string;
  compact?: boolean;
  showTrigger?: boolean;
  onRevisionSelect?: (revision: QuoteRevision) => void;
}

export default function QuoteRevisions({ 
  quoteId, 
  compact = true, 
  showTrigger = true,
  onRevisionSelect 
}: QuoteRevisionsProps) {
  const [selectedRevision, setSelectedRevision] = useState<QuoteRevision | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: revisions = [], isLoading } = useQuery<QuoteRevision[]>({
    queryKey: ['/api/quotes', quoteId, 'revisions'],
    enabled: !!quoteId,
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(numAmount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const getLineItemAmount = (item: LineItem): number => {
    if (item.amount !== undefined) return typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
    if (item.total !== undefined) return typeof item.total === 'string' ? parseFloat(item.total) : item.total;
    const qty = item.quantity || 0;
    const price = item.unitPrice || item.rate || 0;
    return qty * price;
  };

  const handleRevisionClick = (revision: QuoteRevision) => {
    setSelectedRevision(revision);
    onRevisionSelect?.(revision);
  };

  const RevisionsList = () => (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : revisions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No revision history yet</p>
          <p className="text-xs mt-1">Revisions are created when you save changes</p>
        </div>
      ) : (
        revisions.map((revision) => (
          <Card 
            key={revision.id}
            className="hover-elevate cursor-pointer"
            onClick={() => handleRevisionClick(revision)}
            data-testid={`revision-card-${revision.revisionNumber}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge 
                    variant="secondary" 
                    className="shrink-0 text-xs font-semibold"
                    data-testid={`revision-badge-${revision.revisionNumber}`}
                  >
                    v{revision.revisionNumber}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{revision.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{formatRelativeTime(revision.createdAt)}</span>
                      {revision.changedBy && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{revision.changedBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--trade))' }}>
                    {formatCurrency(revision.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {revision.changeReason && (
                <p className="text-xs text-muted-foreground mt-2 pl-10 italic">
                  "{revision.changeReason}"
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const RevisionDetail = ({ revision }: { revision: QuoteRevision }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSelectedRevision(null)}
          data-testid="button-back-to-list"
        >
          ← Back
        </Button>
        <Badge variant="secondary" className="text-xs font-semibold">
          Version {revision.revisionNumber}
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">{revision.title}</h3>
          {revision.description && (
            <p className="text-sm text-muted-foreground mt-1">{revision.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(revision.createdAt)}</span>
          </div>
          {revision.changedBy && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{revision.changedBy}</span>
            </div>
          )}
        </div>

        {revision.changeReason && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Change Reason</p>
            <p className="text-sm">{revision.changeReason}</p>
          </div>
        )}

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            <span className="text-sm font-medium">Line Items</span>
            <Badge variant="secondary" className="text-xs">
              {revision.lineItems?.length || 0}
            </Badge>
          </div>
          <div className="space-y-2">
            {revision.lineItems?.map((item, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-lg bg-muted/30"
                data-testid={`revision-line-item-${idx}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{item.description}</p>
                  <span className="text-sm font-semibold">
                    {formatCurrency(getLineItemAmount(item))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.quantity} × {formatCurrency(item.unitPrice || item.rate || 0)}
                </p>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">No line items</p>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(revision.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span>{formatCurrency(revision.gstAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t">
            <span>Total</span>
            <span style={{ color: 'hsl(var(--trade))' }}>{formatCurrency(revision.total)}</span>
          </div>
        </div>

        {revision.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{revision.notes}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const dialogContent = (
    <DialogContent className="max-w-md max-h-[85vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          Revision History
          {revisions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {revisions.length} {revisions.length === 1 ? 'revision' : 'revisions'}
            </Badge>
          )}
        </DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-[65vh]">
        {selectedRevision ? (
          <RevisionDetail revision={selectedRevision} />
        ) : (
          <RevisionsList />
        )}
      </ScrollArea>
    </DialogContent>
  );

  if (!showTrigger) {
    return (
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setSelectedRevision(null);
      }}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) setSelectedRevision(null);
    }}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size={compact ? "sm" : "default"}
          className="gap-2"
          data-testid="button-revision-history"
        >
          <History className="h-4 w-4" />
          {!compact && "Revision History"}
          {revisions.length > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 px-1.5 text-xs"
              data-testid="revision-count-badge"
            >
              {revisions.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}

export function useQuoteRevisions(quoteId: string) {
  return useQuery<QuoteRevision[]>({
    queryKey: ['/api/quotes', quoteId, 'revisions'],
    enabled: !!quoteId,
  });
}
