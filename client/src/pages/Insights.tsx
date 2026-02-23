import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

function HeroMetricCard({
  label,
  value,
  icon: Icon,
  context,
  valueColor,
  onClick,
  animClass,
}: {
  label: string;
  value: string;
  icon?: typeof DollarSign;
  context?: string;
  valueColor?: string;
  onClick?: () => void;
  animClass?: string;
}) {
  return (
    <div
      className={`feed-card card-press ${onClick ? "cursor-pointer" : ""} ${animClass || ""}`}
      style={{ opacity: animClass ? 0 : 1 }}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="ios-label">{label}</p>
            <p
              className="text-[32px] sm:text-[36px] font-bold tracking-tight mt-1.5 leading-none"
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </p>
            {context && (
              <p className="ios-caption mt-2">{context}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Icon && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: "hsl(var(--trade))" }}
                />
              </div>
            )}
            {onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  context,
  valueColor,
  onClick,
  animClass,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon?: typeof DollarSign;
  context?: string;
  valueColor?: string;
  onClick?: () => void;
  animClass?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div
      className={`feed-card card-press ${onClick ? "cursor-pointer" : ""} ${animClass || ""}`}
      style={{ opacity: animClass ? 0 : 1 }}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="ios-label">{label}</p>
            <p
              className="text-2xl font-bold mt-1"
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </p>
            {context && (
              <p className="ios-caption mt-1">{context}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Icon && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: iconBg || "hsl(var(--trade) / 0.1)" }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: iconColor || "hsl(var(--trade))" }}
                />
              </div>
            )}
            {onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="section-gap">
      <div className="feed-card p-5">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="feed-card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
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
    <div className="w-full px-4 sm:px-5 md:px-6 lg:px-8 py-5 sm:py-6 section-gap pb-28 md:pb-6">
      <div className="space-y-1">
        <h1 className="ios-title">Insights</h1>
        <p className="ios-caption mt-0.5">Business health at a glance</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return isActive ? (
            <Button
              key={tab.id}
              size="sm"
              className="text-white font-medium flex-shrink-0"
              style={{ backgroundColor: "hsl(var(--trade))", borderColor: "hsl(var(--trade))" }}
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
            <div className="section-gap">
              <HeroMetricCard
                label="REVENUE THIS MONTH"
                value={fmtAud(profit?.revenueThisMonth ?? 0)}
                icon={DollarSign}
                context={`This week: ${fmtAud(profit?.revenueThisWeek ?? 0)}`}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div>
                <p className="ios-label mb-3">MARGINS & COSTS</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="GROSS PROFIT"
                    value={fmtAud(profit?.grossProfit ?? 0)}
                    icon={TrendingUp}
                    valueColor="hsl(142.1 76.2% 36.3%)"
                    onClick={() => onNavigate?.("/profitability-report")}
                    animClass="animate-fade-up stagger-delay-2"
                    iconBg="hsl(142.1 76.2% 36.3% / 0.1)"
                    iconColor="hsl(142.1 76.2% 36.3%)"
                  />
                  <MetricCard
                    label="GROSS MARGIN"
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
                    animClass="animate-fade-up stagger-delay-3"
                    iconBg={`${getMarginColor(profit?.grossMargin ?? 0).replace(")", " / 0.1)")}`}
                    iconColor={getMarginColor(profit?.grossMargin ?? 0)}
                  />
                  <MetricCard
                    label="LABOUR COST"
                    value={fmtAud(profit?.labourCostThisMonth ?? 0)}
                    icon={Clock}
                    context="This month"
                    onClick={() => onNavigate?.("/time-tracking")}
                    animClass="animate-fade-up stagger-delay-4"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                  <MetricCard
                    label="MATERIAL COST"
                    value={fmtAud(profit?.materialCostThisMonth ?? 0)}
                    icon={BarChart3}
                    context="This month"
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-5"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "cashflow" && (
            <div className="section-gap">
              <HeroMetricCard
                label="CASH COLLECTED TODAY"
                value={fmtAud(profit?.cashCollectedToday ?? 0)}
                icon={DollarSign}
                onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div>
                <p className="ios-label mb-3">OUTSTANDING</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="DUE THIS WEEK"
                    value={fmtAud(cashflow?.dueThisWeek ?? 0)}
                    icon={Clock}
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                    animClass="animate-fade-up stagger-delay-2"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                  <div className="relative">
                    <MetricCard
                      label="OVERDUE TOTAL"
                      value={fmtAud(cashflow?.overdueTotal ?? 0)}
                      icon={TrendingDown}
                      valueColor={
                        (cashflow?.overdueTotal ?? 0) > 0
                          ? "hsl(0 84.2% 60.2%)"
                          : undefined
                      }
                      onClick={() => onNavigate?.("/documents?tab=invoices&filter=overdue")}
                      animClass="animate-fade-up stagger-delay-3"
                      iconBg="hsl(0 84.2% 60.2% / 0.1)"
                      iconColor="hsl(0 84.2% 60.2%)"
                    />
                    {(cashflow?.overdueCount ?? 0) > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                          {cashflow?.overdueCount} overdue
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="ios-label mb-3">MONTH COMPARISON</p>
                <div
                  className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-4"
                  style={{ opacity: 0 }}
                  onClick={() => onNavigate?.("/documents?tab=invoices&filter=paid")}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="ios-label mb-1">THIS MONTH</p>
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
                        <p className="ios-label mb-1">LAST MONTH</p>
                        <p className="text-xl font-bold">
                          {fmtAud(cashflow?.lastMonthCollected ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "efficiency" && (
            <div className="section-gap">
              <HeroMetricCard
                label="MONTHLY EARNINGS"
                value={fmtAud(kpis?.monthlyEarnings ?? 0)}
                icon={DollarSign}
                onClick={() => onNavigate?.("/time-tracking")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div>
                <p className="ios-label mb-3">ACTIVITY</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="JOBS TODAY"
                    value={String(kpis?.jobsToday ?? 0)}
                    icon={Clock}
                    onClick={() => onNavigate?.("/work")}
                    animClass="animate-fade-up stagger-delay-2"
                  />
                  <MetricCard
                    label="WEEKLY EARNINGS"
                    value={fmtAud(kpis?.weeklyEarnings ?? 0)}
                    icon={TrendingUp}
                    onClick={() => onNavigate?.("/time-tracking")}
                    animClass="animate-fade-up stagger-delay-3"
                    iconBg="hsl(142.1 76.2% 36.3% / 0.1)"
                    iconColor="hsl(142.1 76.2% 36.3%)"
                  />
                  <MetricCard
                    label="JOBS TO INVOICE"
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
                    animClass="animate-fade-up stagger-delay-4"
                    iconBg="hsl(38 92% 50% / 0.1)"
                    iconColor="hsl(38 92% 50%)"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "growth" && (
            <div className="section-gap">
              <HeroMetricCard
                label="QUOTES AWAITING"
                value={String(kpis?.quotesAwaiting ?? 0)}
                icon={Users}
                context="Sent, awaiting response"
                onClick={() => onNavigate?.("/documents?tab=quotes")}
                animClass="animate-fade-up stagger-delay-1"
              />

              <div>
                <p className="ios-label mb-3">RECEIVABLES</p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="UNPAID INVOICES"
                    value={String(kpis?.unpaidInvoicesCount ?? 0)}
                    icon={DollarSign}
                    context={fmtAud(kpis?.unpaidInvoicesTotal ?? 0) + " total"}
                    valueColor={
                      (kpis?.unpaidInvoicesCount ?? 0) > 0
                        ? "hsl(0 84.2% 60.2%)"
                        : undefined
                    }
                    onClick={() => onNavigate?.("/documents?tab=invoices&filter=unpaid")}
                    animClass="animate-fade-up stagger-delay-2"
                    iconBg="hsl(0 84.2% 60.2% / 0.1)"
                    iconColor="hsl(0 84.2% 60.2%)"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <p className="ios-label mb-3">DETAILED REPORTS</p>
        <div className="feed-gap">
          <div
            className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-6"
            style={{ opacity: 0 }}
            onClick={() => onNavigate?.("/reports/profitability")}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                  >
                    <PieChart className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Profitability Report</p>
                    <p className="ios-caption">By job, client, and worker</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          </div>
          <div
            className="feed-card card-press cursor-pointer animate-fade-up stagger-delay-7"
            style={{ opacity: 0 }}
            onClick={() => onNavigate?.("/reports")}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                  >
                    <FileBarChart className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">All Reports</p>
                    <p className="ios-caption">Financials, activity, and exports</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
