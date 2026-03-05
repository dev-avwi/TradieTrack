import { useState, useMemo } from "react";
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
  const [uninvoicedExpanded, setUninvoicedExpanded] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [confirmInvoiceDialogOpen, setConfirmInvoiceDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<JobRequest[]>({
    queryKey: ["/api/job-requests", { status: "pending" }],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: uninvoicedExpanded,
  });

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: uninvoicedExpanded,
  });

  const { data: allInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: uninvoicedExpanded,
  });

  const uninvoicedJobs = useMemo(() => {
    if (!uninvoicedExpanded) return [];
    const invoicedJobIds = new Set(allInvoices.filter((inv: any) => inv.jobId).map((inv: any) => inv.jobId));
    return allJobs.filter((j) => j.status === "done" && !invoicedJobIds.has(j.id));
  }, [allJobs, allInvoices, uninvoicedExpanded]);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    allClients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [allClients]);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobIds.size === uninvoicedJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(uninvoicedJobs.map((j) => j.id)));
    }
  };

  const batchInvoiceMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const res = await apiRequest("POST", "/api/invoices/batch", { jobIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invoices created",
        description: `Created ${data.summary.success} invoices totaling $${Number(data.summary.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
      setSelectedJobIds(new Set());
      setUninvoicedExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bi/action-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"], exact: false });
    },
    onError: () => {
      toast({
        title: "Failed to create invoices",
        variant: "destructive",
      });
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
      toast({
        title: "Failed to update request",
        variant: "destructive",
      });
    },
  });

  const getCategoryIcon = (category: string) => {
    const config = categoryConfig[category];
    if (!config) return Briefcase;
    return config.icon;
  };

  const getCategoryColor = (category: string) => {
    const config = categoryConfig[category];
    if (!config) return "hsl(var(--muted-foreground))";
    return config.color;
  };

  const getCategoryTint = (category: string) => {
    const config = categoryConfig[category];
    if (!config) return "transparent";
    return config.tint;
  };

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
                <CheckCircle
                  className="h-10 w-10"
                  style={{ color: "hsl(142.1 76.2% 36.3%)" }}
                />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">
                You're all caught up!
              </p>
              <p className="ios-caption max-w-xs mx-auto">
                No actions needed right now. We'll notify you when something needs your attention.
              </p>
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
                <div
                  className="feed-card card-press p-4 animate-fade-up stagger-delay-4"
                >
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
              {data && sectionConfig.map((section, sectionIdx) => {
                const items = data.sections[section.key] || [];
                const count = data.summary[section.countKey];

                return (
                  <div key={section.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: section.dotColor }}
                      />
                      <p className="ios-label">{section.label}</p>
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                        {count}
                      </Badge>
                    </div>

                    {items.length === 0 ? (
                      <div className="feed-card p-4 flex flex-col items-center justify-center text-center min-h-[80px]">
                        <CheckCircle className="h-5 w-5 text-muted-foreground/40 mb-1.5" />
                        <p className="text-xs text-muted-foreground">All clear</p>
                      </div>
                    ) : (
                    <div className="flex flex-col gap-2">
                      {items.map((action, idx) => {
                        const CategoryIcon = getCategoryIcon(action.category);
                        const isUninvoiced = action.id === "revenue-leak-uninvoiced";
                        return (
                          <div
                            key={action.id}
                            className="flex rounded-2xl overflow-visible"
                          >
                            <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: section.accentColor }} />
                            <div
                              className={`feed-card flex-1 rounded-l-none ${isUninvoiced ? "" : "card-press cursor-pointer"}`}
                              style={{ backgroundColor: getCategoryTint(action.category) }}
                              onClick={isUninvoiced ? undefined : () => navigate(action.ctaUrl)}
                            >
                              <div className="p-3">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${getCategoryColor(action.category)}1a` }}
                                      >
                                        <CategoryIcon
                                          className="h-3.5 w-3.5"
                                          style={{ color: getCategoryColor(action.category) }}
                                        />
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
                                    <p className="text-sm font-semibold text-foreground leading-snug">
                                      {action.title}
                                    </p>
                                    <p className="ios-caption mt-0.5 line-clamp-2">
                                      {action.description}
                                    </p>
                                  </div>
                                  {action.impact && (
                                    <p className="ios-caption line-clamp-1">
                                      {action.impact}
                                    </p>
                                  )}
                                  {isUninvoiced ? (
                                    <div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setUninvoicedExpanded(!uninvoicedExpanded);
                                          if (!uninvoicedExpanded) {
                                            setSelectedJobIds(new Set());
                                          }
                                        }}
                                      >
                                        {action.cta}
                                        {uninvoicedExpanded ? (
                                          <ChevronUp className="h-3.5 w-3.5 ml-1" />
                                        ) : (
                                          <ChevronDown className="h-3.5 w-3.5 ml-1" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(action.ctaUrl);
                                        }}
                                      >
                                        {action.cta}
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                      </Button>
                                    </div>
                                  )}
                                  {isUninvoiced && uninvoicedExpanded && (
                                    <div className="border-t border-border pt-3 mt-1">
                                      {uninvoicedJobs.length === 0 ? (
                                        <div className="flex items-center justify-center py-4">
                                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                          <span className="ml-2 text-sm text-muted-foreground">Loading jobs...</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <Checkbox
                                                checked={selectedJobIds.size === uninvoicedJobs.length && uninvoicedJobs.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                              />
                                              <span className="text-xs font-medium text-muted-foreground">
                                                Select All ({uninvoicedJobs.length})
                                              </span>
                                            </label>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              disabled={selectedJobIds.size === 0 || batchInvoiceMutation.isPending}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmInvoiceDialogOpen(true);
                                              }}
                                            >
                                              {batchInvoiceMutation.isPending ? (
                                                <>
                                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                                  Processing...
                                                </>
                                              ) : (
                                                <>
                                                  Generate {selectedJobIds.size} Invoice{selectedJobIds.size !== 1 ? "s" : ""}
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                                            {uninvoicedJobs.map((job) => (
                                              <label
                                                key={job.id}
                                                className="flex items-center gap-2 p-2 rounded-lg hover-elevate cursor-pointer"
                                              >
                                                <Checkbox
                                                  checked={selectedJobIds.has(job.id)}
                                                  onCheckedChange={() => toggleJobSelection(job.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium text-foreground truncate">
                                                    {job.title}
                                                  </p>
                                                  {job.clientId && clientMap.get(job.clientId) && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                      {clientMap.get(job.clientId)}
                                                    </p>
                                                  )}
                                                </div>
                                                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs flex-shrink-0">
                                                  Done
                                                </Badge>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      )}
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
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }}
                    />
                    <p className="ios-label">CLIENT REQUESTS</p>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      {pendingRequests.length}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {pendingRequests.map((request, idx) => {
                      const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;
                      return (
                        <div
                          key={request.id}
                          className="flex rounded-2xl overflow-hidden"
                        >
                          <div className="w-1 flex-shrink-0" style={{ backgroundColor: "hsl(221.2 83.2% 53.3%)" }} />
                          <div
                            className="feed-card card-press flex-1 rounded-l-none cursor-pointer"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRequestDialogOpen(true);
                            }}
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
                                    <p className="text-sm font-semibold text-foreground leading-snug">
                                      {request.title}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={urgency.variant}
                                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${request.urgency === "urgent" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" : ""}`}
                                  >
                                    {urgency.label}
                                  </Badge>
                                </div>
                                {request.description && (
                                  <p className="ios-caption line-clamp-2">
                                    {request.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "accepted" }); }}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updateRequestMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); updateRequestMutation.mutate({ id: request.id, status: "declined" }); }}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Decline
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

      <Dialog open={requestDialogOpen} onOpenChange={(open) => {
        setRequestDialogOpen(open);
        if (!open) setSelectedRequest(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedRequest?.title}</span>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs no-default-active-elevate">
                Request
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Job request details
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              {selectedRequest.clientName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selectedRequest.clientId ? (
                    <button
                      className="font-medium text-primary hover:underline text-left"
                      onClick={() => {
                        setRequestDialogOpen(false);
                        navigate(`/clients/${selectedRequest.clientId}`);
                      }}
                    >
                      {selectedRequest.clientName}
                    </button>
                  ) : (
                    <span className="font-medium">{selectedRequest.clientName}</span>
                  )}
                </div>
              )}

              {selectedRequest.description && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label">
                    <FileText className="h-3 w-3" />
                    Description
                  </div>
                  <p className="text-sm text-foreground">{selectedRequest.description}</p>
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {selectedRequest.urgency && (
                  <Badge
                    className={
                      selectedRequest.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 no-default-active-elevate' :
                      selectedRequest.urgency === 'urgent' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 no-default-active-elevate' :
                      selectedRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 no-default-active-elevate' :
                      'no-default-active-elevate'
                    }
                  >
                    {(urgencyConfig[selectedRequest.urgency] || urgencyConfig.normal).label}
                  </Badge>
                )}
                {selectedRequest.preferredDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(selectedRequest.preferredDate)}
                  </span>
                )}
                {selectedRequest.createdAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelativeTime(selectedRequest.createdAt)}
                  </span>
                )}
              </div>

              {selectedRequest.notes && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 ios-label">
                    <MessageSquare className="h-3 w-3" />
                    Notes
                  </div>
                  <p className="text-sm text-foreground">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="default"
              disabled={updateRequestMutation.isPending}
              onClick={() => {
                if (selectedRequest) {
                  updateRequestMutation.mutate({ id: selectedRequest.id, status: "accepted" });
                  setRequestDialogOpen(false);
                }
              }}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              variant="outline"
              disabled={updateRequestMutation.isPending}
              onClick={() => {
                if (selectedRequest) {
                  updateRequestMutation.mutate({ id: selectedRequest.id, status: "declined" });
                  setRequestDialogOpen(false);
                }
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmInvoiceDialogOpen} onOpenChange={setConfirmInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {selectedJobIds.size} Invoice{selectedJobIds.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This will create draft invoices for the selected completed jobs. You can review and edit each invoice before sending to clients.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto py-2">
            {uninvoicedJobs.filter(j => selectedJobIds.has(j.id)).map(job => (
              <div key={job.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  {job.clientId && clientMap.get(job.clientId) && (
                    <p className="text-xs text-muted-foreground truncate">{clientMap.get(job.clientId)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfirmInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={batchInvoiceMutation.isPending}
              onClick={() => {
                setConfirmInvoiceDialogOpen(false);
                batchInvoiceMutation.mutate(Array.from(selectedJobIds));
              }}
            >
              {batchInvoiceMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Creating...</>
              ) : (
                <>Yes, Generate {selectedJobIds.size} Invoice{selectedJobIds.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}