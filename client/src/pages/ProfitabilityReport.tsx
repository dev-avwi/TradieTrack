import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowLeft,
  Briefcase,
} from "lucide-react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

interface ProfitabilitySummary {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
  jobsAnalyzed: number;
  jobsProfitable: number;
  jobsAtLoss: number;
  jobsNoRevenue: number;
}

interface ProfitabilityJob {
  jobId: string;
  title: string;
  status: string;
  clientName: string;
  quoted: number;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  profitStatus: "profitable" | "tight" | "loss";
}

interface ProfitabilityReport {
  summary: ProfitabilitySummary;
  jobs: ProfitabilityJob[];
}

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Completed", value: "done" },
  { label: "In Progress", value: "in_progress" },
  { label: "Invoiced", value: "invoiced" },
];

const dateFilters = [
  { label: "All Time", value: "all" },
  { label: "This Month", value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year", value: "year" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "profitable":
      return { text: "text-green-600 dark:text-green-400", bg: "bg-green-500" };
    case "tight":
      return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" };
    case "loss":
      return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500" };
    default:
      return { text: "text-muted-foreground", bg: "bg-muted-foreground" };
  }
}

export default function ProfitabilityReportPage() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const queryParams: Record<string, string> = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (dateFilter !== "all") {
    const now = new Date();
    let startDate: Date;
    if (dateFilter === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === "quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }
    queryParams.startDate = startDate.toISOString();
    queryParams.endDate = now.toISOString();
  }

  const { data, isLoading } = useQuery<ProfitabilityReport>({
    queryKey: ["/api/reports/profitability", queryParams],
  });

  return (
    <PageShell>
      <PageHeader
        title="Profitability Report"
        subtitle="See which jobs make money and which ones cost you"
        leading={<TrendingUp className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
        action={
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No job data available. Complete some jobs to see profitability analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <DollarSign className="h-3.5 w-3.5" />
                  Total Revenue
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(data.summary.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Total Costs
                </div>
                <p className="text-lg font-semibold text-muted-foreground">
                  {formatCurrency(data.summary.totalCosts)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Net Profit
                </div>
                <p
                  className={`text-lg font-semibold ${
                    data.summary.totalProfit >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(data.summary.totalProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1 flex-wrap">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Average Margin
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-semibold">
                    {data.summary.averageMargin.toFixed(1)}%
                  </p>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      data.summary.averageMargin > 15
                        ? "text-green-600 dark:text-green-400"
                        : data.summary.averageMargin > 5
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {data.summary.jobsProfitable} profitable
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {statusFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f.value)}
                  className="toggle-elevate"
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {dateFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={dateFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter(f.value)}
                  className="toggle-elevate"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {data.jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No job data available. Complete some jobs to see profitability analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.jobs.map((job) => {
                const colors = getStatusColor(job.profitStatus);
                const marginCapped = Math.min(Math.max(job.margin, 0), 100);
                return (
                  <Card
                    key={job.jobId}
                    className={`hover-elevate cursor-pointer ${
                      job.profitStatus === "loss"
                        ? "bg-red-500/5"
                        : job.profitStatus === "tight"
                          ? "bg-amber-500/5"
                          : ""
                    }`}
                    onClick={() => navigate(`/jobs/${job.jobId}`)}
                  >
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {job.status.replace("_", " ")}
                            </Badge>
                            {job.quoted > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Quoted: {formatCurrency(job.quoted)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {job.clientName}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="text-sm font-medium">{formatCurrency(job.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Costs</p>
                          <p className="text-sm font-medium">{formatCurrency(job.costs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Profit</p>
                          <p className={`text-sm font-medium ${colors.text}`}>
                            {formatCurrency(job.profit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Margin</p>
                          <p className={`text-sm font-medium ${colors.text}`}>
                            {job.margin.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${colors.bg}`}
                            style={{ width: `${marginCapped}%` }}
                          />
                        </div>
                        <p className={`text-xs ${colors.text}`}>{job.margin.toFixed(1)}%</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
