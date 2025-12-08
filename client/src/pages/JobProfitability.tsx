import { useQuery } from "@tanstack/react-query";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  Briefcase,
  Clock,
  Package,
  Target,
  AlertTriangle
} from "lucide-react";

interface JobProfitabilityData {
  jobId: string;
  jobTitle: string;
  clientName?: string;
  status: string;
  revenue: {
    invoiced: number;
    pending: number;
  };
  costs: {
    materials: number;
    labor: number;
    total: number;
  };
  profit: {
    amount: number;
    margin: number;
  };
  estimates?: {
    laborCost: number;
    materialCost: number;
    totalCost: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function JobProfitabilityCard({ job, onClick }: { job: JobProfitabilityData; onClick: () => void }) {
  const totalRevenue = job.revenue.invoiced + job.revenue.pending;
  const hasRevenue = totalRevenue > 0;
  const hasCosts = job.costs.total > 0;
  const isOverBudget = job.estimates && job.costs.total > job.estimates.totalCost && job.estimates.totalCost > 0;
  
  return (
    <Card 
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`card-job-profitability-${job.jobId}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold truncate">{job.jobTitle}</CardTitle>
            {job.clientName && (
              <p className="text-xs text-muted-foreground truncate">{job.clientName}</p>
            )}
          </div>
          {hasRevenue && (
            <Badge 
              variant="secondary" 
              className={`text-xs shrink-0 ${
                job.profit.amount >= 0 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }`}
            >
              {job.profit.margin.toFixed(0)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(totalRevenue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Costs</div>
            <div className={`font-semibold ${isOverBudget ? 'text-red-600 dark:text-red-400' : ''}`}>
              {formatCurrency(job.costs.total)}
            </div>
          </div>
        </div>
        
        {hasRevenue && (
          <div className={`flex items-center justify-between text-sm p-2 rounded ${
            job.profit.amount >= 0 
              ? 'bg-green-50 dark:bg-green-950' 
              : 'bg-red-50 dark:bg-red-950'
          }`}>
            <span className="text-muted-foreground">Profit:</span>
            <span className={`font-bold ${
              job.profit.amount >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(job.profit.amount)}
            </span>
          </div>
        )}
        
        {isOverBudget && (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Over budget by {formatCurrency(job.costs.total - (job.estimates?.totalCost || 0))}</span>
          </div>
        )}
        
        {!hasRevenue && !hasCosts && (
          <div className="text-xs text-muted-foreground text-center py-2">
            No revenue or costs recorded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobProfitability() {
  const [, navigate] = useLocation();
  
  const { data: jobs, isLoading } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });
  
  const { data: profitabilityData, isLoading: profitLoading } = useQuery<JobProfitabilityData[]>({
    queryKey: ['/api/reports/job-profitability'],
    enabled: !!jobs && jobs.length > 0,
  });
  
  const isDataLoading = isLoading || profitLoading;

  const summaryStats = profitabilityData ? {
    totalRevenue: profitabilityData.reduce((sum, j) => sum + j.revenue.invoiced + j.revenue.pending, 0),
    totalCosts: profitabilityData.reduce((sum, j) => sum + j.costs.total, 0),
    totalProfit: profitabilityData.reduce((sum, j) => sum + j.profit.amount, 0),
    profitableJobs: profitabilityData.filter(j => j.profit.amount > 0).length,
    unprofitableJobs: profitabilityData.filter(j => j.profit.amount < 0).length,
    overBudgetJobs: profitabilityData.filter(j => 
      j.estimates && j.costs.total > j.estimates.totalCost && j.estimates.totalCost > 0
    ).length,
  } : null;

  const averageMargin = profitabilityData && profitabilityData.length > 0
    ? profitabilityData.reduce((sum, j) => sum + j.profit.margin, 0) / profitabilityData.length
    : 0;

  return (
    <PageShell data-testid="page-job-profitability">
      <PageHeader
        title="Job Profitability"
        subtitle="Track estimated vs actual costs and profit margins across all jobs"
      />

      <div className="space-y-6">
        {isDataLoading ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </>
        ) : summaryStats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-xs">Total Revenue</span>
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-revenue">
                    {formatCurrency(summaryStats.totalRevenue)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Package className="h-4 w-4" />
                    <span className="text-xs">Total Costs</span>
                  </div>
                  <div className="text-xl font-bold" data-testid="text-total-costs">
                    {formatCurrency(summaryStats.totalCosts)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    {summaryStats.totalProfit >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-xs">Total Profit</span>
                  </div>
                  <div className={`text-xl font-bold ${
                    summaryStats.totalProfit >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`} data-testid="text-total-profit">
                    {formatCurrency(summaryStats.totalProfit)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">Avg Margin</span>
                  </div>
                  <div className={`text-xl font-bold ${
                    averageMargin >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`} data-testid="text-avg-margin">
                    {averageMargin.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {summaryStats.profitableJobs} profitable
              </Badge>
              {summaryStats.unprofitableJobs > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                  {summaryStats.unprofitableJobs} unprofitable
                </Badge>
              )}
              {summaryStats.overBudgetJobs > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  {summaryStats.overBudgetJobs} over budget
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profitabilityData?.map(job => (
                <JobProfitabilityCard 
                  key={job.jobId} 
                  job={job} 
                  onClick={() => navigate(`/jobs/${job.jobId}`)}
                />
              ))}
            </div>
            
            {(!profitabilityData || profitabilityData.length === 0) && (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No job profitability data available yet.</p>
                    <p className="text-sm mt-1">Start tracking time and expenses on jobs to see profitability metrics.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No jobs found.</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => navigate('/jobs/new')}
                >
                  Create Your First Job
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
