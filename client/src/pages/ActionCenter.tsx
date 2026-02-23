import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JobRequest } from "@shared/schema";
import {
  AlertTriangle,
  Clock,
  Lightbulb,
  CheckCircle,
  ChevronRight,
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

const categoryConfig: Record<string, { icon: typeof DollarSign; color: string }> = {
  revenue: { icon: DollarSign, color: "hsl(142.1 76.2% 36.3%)" },
  schedule: { icon: Calendar, color: "hsl(221.2 83.2% 53.3%)" },
  operations: { icon: Briefcase, color: "hsl(262.1 83.3% 57.8%)" },
};

const sectionConfig = [
  {
    key: "fix_now" as const,
    label: "Fix Now",
    countKey: "fixNowCount" as const,
    icon: AlertTriangle,
    dotColor: "hsl(var(--destructive))",
    bgColor: "hsl(var(--destructive) / 0.08)",
  },
  {
    key: "this_week" as const,
    label: "This Week",
    countKey: "thisWeekCount" as const,
    icon: Clock,
    dotColor: "hsl(38 92% 50%)",
    bgColor: "hsl(38 92% 50% / 0.08)",
  },
  {
    key: "suggestions" as const,
    label: "Suggestions",
    countKey: "suggestionsCount" as const,
    icon: Lightbulb,
    dotColor: "hsl(142.1 76.2% 36.3%)",
    bgColor: "hsl(142.1 76.2% 36.3% / 0.08)",
  },
];

function ActionCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-16 rounded-md bg-muted" />
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded-md bg-muted animate-pulse" />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <div className="space-y-2">
        <div className="h-6 w-32 rounded-md bg-muted animate-pulse" />
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

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<JobRequest[]>({
    queryKey: ["/api/job-requests", { status: "pending" }],
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

  const isEmpty = data && data.summary.totalCount === 0;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Action Center
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What needs your attention
        </p>
      </div>

      {(isLoading || requestsLoading) && pendingRequests.length === 0 && (
        <div className="mb-6 space-y-3">
          <div className="h-6 w-40 rounded-md bg-muted animate-pulse" />
          <ActionCardSkeleton />
        </div>
      )}

      {isEmpty && pendingRequests.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "hsl(142.1 76.2% 36.3% / 0.1)" }}
            >
              <CheckCircle
                className="h-6 w-6"
                style={{ color: "hsl(142.1 76.2% 36.3%)" }}
              />
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              You're all caught up!
            </p>
            <p className="text-sm text-muted-foreground">
              No actions needed right now.
            </p>
          </CardContent>
        </Card>
      )}

      {(data || pendingRequests.length > 0) && !(isEmpty && pendingRequests.length === 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 py-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "hsl(221.2 83.2% 53.3% / 0.08)" }}
                >
                  <ClipboardList
                    className="h-3.5 w-3.5"
                    style={{ color: "hsl(221.2 83.2% 53.3%)" }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  Client Requests
                </span>
                <Badge variant="outline" className="no-default-hover-elevate text-xs">
                  {pendingRequests.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {pendingRequests.map((request) => {
                  const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;
                  return (
                    <Card
                      key={request.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedRequest(request);
                        setRequestDialogOpen(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">
                              {request.title}
                            </p>
                            <Badge
                              variant={urgency.variant}
                              className={`no-default-hover-elevate text-xs ${request.urgency === "urgent" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" : ""}`}
                            >
                              {urgency.label}
                            </Badge>
                          </div>
                          {request.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {request.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                            {request.createdAt && (
                              <span>{formatRelativeTime(request.createdAt)}</span>
                            )}
                            {request.preferredDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(request.preferredDate)}
                              </span>
                            )}
                          </div>
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {sectionConfig.map((section) => {
            const items = data.sections[section.key];
            const count = data.summary[section.countKey];
            if (!items || items.length === 0) return null;

            const SectionIcon = section.icon;

            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center gap-2 py-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: section.bgColor }}
                  >
                    <SectionIcon
                      className="h-3.5 w-3.5"
                      style={{ color: section.dotColor }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {section.label}
                  </span>
                  <Badge variant="outline" className="no-default-hover-elevate text-xs">
                    {count}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {items.map((action) => {
                    const CategoryIcon = getCategoryIcon(action.category);
                    return (
                      <Card key={action.id} className="hover-elevate cursor-pointer" onClick={() => navigate(action.ctaUrl)}>
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <Badge variant="outline" className="no-default-hover-elevate text-xs gap-1">
                                <CategoryIcon
                                  className="h-3 w-3"
                                  style={{ color: getCategoryColor(action.category) }}
                                />
                                {action.category}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {action.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {action.description}
                              </p>
                            </div>
                            {action.impact && (
                              <p className="text-xs text-muted-foreground">
                                {action.metric && (
                                  <span
                                    className="font-semibold text-foreground"
                                  >
                                    {action.metric}
                                  </span>
                                )}{" "}
                                {action.impact}
                              </p>
                            )}
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
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                  <span className="font-medium">{selectedRequest.clientName}</span>
                </div>
              )}

              {selectedRequest.description && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
    </div>
  );
}
