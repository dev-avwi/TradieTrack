import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  FileBarChart,
  PieChart,
} from "lucide-react";

interface InsightsProps {
  onNavigate?: (path: string) => void;
}

interface ProfitSnapshot {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  labourCostThisMonth: number;
  materialCostThisMonth: number;
  grossProfit: number;
  grossMargin: number;
  cashCollectedToday: number;
}

interface CashflowData {
  thisMonthCollected: number;
  lastMonthCollected: number;
  dueThisWeek: number;
  overdueTotal: number;
  overdueCount: number;
  overdueBreakdown: any[];
  weeklyCollections: any[];
}

interface KPIData {
  jobsToday: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  quotesAwaiting: number;
  jobsToInvoice: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
}

const tabs = [
  { id: "profit", label: "Profit & Margin", icon: DollarSign },
  { id: "cashflow", label: "Cashflow", icon: BarChart3 },
  { id: "efficiency", label: "Time & Efficiency", icon: Clock },
  { id: "growth", label: "Growth & Clients", icon: Users },
] as const;

type TabId = (typeof tabs)[number]["id"];

const fmtAud = (n: number) =>
  "$" +
  n.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function MetricCard({
  label,
  value,
  icon: Icon,
  context,
  valueColor,
  onClick,
}: {
  label: string;
  value: string;
  icon?: typeof DollarSign;
  context?: string;
  valueColor?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={`hover-elevate ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </p>
            <p
              className="text-2xl font-bold mt-1"
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </p>
            {context && (
              <p className="text-xs text-muted-foreground mt-1">{context}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Icon && (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: "hsl(var(--trade))" }}
                />
              </div>
            )}
            {onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getMarginColor(margin: number): string {
  if (margin > 30) return "hsl(142.1 76.2% 36.3%)";
  if (margin >= 15) return "hsl(38 92% 50%)";
  return "hsl(0 84.2% 60.2%)";
}

export default function Insights({ onNavigate }: InsightsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("profit");
  const searchParams = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tabParam = params.get('tab');
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  const { data: profit, isLoading: profitLoading } = useQuery<ProfitSnapshot>({
    queryKey: ["/api/dashboard/profit-snapshot"],
  });

  const { data: cashflow, isLoading: cashflowLoading } =
    useQuery<CashflowData>({
      queryKey: ["/api/dashboard/cashflow"],
    });

  const { data: kpis, isLoading: kpisLoading } = useQuery<KPIData>({
    queryKey: ["/api/dashboard/kpis"],
  });

  const isLoading = profitLoading || cashflowLoading || kpisLoading;

  const collectionDiff =
    (cashflow?.thisMonthCollected ?? 0) - (cashflow?.lastMonthCollected ?? 0);
  const collectionUp = collectionDiff >= 0;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Business health at a glance
        </p>
      </div>

      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return isActive ? (
            <Button
              key={tab.id}
              size="sm"
              className="text-white font-medium flex-shrink-0"
              style={{ backgroundColor: "hsl(var(--trade))" }}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon className="h-3.5 w-3.5 mr-1.5" />
              {tab.label}
            </Button>
          ) : (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon className="h-3.5 w-3.5 mr-1.5" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <>
          {activeTab === "profit" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard
                label="Revenue This Month"
                value={fmtAud(profit?.revenueThisMonth ?? 0)}
                icon={DollarSign}
                context={`This week: ${fmtAud(profit?.revenueThisWeek ?? 0)}`}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
              />
              <MetricCard
                label="Gross Profit"
                value={fmtAud(profit?.grossProfit ?? 0)}
                icon={TrendingUp}
                onClick={() => onNavigate?.("/profitability-report")}
              />
              <MetricCard
                label="Gross Margin"
                value={`${(profit?.grossMargin ?? 0).toFixed(1)}%`}
                icon={Percent}
                valueColor={getMarginColor(profit?.grossMargin ?? 0)}
                context={
                  (profit?.grossMargin ?? 0) > 30
                    ? "Healthy margin"
                    : (profit?.grossMargin ?? 0) >= 15
                      ? "Room to improve"
                      : "Needs attention"
                }
                onClick={() => onNavigate?.("/profitability-report")}
              />
              <MetricCard
                label="Labour Cost"
                value={fmtAud(profit?.labourCostThisMonth ?? 0)}
                icon={Clock}
                context="This month"
                onClick={() => onNavigate?.("/time-tracking")}
              />
              <MetricCard
                label="Material Cost"
                value={fmtAud(profit?.materialCostThisMonth ?? 0)}
                icon={BarChart3}
                context="This month"
                onClick={() => onNavigate?.("/work")}
              />
            </div>
          )}

          {activeTab === "cashflow" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard
                  label="Cash Collected Today"
                  value={fmtAud(profit?.cashCollectedToday ?? 0)}
                  icon={DollarSign}
                  onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                />
                <MetricCard
                  label="Due This Week"
                  value={fmtAud(cashflow?.dueThisWeek ?? 0)}
                  icon={Clock}
                  onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                />
                <div className="relative">
                  <MetricCard
                    label="Overdue Total"
                    value={fmtAud(cashflow?.overdueTotal ?? 0)}
                    icon={TrendingDown}
                    valueColor={
                      (cashflow?.overdueTotal ?? 0) > 0
                        ? "hsl(0 84.2% 60.2%)"
                        : undefined
                    }
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=overdue")}
                  />
                  {(cashflow?.overdueCount ?? 0) > 0 && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                        {cashflow?.overdueCount} overdue
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              <Card className="cursor-pointer hover-elevate" onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    This Month vs Last Month
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        This month
                      </p>
                      <p className="text-xl font-bold">
                        {fmtAud(cashflow?.thisMonthCollected ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {collectionUp ? (
                        <ArrowUpRight
                          className="h-5 w-5"
                          style={{ color: "hsl(142.1 76.2% 36.3%)" }}
                        />
                      ) : (
                        <ArrowDownRight
                          className="h-5 w-5"
                          style={{ color: "hsl(0 84.2% 60.2%)" }}
                        />
                      )}
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: collectionUp
                            ? "hsl(142.1 76.2% 36.3%)"
                            : "hsl(0 84.2% 60.2%)",
                        }}
                      >
                        {fmtAud(Math.abs(collectionDiff))}
                      </span>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm text-muted-foreground">
                        Last month
                      </p>
                      <p className="text-xl font-bold">
                        {fmtAud(cashflow?.lastMonthCollected ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard
                label="Jobs Today"
                value={String(kpis?.jobsToday ?? 0)}
                icon={Clock}
                onClick={() => onNavigate?.("/work")}
              />
              <MetricCard
                label="Weekly Earnings"
                value={fmtAud(kpis?.weeklyEarnings ?? 0)}
                icon={TrendingUp}
                onClick={() => onNavigate?.("/time-tracking")}
              />
              <MetricCard
                label="Monthly Earnings"
                value={fmtAud(kpis?.monthlyEarnings ?? 0)}
                icon={DollarSign}
                onClick={() => onNavigate?.("/time-tracking")}
              />
              <MetricCard
                label="Jobs to Invoice"
                value={String(kpis?.jobsToInvoice ?? 0)}
                icon={BarChart3}
                valueColor={
                  (kpis?.jobsToInvoice ?? 0) > 0
                    ? "hsl(38 92% 50%)"
                    : undefined
                }
                context={
                  (kpis?.jobsToInvoice ?? 0) > 0
                    ? "Completed, not yet invoiced"
                    : "All caught up"
                }
                onClick={() => onNavigate?.("/work")}
              />
            </div>
          )}

          {activeTab === "growth" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard
                label="Quotes Awaiting"
                value={String(kpis?.quotesAwaiting ?? 0)}
                icon={Users}
                context="Sent, awaiting response"
                onClick={() => onNavigate?.("/documents?tab=quotes")}
              />
              <MetricCard
                label="Unpaid Invoices"
                value={String(kpis?.unpaidInvoicesCount ?? 0)}
                icon={DollarSign}
                context={fmtAud(kpis?.unpaidInvoicesTotal ?? 0) + " total"}
                valueColor={
                  (kpis?.unpaidInvoicesCount ?? 0) > 0
                    ? "hsl(0 84.2% 60.2%)"
                    : undefined
                }
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
          Detailed Reports
        </p>
        <div className="space-y-2">
          <Card
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.("/reports/profitability")}
          >
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PieChart className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Profitability Report</p>
                    <p className="text-xs text-muted-foreground">By job, client, and worker</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.("/reports")}
          >
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileBarChart className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">All Reports</p>
                    <p className="text-xs text-muted-foreground">Financials, activity, and exports</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
