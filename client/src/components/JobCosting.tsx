import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Package, 
  AlertTriangle,
  CheckCircle,
  Target
} from "lucide-react";

interface JobCostingData {
  jobId: string;
  jobTitle: string;
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
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
  }>;
  timeEntries: Array<{
    id: string;
    description: string;
    hours: number;
    rate: number;
    cost: number;
    date: string;
  }>;
}

interface JobCostingProps {
  jobId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  }).format(amount);
}

function CostComparisonBar({ 
  label, 
  estimated, 
  actual, 
  icon: Icon 
}: { 
  label: string; 
  estimated: number; 
  actual: number;
  icon: any;
}) {
  const percentUsed = estimated > 0 ? (actual / estimated) * 100 : 0;
  const isOverBudget = actual > estimated && estimated > 0;
  const remaining = estimated - actual;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold">{formatCurrency(actual)}</span>
          {estimated > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              / {formatCurrency(estimated)}
            </span>
          )}
        </div>
      </div>
      {estimated > 0 && (
        <>
          <Progress 
            value={Math.min(percentUsed, 100)} 
            className={`h-2 ${isOverBudget ? '[&>div]:bg-destructive' : ''}`}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isOverBudget ? (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formatCurrency(Math.abs(remaining))} over budget
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {formatCurrency(remaining)} remaining
                </span>
              )}
            </span>
            <span>{percentUsed.toFixed(0)}% used</span>
          </div>
        </>
      )}
    </div>
  );
}

function ProfitIndicator({ profit, margin }: { profit: number; margin: number }) {
  const isProfit = profit >= 0;
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      isProfit 
        ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' 
        : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProfit ? (
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium">
            {isProfit ? 'Profit' : 'Loss'}
          </span>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${
            isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(Math.abs(profit))}
          </div>
          <div className="text-sm text-muted-foreground">
            {margin.toFixed(1)}% margin
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobCosting({ jobId }: JobCostingProps) {
  const { data: costingData, isLoading, error } = useQuery<JobCostingData>({
    queryKey: ['/api/jobs', jobId, 'profitability'],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-job-costing">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Job Costing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !costingData) {
    return (
      <Card data-testid="card-job-costing">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Job Costing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No costing data available yet. Track time and expenses to see profitability.
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEstimates = costingData.estimates && 
    (costingData.estimates.laborCost > 0 || costingData.estimates.materialCost > 0);

  const totalRevenue = costingData.revenue.invoiced + costingData.revenue.pending;
  const hasCosts = costingData.costs.total > 0;
  const hasRevenue = totalRevenue > 0;

  return (
    <Card data-testid="card-job-costing">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Job Costing
          </div>
          {hasRevenue && (
            <Badge 
              variant="secondary" 
              className={costingData.profit.amount >= 0 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }
              data-testid="badge-profit-margin"
            >
              {costingData.profit.margin.toFixed(1)}% margin
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasRevenue && (
          <ProfitIndicator 
            profit={costingData.profit.amount} 
            margin={costingData.profit.margin} 
          />
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Revenue</span>
          </div>
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div>
              <div className="text-xs text-muted-foreground">Invoiced (Paid)</div>
              <div className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="text-revenue-paid">
                {formatCurrency(costingData.revenue.invoiced)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-lg font-semibold text-amber-600 dark:text-amber-400" data-testid="text-revenue-pending">
                {formatCurrency(costingData.revenue.pending)}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <CostComparisonBar
            label="Labor Cost"
            estimated={costingData.estimates?.laborCost || 0}
            actual={costingData.costs.labor}
            icon={Clock}
          />
          <CostComparisonBar
            label="Materials Cost"
            estimated={costingData.estimates?.materialCost || 0}
            actual={costingData.costs.materials}
            icon={Package}
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between py-2">
            <span className="font-medium">Total Costs</span>
            <div className="text-right">
              <span className="font-bold text-lg" data-testid="text-total-costs">
                {formatCurrency(costingData.costs.total)}
              </span>
              {hasEstimates && (
                <div className="text-xs text-muted-foreground">
                  Est: {formatCurrency(costingData.estimates!.totalCost)}
                </div>
              )}
            </div>
          </div>
        </div>

        {costingData.expenses.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Expenses ({costingData.expenses.length})</span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {costingData.expenses.slice(0, 5).map((expense) => (
                <div 
                  key={expense.id} 
                  className="flex items-center justify-between text-sm py-1"
                  data-testid={`expense-${expense.id}`}
                >
                  <div className="truncate flex-1 pr-2">
                    <span className="text-muted-foreground">{expense.description}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {expense.category}
                    </Badge>
                  </div>
                  <span className="font-medium">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
              {costingData.expenses.length > 5 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  +{costingData.expenses.length - 5} more expenses
                </div>
              )}
            </div>
          </div>
        )}

        {costingData.timeEntries.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Time Tracked ({costingData.timeEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h)
              </span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {costingData.timeEntries.slice(0, 5).map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between text-sm py-1"
                  data-testid={`time-entry-${entry.id}`}
                >
                  <div className="truncate flex-1 pr-2">
                    <span className="text-muted-foreground">
                      {entry.description || 'Time tracked'}
                    </span>
                    <span className="text-xs ml-2">
                      ({entry.hours.toFixed(1)}h @ {formatCurrency(entry.rate)}/h)
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(entry.cost)}</span>
                </div>
              ))}
              {costingData.timeEntries.length > 5 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  +{costingData.timeEntries.length - 5} more entries
                </div>
              )}
            </div>
          </div>
        )}

        {!hasCosts && !hasRevenue && (
          <div className="text-sm text-muted-foreground text-center py-4 border-t">
            No costs or revenue recorded yet. Track time and add expenses to monitor profitability.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default JobCosting;
