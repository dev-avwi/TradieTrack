import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import type { JobRequest, Job, Client } from "@shared/schema";
import {
  AlertTriangle,
  Clock,
  Lightbulb,
  CheckCircle,
  DollarSign,
  Calendar,
  Briefcase,
  ArrowRight,
  ClipboardList,
  Check,
  X,
  User,
  FileText,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Eye,
  AlertCircle,
} from "lucide-react";

interface ActionItem {
  id: string;
  priority: string;
  title: string;
  description: string;
  impact: string;
  cta: string;
  ctaUrl: string;
  metric: string;
  category: string;
}

interface ActionCenterData {
  actions: ActionItem[];
  summary: {
    fixNowCount: number;
    thisWeekCount: number;
    suggestionsCount: number;
    totalCount: number;
  };
  sections: {
    fix_now: ActionItem[];
    this_week: ActionItem[];
    suggestions: ActionItem[];
  };
}

interface ActionCenterProps {
  onNavigate?: (path: string) => void;
}

const categoryConfig: Record<string, { icon: typeof DollarSign; color: string; tint: string }> = {
  revenue: { icon: DollarSign, color: "hsl(142.1 76.2% 36.3%)", tint: "hsl(142.1 76.2% 36.3% / 0.04)" },
  schedule: { icon: Calendar, color: "hsl(221.2 83.2% 53.3%)", tint: "hsl(221.2 83.2% 53.3% / 0.04)" },
  operations: { icon: Briefcase, color: "hsl(262.1 83.3% 57.8%)", tint: "hsl(262.1 83.3% 57.8% / 0.04)" },
};

const sectionConfig = [
  {
    key: "fix_now" as const,
    label: "FIX NOW",
    countKey: "fixNowCount" as const,
    icon: AlertTriangle,
    dotColor: "hsl(var(--destructive))",
    bgColor: "hsl(var(--destructive) / 0.1)",
    accentColor: "hsl(var(--destructive))",
  },
  {
    key: "this_week" as const,
    label: "THIS WEEK",
    countKey: "thisWeekCount" as const,
    icon: Clock,
    dotColor: "hsl(38 92% 50%)",
    bgColor: "hsl(38 92% 50% / 0.1)",
    accentColor: "hsl(38 92% 50%)",
  },
  {
    key: "suggestions" as const,
    label: "SUGGESTIONS",
    countKey: "suggestionsCount" as const,
    icon: Lightbulb,
    dotColor: "hsl(142.1 76.2% 36.3%)",
    bgColor: "hsl(142.1 76.2% 36.3% / 0.1)",
    accentColor: "hsl(142.1 76.2% 36.3%)",
  },
];

const EXPANDABLE_ACTIONS = new Set([
  "revenue-leak-uninvoiced",
  "revenue-leak-overdue",
  "revenue-leak-draft-invoices",
  "revenue-leak-stale-quotes",
  "quotes-unsent",
  "jobs-missing-quotes",
]);

function ActionCardSkeleton() {
  return (
    <div className="feed-card animate-pulse">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-16 rounded-md bg-muted" />
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="section-gap">
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="feed-card animate-pulse p-4 space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-8 w-12 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <ActionCardSkeleton />
      </div>
    </div>
  );
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: string | number | null | undefined): string {
  const val = parseFloat(String(amount || '0'));
  return `$${val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysOverdue(dueDate: string | Date | null | undefined): number {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

const urgencyConfig: Record<string, { variant: "default" | "outline" | "destructive"; label: string }> = {
  normal: { variant: "outline", label: "Normal" },
  urgent: { variant: "default", label: "Urgent" },
  emergency: { variant: "destructive", label: "Emergency" },
};

export default function ActionCenter({ onNavigate }: ActionCenterProps) {
  const [, setLocation] = useLocation();
  const navigate = onNavigate || setLocation;
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  const focusUninvoiced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('focus') === 'uninvoiced';

  const [expandedCards, setExpandedCards] = useState<Set<string>>(
    focusUninvoiced ? new Set(["revenue-leak-uninvoiced"]) : new Set()
  );
  const [selectedIds, setSelectedIds] = useState<Record<string, Set<string>>>({});
  const hasAutoSelected = useRef(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    actionId: string;
    title: string;
    description: string;
    confirmLabel: string;
    items: Array<{ id: string; label: string; sublabel?: string }>;
  } | null>(null);

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<JobRequest[]>({
    queryKey: ["/api/job-requests", { status: "pending" }],
  });

  const needsData = expandedCards.size > 0;

  const { data: allJobs = [], isSuccess: jobsLoaded } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: needsData,
  });

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: needsData,
  });

  const { data: allInvoices = [], isSuccess: invoicesLoaded } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: needsData,
  });

  const { data: allQuotes = [], isSuccess: quotesLoaded } = useQuery<any[]>({
    queryKey: ["/api/quotes"],
    enabled: needsData,
  });

  const allDataLoaded = jobsLoaded && invoicesLoaded && quotesLoaded;

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    allClients.forEach((c) => map.set(c.id, c));
    return map;
  }, [allClients]);

  const uninvoicedJobs = useMemo(() => {
    if (!expandedCards.has("revenue-leak-uninvoiced")) return [];
    const invoicedJobIds = new Set(allInvoices.filter((inv: any) => inv.jobId).map((inv: any) => inv.jobId));
    return allJobs.filter((j) => j.status === "done" && !invoicedJobIds.has(j.id));
  }, [allJobs, allInvoices, expandedCards]);

  const overdueInvoices = useMemo(() => {
    if (!expandedCards.has("revenue-leak-overdue")) return [];
    const now = new Date();
    return allInvoices.filter(inv => {
      if (inv.status === 'paid' || inv.status === 'draft') return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < now;
    }).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allInvoices, expandedCards]);

  const draftInvoices = useMemo(() => {
    if (!expandedCards.has("revenue-leak-draft-invoices")) return [];
    return allInvoices.filter((inv: any) => inv.status === 'draft');
  }, [allInvoices, expandedCards]);

  const staleQuotes = useMemo(() => {
    if (!expandedCards.has("revenue-leak-stale-quotes")) return [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return allQuotes.filter((q: any) => {
      if (q.status !== 'sent') return false;
      const sentDate = q.sentAt ? new Date(q.sentAt) : (q.createdAt ? new Date(q.createdAt) : null);
      return sentDate && sentDate < sevenDaysAgo;
    });
  }, [allQuotes, expandedCards]);

  const draftQuotes = useMemo(() => {
    if (!expandedCards.has("quotes-unsent")) return [];
    return allQuotes.filter((q: any) => q.status === 'draft');
  }, [allQuotes, expandedCards]);

  const jobsWithoutQuotes = useMemo(() => {
    if (!expandedCards.has("jobs-missing-quotes")) return [];
    const activeJobs = allJobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');
    return activeJobs.filter(j => !allQuotes.some((q: any) => q.jobId === j.id));
  }, [allJobs, allQuotes, expandedCards]);

  useEffect(() => {
    if (focusUninvoiced && allDataLoaded && uninvoicedJobs.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      setSelectedIds(prev => ({
        ...prev,
        "revenue-leak-uninvoiced": new Set(uninvoicedJobs.map((j) => j.id))
      }));
    }
  }, [focusUninvoiced, allDataLoaded, uninvoicedJobs]);

  const toggleExpand = (actionId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const getSelected = (actionId: string): Set<string> => selectedIds[actionId] || new Set();

  const toggleSelection = (actionId: string, itemId: string) => {
    setSelectedIds(prev => {
      const current = new Set(prev[actionId] || []);
      if (current.has(itemId)) {
        current.delete(itemId);
      } else {
        current.add(itemId);
      }
      return { ...prev, [actionId]: current };
    });
  };

  const toggleSelectAll = (actionId: string, allItemIds: string[]) => {
    setSelectedIds(prev => {
      const current = prev[actionId] || new Set();
      if (current.size === allItemIds.length) {
        return { ...prev, [actionId]: new Set() };
      }
      return { ...prev, [actionId]: new Set(allItemIds) };
    });
  };

  const batchInvoiceMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch", { jobIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invoices created",
        description: `Created ${data.summary.success} invoice${data.summary.success !== 1 ? 's' : ''} totaling ${formatCurrency(data.summary.totalAmount)}`,
      });
      setSelectedIds(prev => ({ ...prev, "revenue-leak-uninvoiced": new Set() }));
      setExpandedCards(prev => { const n = new Set(prev); n.delete("revenue-leak-uninvoiced"); return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"], exact: false });
    },
    onError: () => {
      toast({ title: "Failed to create invoices", variant: "destructive" });
    },
  });

  const batchSendInvoicesMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch-send", { invoiceIds });
      return res.json();
    },
    onSuccess: (data, variables) => {
      const actionId = confirmDialog?.actionId || "";
      if (data.summary.failed > 0) {
        const failedItems = data.results.filter((r: any) => !r.success);
        toast({
          title: `Sent ${data.summary.success} of ${data.summary.total} invoices`,
          description: `${data.summary.failed} failed: ${failedItems.map((f: any) => f.error).join(', ')}`,
          variant: data.summary.success > 0 ? "default" : "destructive",
        });
      } else {
        toast({
          title: `${data.summary.success} invoice${data.summary.success !== 1 ? 's' : ''} sent`,
          description: "Clients will receive their invoices by email",
        });
      }
      setSelectedIds(prev => ({ ...prev, [actionId]: new Set() }));
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], exact: false });
    },
    onError: () => {
      toast({ title: "Failed to send invoices", variant: "destructive" });
    },
  });

  const batchSendQuotesMutation = useMutation({
    mutationFn: async (quoteIds: string[]) => {
      const res = await apiRequest("POST", "/api/quotes/batch-send", { quoteIds });
      return res.json();
    },
    onSuccess: (data) => {
      const actionId = confirmDialog?.actionId || "";
      if (data.summary.failed > 0) {
        const failedItems = data.results.filter((r: any) => !r.success);
        toast({
          title: `Sent ${data.summary.success} of ${data.summary.total} quotes`,
          description: `${data.summary.failed} failed: ${failedItems.map((f: any) => f.error).join(', ')}`,
          variant: data.summary.success > 0 ? "default" : "destructive",
        });
      } else {
        toast({
          title: `${data.summary.success} quote${data.summary.success !== 1 ? 's' : ''} sent`,
          description: "Clients will receive their quotes by email",
        });
      }
      setSelectedIds(prev => ({ ...prev, [actionId]: new Set() }));
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"], exact: false });
    },
    onError: () => {
      toast({ title: "Failed to send quotes", variant: "destructive" });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/job-requests/${id}`, { status });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "accepted" ? "Request accepted" : "Request declined",
        description: variables.status === "accepted"
          ? "The job request has been accepted."
          : "The job request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/job-requests"], exact: false });
      if (variables.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"], exact: false });
      }
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const getCategoryIcon = (category: string) => categoryConfig[category]?.icon || Briefcase;
  const getCategoryColor = (category: string) => categoryConfig[category]?.color || "hsl(var(--muted-foreground))";
  const getCategoryTint = (category: string) => categoryConfig[category]?.tint || "transparent";

  const isBusy = batchInvoiceMutation.isPending || batchSendInvoicesMutation.isPending || batchSendQuotesMutation.isPending;

  const handleBatchAction = (actionId: string) => {
    const selected = getSelected(actionId);
    if (selected.size === 0) return;

    if (actionId === "revenue-leak-uninvoiced") {
      const items = uninvoicedJobs.filter(j => selected.has(j.id)).map(j => ({
        id: j.id,
        label: j.title || 'Untitled Job',
        sublabel: j.clientId ? clientMap.get(j.clientId)?.name : undefined,
      }));
      setConfirmDialog({
        open: true,
        actionId,
        title: `Create ${selected.size} Invoice${selected.size !== 1 ? 's' : ''}?`,
        description: "Draft invoices will be created for these completed jobs. You'll be able to review and edit each one before sending to clients.",
        confirmLabel: `Create ${selected.size} Invoice${selected.size !== 1 ? 's' : ''}`,
        items,
      });
    } else if (actionId === "revenue-leak-draft-invoices") {
      const items = draftInvoices.filter(inv => selected.has(inv.id)).map((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return {
          id: inv.id,
          label: `${inv.number || 'Draft'} — ${formatCurrency(inv.total)}`,
          sublabel: client?.name || 'No client',
        };
      });
      setConfirmDialog({
        open: true,
        actionId,
        title: `Send ${selected.size} Invoice${selected.size !== 1 ? 's' : ''} to Clients?`,
        description: "Each client will receive their invoice by email. Invoice status will change from Draft to Sent.",
        confirmLabel: `Send ${selected.size} Invoice${selected.size !== 1 ? 's' : ''}`,
        items,
      });
    } else if (actionId === "revenue-leak-overdue") {
      const items = overdueInvoices.filter(inv => selected.has(inv.id)).map((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        const days = daysOverdue(inv.dueDate);
        return {
          id: inv.id,
          label: `${inv.number || 'Invoice'} — ${formatCurrency(inv.total)}`,
          sublabel: `${client?.name || 'No client'} — ${days} day${days !== 1 ? 's' : ''} overdue`,
        };
      });
      setConfirmDialog({
        open: true,
        actionId,
        title: `Send ${selected.size} Payment Reminder${selected.size !== 1 ? 's' : ''}?`,
        description: "Each client will receive a reminder email with their overdue invoice. This resends the invoice to prompt payment.",
        confirmLabel: `Send ${selected.size} Reminder${selected.size !== 1 ? 's' : ''}`,
        items,
      });
    } else if (actionId === "quotes-unsent" || actionId === "revenue-leak-stale-quotes") {
      const sourceItems = actionId === "quotes-unsent" ? draftQuotes : staleQuotes;
      const items = sourceItems.filter((q: any) => selected.has(q.id)).map((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return {
          id: q.id,
          label: `${q.number || 'Quote'} — ${formatCurrency(q.total)}`,
          sublabel: client?.name || 'No client',
        };
      });
      const isSend = actionId === "quotes-unsent";
      setConfirmDialog({
        open: true,
        actionId,
        title: isSend
          ? `Send ${selected.size} Quote${selected.size !== 1 ? 's' : ''} to Clients?`
          : `Resend ${selected.size} Quote${selected.size !== 1 ? 's' : ''} as Follow Up?`,
        description: isSend
          ? "Each client will receive their quote by email. Quote status will change from Draft to Sent."
          : "Each client will receive their quote again by email as a follow-up. This gives them another chance to review and accept.",
        confirmLabel: isSend
          ? `Send ${selected.size} Quote${selected.size !== 1 ? 's' : ''}`
          : `Resend ${selected.size} Quote${selected.size !== 1 ? 's' : ''}`,
        items,
      });
    }
  };

  const executeConfirmedAction = () => {
    if (!confirmDialog) return;
    const { actionId } = confirmDialog;
    const ids = Array.from(getSelected(actionId));

    if (actionId === "revenue-leak-uninvoiced") {
      const validIds = uninvoicedJobs.map(j => j.id);
      batchInvoiceMutation.mutate(ids.filter(id => validIds.includes(id)));
    } else if (actionId === "revenue-leak-draft-invoices" || actionId === "revenue-leak-overdue") {
      batchSendInvoicesMutation.mutate(ids);
    } else if (actionId === "quotes-unsent" || actionId === "revenue-leak-stale-quotes") {
      batchSendQuotesMutation.mutate(ids);
    }

    setConfirmDialog(null);
  };

  const getExpandedContent = (actionId: string) => {
    if (!expandedCards.has(actionId)) return null;

    if (!allDataLoaded) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    if (actionId === "revenue-leak-uninvoiced") {
      return renderItemList({
        actionId,
        items: uninvoicedJobs,
        emptyMessage: "All completed jobs have been invoiced",
        getItemId: (j) => j.id,
        renderItem: (j) => ({
          label: j.title || 'Untitled Job',
          sublabel: j.clientId ? clientMap.get(j.clientId)?.name : undefined,
          badge: "Done",
        }),
        actionLabel: (count) => `Create ${count} Invoice${count !== 1 ? 's' : ''}`,
        reviewUrl: (j) => `/jobs/${j.id}`,
      });
    }

    if (actionId === "revenue-leak-draft-invoices") {
      const sendableInvoices = draftInvoices.filter((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return client?.email;
      });
      const unsendable = draftInvoices.filter((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return !client?.email;
      });
      return (
        <>
          {renderItemList({
            actionId,
            items: sendableInvoices,
            emptyMessage: "No draft invoices to send",
            getItemId: (inv) => inv.id,
            renderItem: (inv: any) => {
              const client = inv.clientId ? clientMap.get(inv.clientId) : null;
              return {
                label: `${inv.number || 'Draft'} — ${formatCurrency(inv.total)}`,
                sublabel: client?.name,
                badge: inv.total && parseFloat(inv.total) > 0 ? undefined : "$0",
              };
            },
            actionLabel: (count) => `Send ${count} Invoice${count !== 1 ? 's' : ''}`,
            actionIcon: <Send className="h-3.5 w-3.5 mr-1" />,
            reviewUrl: (inv) => `/invoices/${inv.id}`,
          })}
          {unsendable.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {unsendable.length} invoice{unsendable.length !== 1 ? 's' : ''} can't be sent — client has no email address
              </p>
            </div>
          )}
        </>
      );
    }

    if (actionId === "revenue-leak-overdue") {
      const sendableInvoices = overdueInvoices.filter((inv: any) => {
        const client = inv.clientId ? clientMap.get(inv.clientId) : null;
        return client?.email;
      });
      return renderItemList({
        actionId,
        items: sendableInvoices,
        emptyMessage: "No overdue invoices",
        getItemId: (inv) => inv.id,
        renderItem: (inv: any) => {
          const client = inv.clientId ? clientMap.get(inv.clientId) : null;
          const days = daysOverdue(inv.dueDate);
          return {
            label: `${inv.number || 'Invoice'} — ${formatCurrency(inv.total)}`,
            sublabel: `${client?.name || 'Unknown'} — ${days}d overdue`,
            badge: days > 30 ? "30d+" : `${days}d`,
            badgeVariant: days > 30 ? "destructive" as const : undefined,
          };
        },
        actionLabel: (count) => `Send ${count} Reminder${count !== 1 ? 's' : ''}`,
        actionIcon: <Send className="h-3.5 w-3.5 mr-1" />,
        reviewUrl: (inv) => `/invoices/${inv.id}`,
      });
    }

    if (actionId === "revenue-leak-stale-quotes") {
      const sendableQuotes = staleQuotes.filter((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return client?.email;
      });
      return renderItemList({
        actionId,
        items: sendableQuotes,
        emptyMessage: "No stale quotes",
        getItemId: (q) => q.id,
        renderItem: (q: any) => {
          const client = q.clientId ? clientMap.get(q.clientId) : null;
          const sentDate = q.sentAt || q.createdAt;
          const daysSince = sentDate ? Math.floor((Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return {
            label: `${q.number || 'Quote'} — ${formatCurrency(q.total)}`,
            sublabel: `${client?.name || 'Unknown'} — sent ${daysSince}d ago`,
          };
        },
        actionLabel: (count) => `Resend ${count} Quote${count !== 1 ? 's' : ''}`,
        actionIcon: <Send className="h-3.5 w-3.5 mr-1" />,
        reviewUrl: (q) => `/quotes/${q.id}`,
      });
    }

    if (actionId === "quotes-unsent") {
      const sendableQuotes = draftQuotes.filter((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return client?.email;
      });
      const unsendable = draftQuotes.filter((q: any) => {
        const client = q.clientId ? clientMap.get(q.clientId) : null;
        return !client?.email;
      });
      return (
        <>
          {renderItemList({
            actionId,
            items: sendableQuotes,
            emptyMessage: "No draft quotes to send",
            getItemId: (q) => q.id,
            renderItem: (q: any) => {
              const client = q.clientId ? clientMap.get(q.clientId) : null;
              return {
                label: `${q.number || 'Draft'} — ${formatCurrency(q.total)}`,
                sublabel: client?.name,
              };
            },
            actionLabel: (count) => `Send ${count} Quote${count !== 1 ? 's' : ''}`,
            actionIcon: <Send className="h-3.5 w-3.5 mr-1" />,
            reviewUrl: (q) => `/quotes/${q.id}`,
          })}
          {unsendable.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {unsendable.length} quote{unsendable.length !== 1 ? 's' : ''} can't be sent — client has no email address
              </p>
            </div>
          )}
        </>
      );
    }

    if (actionId === "jobs-missing-quotes") {
      if (jobsWithoutQuotes.length === 0) {
        return (
          <div className="flex items-center justify-center py-4">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">All active jobs have quotes</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {jobsWithoutQuotes.map((job) => (
            <div key={job.id} className="flex items-center gap-2 p-2 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.title || 'Untitled'}</p>
                {job.clientId && clientMap.get(job.clientId) && (
                  <p className="text-xs text-muted-foreground truncate">{clientMap.get(job.clientId)?.name}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="default" onClick={() => navigate(`/quotes/new?jobId=${job.id}`)}>
                  Create Quote
                </Button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  function renderItemList<T>({
    actionId,
    items,
    emptyMessage,
    getItemId,
    renderItem,
    actionLabel,
    actionIcon,
    reviewUrl,
  }: {
    actionId: string;
    items: T[];
    emptyMessage: string;
    getItemId: (item: T) => string;
    renderItem: (item: T) => { label: string; sublabel?: string; badge?: string; badgeVariant?: "destructive" | "outline" | "default" };
    actionLabel: (count: number) => string;
    actionIcon?: React.ReactNode;
    reviewUrl?: (item: T) => string;
  }) {
    const selected = getSelected(actionId);
    const allItemIds = items.map(getItemId);

    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center py-4">
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{emptyMessage}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.size === allItemIds.length && allItemIds.length > 0}
              onCheckedChange={() => toggleSelectAll(actionId, allItemIds)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              Select All ({allItemIds.length})
            </span>
          </label>
          <Button
            size="sm"
            variant="default"
            disabled={selected.size === 0 || isBusy}
            onClick={(e) => { e.stopPropagation(); handleBatchAction(actionId); }}
          >
            {isBusy ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Processing...</>
            ) : (
              <>{actionIcon}{actionLabel(selected.size)}</>
            )}
          </Button>
        </div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {items.map((item) => {
            const id = getItemId(item);
            const { label, sublabel, badge, badgeVariant } = renderItem(item);
            return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg hover-elevate">
                <Checkbox
                  checked={selected.has(id)}
                  onCheckedChange={() => toggleSelection(actionId, id)}
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelection(actionId, id)}>
                  <p className="text-sm font-medium text-foreground truncate">{label}</p>
                  {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
                </div>
                {badge && (
                  <Badge variant={badgeVariant || "outline"} className="no-default-hover-elevate no-default-active-elevate text-xs flex-shrink-0">
                    {badge}
                  </Badge>
                )}
                {reviewUrl && (
                  <Button size="sm" variant="ghost" className="flex-shrink-0 h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate(reviewUrl(item)); }}>
                    <Eye className="h-3 w-3 mr-1" />
                    <span className="text-xs">Review</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const isEmpty = data && data.summary.totalCount === 0;

  return (
    <PageShell>
      <PageHeader
        title="Action Centre"
        subtitle="What needs your attention"
        leading={<Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      {(isLoading || requestsLoading) && pendingRequests.length === 0 && (
        <LoadingSkeleton />
      )}

      {isEmpty && pendingRequests.length === 0 && (
        <div className="animate-fade-up">
          <div className="feed-card">
            <div className="py-16 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, hsl(142.1 76.2% 36.3% / 0.12), hsl(142.1 76.2% 36.3% / 0.06))" }}
              >
                <CheckCircle className="h-10 w-10" style={{ color: "hsl(142.1 76.2% 36.3%)" }} />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">You're all caught up!</p>
              <p className="ios-caption max-w-xs mx-auto">No actions needed right now. We'll notify you when something needs your attention.</p>
            </div>
          </div>
        </div>
      )}

      {(data || pendingRequests.length > 0) && !(isEmpty && pendingRequests.length === 0) && (
        <div className="section-gap">
          {data && (
            <div className="animate-fade-up">
              <div className="grid grid-cols-4 gap-3">
                {sectionConfig.map((section, idx) => {
                  const count = data.summary[section.countKey];
                  const SectionIcon = section.icon;
                  const isHero = section.key === "fix_now";
                  return (
                    <div
                      key={section.key}
                      className={`feed-card card-press p-4 animate-fade-up stagger-delay-${idx + 1}`}
                      style={isHero && count > 0 ? { background: `linear-gradient(135deg, ${section.bgColor}, hsl(var(--card)))` } : undefined}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: section.bgColor }}
                      >
                        <SectionIcon className="h-5 w-5" style={{ color: section.dotColor }} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                      <p className="ios-label mt-1">{section.label}</p>
                    </div>
                  );
                })}
                <div className="feed-card card-press p-4 animate-fade-up stagger-delay-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: "hsl(221.2 83.2% 53.3% / 0.1)" }}
                  >
                    <ClipboardList className="h-5 w-5" style={{ color: "hsl(221.2 83.2% 53.3%)" }} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
                  <p className="ios-label mt-1">REQUESTS</p>
                </div>
              </div>
            </div>
          )}

          {(data || pendingRequests.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start animate-fade-up stagger-delay-4">
              {data && sectionConfig.map((section) => {
                const items = data.sections[section.key] || [];
                const count = data.summary[section.countKey];

                return (
                  <div key={section.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: section.dotColor }} />
                      <p className="ios-label">{section.label}</p>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">{count}</Badge>
                    </div>

                    {items.length === 0 ? (
                      <div className="feed-card p-4 flex flex-col items-center justify-center text-center min-h-[80px]">
                        <CheckCircle className="h-5 w-5 text-muted-foreground/40 mb-1.5" />
                        <p className="text-xs text-muted-foreground">All clear</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {items.map((action) => {
                          const CategoryIcon = getCategoryIcon(action.category);
                          const isExpandable = EXPANDABLE_ACTIONS.has(action.id);
                          const isExpanded = expandedCards.has(action.id);

                          return (
                            <div key={action.id} className="flex rounded-2xl overflow-visible">
                              <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: section.accentColor }} />
                              <div
                                className={`feed-card flex-1 rounded-l-none ${!isExpandable ? "card-press cursor-pointer" : ""}`}
                                style={{ backgroundColor: getCategoryTint(action.category) }}
                                onClick={!isExpandable ? () => navigate(action.ctaUrl) : undefined}
                              >
                                <div className="p-3">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                          style={{ backgroundColor: `${getCategoryColor(action.category)}1a` }}
                                        >
                                          <CategoryIcon className="h-3.5 w-3.5" style={{ color: getCategoryColor(action.category) }} />
                                        </div>
                                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs capitalize">
                                          {action.category}
                                        </Badge>
                                      </div>
                                      {action.metric && (
                                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs font-semibold">
                                          {action.metric}
                                        </Badge>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground leading-snug">{action.title}</p>
                                      <p className="ios-caption mt-0.5 line-clamp-2">{action.description}</p>
                                    </div>
                                    {action.impact && <p className="ios-caption line-clamp-1">{action.impact}</p>}

                                    {isExpandable ? (
                                      <div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => { e.stopPropagation(); toggleExpand(action.id); }}
                                        >
                                          {action.cta}
                                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                                        </Button>
                                      </div>
                                    ) : (
                                      <div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => { e.stopPropagation(); navigate(action.ctaUrl); }}
                                        >
                                          {action.cta}
                                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                        </Button>
                                      </div>
                                    )}

                                    {isExpanded && (
                                      <div className="border-t border-border pt-3 mt-1">
                                        {getExpandedContent(action.id)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {pendingRequests.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }} />
                    <p className="ios-label">CLIENT REQUESTS</p>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">{pendingRequests.length}</Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {pendingRequests.map((request) => {
                      const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;
                      return (
                        <div key={request.id} className="flex rounded-2xl overflow-hidden">
                          <div className="w-1 flex-shrink-0" style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }} />
                          <div
                            className="feed-card card-press flex-1 rounded-l-none cursor-pointer"
                            onClick={() => { setSelectedRequest(request); setRequestDialogOpen(true); }}
                          >
                            <div className="p-3">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ backgroundColor: "hsl(221.2 83.2% 53.3% / 0.1)" }}
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" style={{ color: "hsl(221.2 83.2% 53.3%)" }} />
                                    </div>
                                    <p className="text-sm font-semibold text-foreground leading-snug">{request.title}</p>
                                  </div>
                                  <Badge
                                    variant={urgency.variant}
                                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${request.urgency === "urgent" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" : ""}`}
                                  >
                                    {urgency.label}
                                  </Badge>
                                </div>
                                {request.description && <p className="ios-caption line-clamp-2">{request.description}</p>}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "accepted" }); }}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "declined" }); }}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />Decline
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={requestDialogOpen} onOpenChange={(open) => { setRequestDialogOpen(open); if (!open) setSelectedRequest(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedRequest?.title}</span>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs no-default-active-elevate">Request</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Job request details</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              {selectedRequest.clientName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selectedRequest.clientId ? (
                    <button className="font-medium text-primary hover:underline text-left" onClick={() => { setRequestDialogOpen(false); navigate(`/clients/${selectedRequest.clientId}`); }}>
                      {selectedRequest.clientName}
                    </button>
                  ) : (
                    <span className="font-medium">{selectedRequest.clientName}</span>
                  )}
                </div>
              )}
              {selectedRequest.description && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label"><FileText className="h-3 w-3" />Description</div>
                  <p className="text-sm text-foreground">{selectedRequest.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {selectedRequest.urgency && (
                  <Badge className={
                    selectedRequest.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 no-default-active-elevate' :
                    selectedRequest.urgency === 'urgent' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 no-default-active-elevate' :
                    selectedRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 no-default-active-elevate' :
                    'no-default-active-elevate'
                  }>
                    {(urgencyConfig[selectedRequest.urgency] || urgencyConfig.normal).label}
                  </Badge>
                )}
                {selectedRequest.preferredDate && (
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(selectedRequest.preferredDate)}</span>
                )}
                {selectedRequest.createdAt && (
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatRelativeTime(selectedRequest.createdAt)}</span>
                )}
              </div>
              {selectedRequest.notes && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label"><MessageSquare className="h-3 w-3" />Notes</div>
                  <p className="text-sm text-foreground">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center gap-2">
            <Button variant="default" disabled={updateRequestMutation.isPending} onClick={() => { if (selectedRequest) { updateRequestMutation.mutate({ id: selectedRequest.id, status: "accepted" }); setRequestDialogOpen(false); } }}>
              <Check className="h-4 w-4 mr-1" />Accept
            </Button>
            <Button variant="outline" disabled={updateRequestMutation.isPending} onClick={() => { if (selectedRequest) { updateRequestMutation.mutate({ id: selectedRequest.id, status: "declined" }); setRequestDialogOpen(false); } }}>
              <X className="h-4 w-4 mr-1" />Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto py-2">
            {confirmDialog?.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.sublabel && <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button disabled={isBusy} onClick={executeConfirmedAction}>
              {isBusy ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Processing...</>
              ) : (
                confirmDialog?.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
