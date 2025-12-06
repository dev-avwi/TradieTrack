import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { 
  TimerWidget, 
  TimesheetList, 
  TimeTrackingDashboard 
} from "@/components/TimeTracking";
import { 
  Clock, 
  Calendar, 
  FileText, 
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Briefcase
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Payroll Reporting Component
function PayrollReporting() {
  const [reportType, setReportType] = useState<'detailed' | 'summary'>('summary');
  const [period, setPeriod] = useState<'current' | 'previous'>('current');

  const { data: payrollData, isLoading, error } = useQuery({
    queryKey: ['/api/time-tracking/reports/payroll', reportType, period],
    queryFn: async () => {
      const params = new URLSearchParams({
        format: reportType,
        period: period,
      });
      const res = await fetch(`/api/time-tracking/reports/payroll?${params}`);
      if (!res.ok) throw new Error('Failed to fetch payroll data');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-payroll-loading">
        <CardHeader>
          <CardTitle>Payroll Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-payroll-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load payroll data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card data-testid="card-payroll-report">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Payroll Report
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={reportType === 'summary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('summary')}
              data-testid="button-report-summary"
            >
              Summary
            </Button>
            <Button
              variant={reportType === 'detailed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('detailed')}
              data-testid="button-report-detailed"
            >
              Detailed
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={period === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('current')}
              data-testid="button-period-current"
            >
              <span className="sm:hidden">This Week</span>
              <span className="hidden sm:inline">Current Week</span>
            </Button>
            <Button
              variant={period === 'previous' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('previous')}
              data-testid="button-period-previous"
            >
              <span className="sm:hidden">Last Week</span>
              <span className="hidden sm:inline">Previous Week</span>
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <Button variant="outline" size="sm" data-testid="button-export-payroll">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {payrollData && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Hours</div>
                <div className="text-2xl font-bold" data-testid="text-total-hours">
                  {payrollData.totalHours?.toFixed(1) || '0.0'}h
                </div>
                {payrollData.overtimeHours > 0 && (
                  <div className="text-sm text-warning">
                    +{payrollData.overtimeHours.toFixed(1)}h overtime
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Earnings</div>
                <div className="text-2xl font-bold text-success" data-testid="text-total-earnings">
                  ${payrollData.totalEarnings?.toFixed(2) || '0.00'}
                </div>
                {payrollData.overtimeEarnings > 0 && (
                  <div className="text-sm text-success">
                    +${payrollData.overtimeEarnings.toFixed(2)} overtime
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Average Rate</div>
                <div className="text-2xl font-bold" data-testid="text-average-rate">
                  ${payrollData.averageRate?.toFixed(0) || '0'}/hr
                </div>
                <div className="text-sm text-muted-foreground">
                  Across {payrollData.jobsWorked || 0} jobs
                </div>
              </div>
            </div>

            {/* Job Breakdown */}
            {payrollData.jobBreakdown && payrollData.jobBreakdown.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Job Breakdown</h4>
                <div className="space-y-2">
                  {payrollData.jobBreakdown.map((job: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border rounded"
                      data-testid={`row-job-breakdown-${index}`}
                    >
                      <div>
                        <div className="font-medium" data-testid={`text-job-title-${index}`}>
                          {job.jobTitle || 'General Work'}
                        </div>
                        {job.clientName && (
                          <div className="text-sm text-muted-foreground" data-testid={`text-client-name-${index}`}>
                            {job.clientName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`text-job-hours-${index}`}>
                          {job.hours?.toFixed(1)}h
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-job-earnings-${index}`}>
                          ${job.earnings?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Time Tracking Analytics Component
function TimeTrackingAnalytics() {
  const { data: timesheets, isLoading } = useQuery<any[]>({
    queryKey: ['/api/timesheets', 'includeEntries'],
    queryFn: async () => {
      const res = await fetch('/api/timesheets?includeEntries=true');
      if (!res.ok) throw new Error('Failed to fetch timesheets');
      return res.json();
    },
  });

  const { data: timeEntries } = useQuery<any[]>({
    queryKey: ['/api/time-entries'],
    queryFn: async () => {
      const res = await fetch('/api/time-entries');
      if (!res.ok) throw new Error('Failed to fetch time entries');
      return res.json();
    },
  });

  const CHART_COLORS = ['hsl(var(--trade))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const getWeeklyTrendsData = () => {
    if (!timesheets || timesheets.length === 0) {
      const now = new Date();
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = subWeeks(now, 3 - i);
        return {
          week: format(weekStart, 'MMM d'),
          hours: 0,
          earnings: 0,
        };
      });
    }

    const sortedSheets = [...timesheets]
      .sort((a, b) => new Date(a.weekStarting).getTime() - new Date(b.weekStarting).getTime())
      .slice(-4);

    return sortedSheets.map((sheet) => ({
      week: format(new Date(sheet.weekStarting), 'MMM d'),
      hours: sheet.aggregations?.totalHours || sheet.totalHours || 0,
      earnings: sheet.aggregations?.totalEarnings || 0,
    }));
  };

  const getJobDistributionData = () => {
    if (!timeEntries || timeEntries.length === 0) {
      return [
        { name: 'No data', value: 1, color: 'hsl(var(--muted))' }
      ];
    }

    const jobHours: Record<string, { name: string; hours: number }> = {};
    
    timeEntries.forEach((entry: any) => {
      const jobTitle = entry.jobTitle || 'General Work';
      if (!jobHours[jobTitle]) {
        jobHours[jobTitle] = { name: jobTitle, hours: 0 };
      }
      jobHours[jobTitle].hours += (entry.duration || 0) / 60;
    });

    const sorted = Object.values(jobHours)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    if (sorted.length === 0) {
      return [{ name: 'No data', value: 1, color: 'hsl(var(--muted))' }];
    }

    return sorted.map((job, index) => ({
      name: job.name,
      value: Math.round(job.hours * 10) / 10,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  };

  const weeklyData = getWeeklyTrendsData();
  const jobData = getJobDistributionData();
  
  // Compute totals from ALL timesheets, not just the chart data
  const totalHoursTracked = timesheets?.reduce((sum, sheet: any) => {
    return sum + (sheet.aggregations?.totalHours || sheet.totalHours || 0);
  }, 0) || 0;
  
  const totalEarnings = timesheets?.reduce((sum, sheet: any) => {
    return sum + (sheet.aggregations?.totalEarnings || 0);
  }, 0) || 0;

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-weekly-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
        <Card data-testid="card-job-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Job Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Clock className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">All Time Hours</p>
              <p className="text-2xl font-bold" data-testid="text-total-hours-analytics">
                {totalHoursTracked.toFixed(1)}h
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}
            >
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Earnings</p>
              <p className="text-2xl font-bold text-success" data-testid="text-total-earnings-analytics">
                ${totalEarnings.toFixed(0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-weekly-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Weekly Hours Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Hours']}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="hsl(var(--trade))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-job-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Time by Job
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {jobData[0]?.name === 'No data' ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Briefcase className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No time entries recorded yet</p>
                  <p className="text-xs mt-1">Start tracking time to see job distribution</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${value}h`}
                      labelLine={false}
                    >
                      {jobData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} hours`, 'Time']}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main Time Tracking Page
export default function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState('timer');

  return (
    <PageShell data-testid="page-time-tracking">
      <PageHeader
        title="Time Tracking"
        subtitle="Track your work hours and manage timesheets"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        }
      />

      {/* Dashboard Stats */}
      <TimeTrackingDashboard />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-16 p-1">
          <TabsTrigger value="timer" data-testid="tab-timer" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <Clock className="h-3.5 w-3.5" />
            <span className="leading-none">Timer</span>
          </TabsTrigger>
          <TabsTrigger value="timesheet" data-testid="tab-timesheet" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <Calendar className="h-3.5 w-3.5" />
            <span className="leading-none">Sheet</span>
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <FileText className="h-3.5 w-3.5" />
            <span className="leading-none">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs h-full">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="leading-none">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <TimerWidget />
            <Card className="hover-elevate">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" data-testid="button-start-break">
                  <Clock className="h-4 w-4 mr-2" />
                  Start Break Timer
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-edit-rates">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Edit Hourly Rates
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-view-active">
                  <Calendar className="h-4 w-4 mr-2" />
                  View All Active Timers
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <TimesheetList limit={5} />
        </TabsContent>

        <TabsContent value="timesheet" className="space-y-6">
          <TimesheetList limit={50} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <PayrollReporting />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <TimeTrackingAnalytics />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}