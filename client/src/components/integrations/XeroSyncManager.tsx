import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search, FileText, Receipt, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type Direction = "pull" | "push";
type DocType = "invoices" | "quotes";

interface BrowseRow {
  xeroId: string;
  number: string | null;
  reference: string | null;
  status: string | null;
  contactName: string | null;
  contactId: string | null;
  date: string | null;
  total: number;
  currency: string | null;
  alreadyImported: boolean;
}

interface PreviewLineItem {
  description: string | null;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  taxAmount: number;
  accountCode: string | null;
}

interface PreviewDoc {
  xeroId: string;
  type: "invoice" | "quote";
  number: string | null;
  reference: string | null;
  status: string | null;
  contactName: string | null;
  date: string | null;
  dueDate: string | null;
  expiryDate: string | null;
  subtotal: number;
  totalTax: number;
  total: number;
  currency: string | null;
  lineItems: PreviewLineItem[];
  alreadyImported: boolean;
}

interface LocalRow {
  id: string;
  number: string | null;
  status: string | null;
  clientName: string | null;
  total: number;
  date: string | null;
  alreadyPushed: boolean;
}

interface LocalPreview {
  id: string;
  number: string | null;
  status: string | null;
  clientName: string | null;
  date: string | null;
  total: number;
  subtotal: number;
  gstAmount: number;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  alreadyPushed: boolean;
  pushedAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtMoney(n: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return format(new Date(s), "d MMM yyyy");
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  const color =
    s === "PAID" || s === "ACCEPTED"
      ? "default"
      : s === "VOIDED" || s === "DELETED" || s === "DECLINED"
      ? "destructive"
      : s === "DRAFT"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={color as any} className="text-xs">
      {s}
    </Badge>
  );
}

export function XeroSyncManager({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [direction, setDirection] = useState<Direction>("pull");
  const [docType, setDocType] = useState<DocType>("invoices");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelected(new Set());
    setActivePreviewId(null);
    setSearch("");
  }, [direction, docType, open]);

  const isXero = direction === "pull";

  // ── Browse list (Xero side for pull, local side for push) ─────────────────
  const browseQ = useQuery<{ rows: BrowseRow[] } | { rows: LocalRow[] }>({
    queryKey: [
      isXero
        ? `/api/integrations/xero/browse/${docType}`
        : `/api/integrations/xero/local/${docType}`,
    ],
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });

  const rows: Array<BrowseRow | LocalRow> = (browseQ.data as any)?.rows || [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) => {
      return (
        (r.number || "").toLowerCase().includes(q) ||
        (r.contactName || r.clientName || "").toLowerCase().includes(q) ||
        (r.reference || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  // Auto-select first row for preview
  useEffect(() => {
    if (!activePreviewId && filteredRows.length > 0) {
      const first: any = filteredRows[0];
      setActivePreviewId(isXero ? first.xeroId : first.id);
    }
  }, [filteredRows, activePreviewId, isXero]);

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewQ = useQuery<PreviewDoc | LocalPreview>({
    queryKey: [
      isXero
        ? `/api/integrations/xero/preview/${docType === "invoices" ? "invoice" : "quote"}/${activePreviewId}`
        : `/api/integrations/xero/local-preview/${docType === "invoices" ? "invoice" : "quote"}/${activePreviewId}`,
    ],
    enabled: open && !!activePreviewId,
    staleTime: 60_000,
    retry: false,
  });

  // ── Sync action ───────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const path = isXero
        ? `/api/integrations/xero/pull-${docType}`
        : `/api/integrations/xero/push-selected-${docType}`;
      const resp = await apiRequest("POST", path, { ids });
      return resp.json();
    },
    onSuccess: (data: any) => {
      const verb = isXero ? "Imported" : "Pushed";
      const count = isXero ? data.imported : data.pushed;
      const skipped = data.skipped || 0;
      const failed = data.failed || 0;
      toast({
        title: `${verb} ${count} ${docType.slice(0, -1)}${count !== 1 ? "s" : ""}`,
        description: [
          skipped > 0 && `${skipped} skipped (already synced)`,
          failed > 0 && `${failed} failed`,
        ]
          .filter(Boolean)
          .join(" · ") || "Done.",
        variant: failed > 0 ? "destructive" : "default",
      });
      setSelected(new Set());
      browseQ.refetch();
      // Invalidate consumers so the affected pages refresh
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (err: any) => {
      toast({
        title: "Sync failed",
        description: err?.message || "Could not complete the sync.",
        variant: "destructive",
      });
    },
  });

  const toggleAll = () => {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      const ids = filteredRows.map((r: any) => (isXero ? r.xeroId : r.id));
      setSelected(new Set(ids));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const isAlreadySynced = (r: any) => (isXero ? r.alreadyImported : r.alreadyPushed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Xero Sync Manager
          </DialogTitle>
          <DialogDescription>
            Pick exactly which quotes and invoices to pull from Xero or push to Xero. See a live preview before syncing.
          </DialogDescription>
        </DialogHeader>

        {/* Direction + DocType tabs */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-3">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="pull" data-testid="tab-pull">
                <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Pull from Xero
              </TabsTrigger>
              <TabsTrigger value="push" data-testid="tab-push">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Push to Xero
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <TabsList>
              <TabsTrigger value="invoices" data-testid="tab-invoices">
                <Receipt className="w-4 h-4 mr-1.5" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="quotes" data-testid="tab-quotes">
                <FileText className="w-4 h-4 mr-1.5" /> Quotes
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 min-w-48 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by number, reference, contact…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-xero-sync"
            />
          </div>
        </div>

        <Separator />

        {/* Two-pane: list (left) | preview (right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] min-h-0">
          {/* List */}
          <div className="border-r flex flex-col min-h-0">
            <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    filteredRows.length > 0 &&
                    selected.size === filteredRows.length
                  }
                  onCheckedChange={toggleAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected · {filteredRows.length} shown
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => browseQ.refetch()}
                disabled={browseQ.isFetching}
                data-testid="button-refresh-list"
              >
                {browseQ.isFetching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {browseQ.isLoading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : browseQ.error ? (
                <div className="p-6 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 inline mr-1.5" />
                  {(browseQ.error as any).message || "Could not load list"}
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {search ? "No matches." : "Nothing to sync here."}
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredRows.map((r: any) => {
                    const id = isXero ? r.xeroId : r.id;
                    const synced = isAlreadySynced(r);
                    const isActive = activePreviewId === id;
                    return (
                      <li
                        key={id}
                        className={`px-3 py-2.5 cursor-pointer hover-elevate ${
                          isActive ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setActivePreviewId(id)}
                        data-testid={`row-${id}`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={selected.has(id)}
                            onCheckedChange={() => toggle(id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={synced}
                            data-testid={`checkbox-${id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {r.number || "(no number)"}
                              </span>
                              <StatusBadge status={r.status} />
                              {synced && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {isXero ? "Already imported" : "Already pushed"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {r.contactName || r.clientName || "No client"} · {fmtDate(r.date)}
                            </div>
                          </div>
                          <div className="text-sm font-medium tabular-nums">
                            {fmtMoney(r.total, (r as any).currency)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Preview pane */}
          <div className="flex flex-col min-h-0 bg-muted/10">
            {!activePreviewId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a {docType.slice(0, -1)} to preview
              </div>
            ) : previewQ.isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : previewQ.error ? (
              <div className="p-6 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 inline mr-1.5" />
                Could not load preview.
              </div>
            ) : previewQ.data ? (
              <ScrollArea className="flex-1">
                <PreviewBody
                  doc={previewQ.data as any}
                  isXero={isXero}
                  docType={docType}
                />
              </ScrollArea>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between gap-3 bg-background">
          <div className="text-xs text-muted-foreground">
            {isXero
              ? "Imported items appear in Documents and won't duplicate on re-sync."
              : "Pushed items get a Xero ID and won't be re-pushed unless you delete it in Xero."}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-sync-manager"
            >
              Close
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={selected.size === 0 || syncMutation.isPending}
              data-testid="button-sync-selected"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isXero ? (
                <ArrowDownToLine className="w-4 h-4 mr-2" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
              )}
              {isXero ? "Pull" : "Push"} {selected.size > 0 ? `${selected.size} ` : ""}
              {docType.slice(0, -1)}
              {selected.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  doc,
  isXero,
  docType,
}: {
  doc: PreviewDoc | LocalPreview;
  isXero: boolean;
  docType: DocType;
}) {
  const isInvoice = docType === "invoices";
  const xDoc = doc as PreviewDoc;
  const lDoc = doc as LocalPreview;
  const lineItems = isXero ? xDoc.lineItems : lDoc.lineItems;
  const subtotal = isXero ? xDoc.subtotal : lDoc.subtotal;
  const tax = isXero ? xDoc.totalTax : lDoc.gstAmount;
  const total = doc.total;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {isInvoice ? "Invoice" : "Quote"}
          </div>
          <div className="text-xl font-semibold mt-0.5 truncate">
            {doc.number || "(no number)"}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 truncate">
            {(isXero ? xDoc.contactName : lDoc.clientName) || "No client"}
          </div>
        </div>
        <div className="text-right">
          <StatusBadge status={doc.status} />
          {isXero && xDoc.alreadyImported && (
            <div className="mt-1.5">
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3" /> Already in JobRunner
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Meta label="Date" value={fmtDate(doc.date)} />
        {isInvoice ? (
          <Meta label="Due" value={fmtDate((doc as any).dueDate)} />
        ) : (
          <Meta label="Expires" value={fmtDate((doc as any).expiryDate)} />
        )}
        {isXero && (xDoc as any).reference && (
          <Meta label="Reference" value={(xDoc as any).reference} className="col-span-2" />
        )}
        {!isXero && lDoc.pushedAt && (
          <Meta label="Pushed to Xero" value={fmtDate(lDoc.pushedAt)} className="col-span-2" />
        )}
      </div>

      <Separator />

      {/* Line items */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Line items ({lineItems.length})
        </div>
        {lineItems.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No line items.</div>
        ) : (
          <div className="rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Unit</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li: any, i: number) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      {li.description || <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(li.quantity).toFixed(li.quantity % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(Number(li.unitAmount ?? li.unitPrice ?? 0), (xDoc as any).currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtMoney(Number(li.lineAmount ?? li.total ?? 0), (xDoc as any).currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{fmtMoney(subtotal, (xDoc as any).currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST</span>
            <span className="tabular-nums">{fmtMoney(tax, (xDoc as any).currency)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(total, (xDoc as any).currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
