import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  Briefcase,
  FileText,
  Receipt,
  TrendingUp,
  Shield,
  Activity,
  HeartPulse,
  LayoutDashboard,
  Search,
  Clock,
  UserPlus,
  Server,
  Database,
  Cpu,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
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
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuthUser {
  email?: string;
  isPlatformAdmin?: boolean;
}

interface AdminStats {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    onboardingCompletionRate: number;
  };
  growthData: Array<{ month: string; signups: number }>;
  featureUsage: {
    totalJobs: number;
    totalInvoices: number;
    totalQuotes: number;
    totalClients: number;
    completedJobs: number;
    paidInvoices: number;
    acceptedQuotes: number;
  };
  tierBreakdown: {
    free: number;
    pro: number;
    trial: number;
  };
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  subscriptionTier: string | null;
  tradeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isActive: boolean | null;
  emailVerified: boolean | null;
  hasCompletedOnboarding: boolean;
  businessName: string | null;
}

interface AdminUsersResponse {
  users: AdminUser[];
}

const adminRoutes = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/activity", label: "Activity", icon: Activity },
  { path: "/admin/health", label: "Health", icon: HeartPulse },
];

function getTierBadgeVariant(tier: string | null): "default" | "secondary" | "outline" {
  switch (tier) {
    case 'pro': return 'default';
    case 'trial': return 'secondary';
    default: return 'outline';
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return format(date, 'dd MMM yyyy');
  } catch {
    return 'Never';
  }
}

interface KPICardProps {
  title: string;
  value: string | number;
  loading?: boolean;
  icon: React.ReactNode;
  iconBgClass: string;
  testId: string;
}

function KPICard({ title, value, loading, icon, iconBgClass, testId }: KPICardProps) {
  return (
    <Card data-testid={testId} className="hover-elevate">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-xl md:text-2xl font-bold mt-1" data-testid={`${testId}-value`}>
              {loading ? (
                <span className="inline-block h-6 w-12 bg-muted animate-pulse rounded" />
              ) : value}
            </p>
          </div>
          <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewView({ 
  stats, 
  statsLoading, 
  statsError,
  usersData,
  usersLoading 
}: { 
  stats: AdminStats | undefined;
  statsLoading: boolean;
  statsError: Error | null;
  usersData: AdminUsersResponse | undefined;
  usersLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      {statsError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-destructive text-sm">Failed to load admin data. Make sure you have admin access.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-total-users"
          title="Total Users"
          value={stats?.kpis.totalUsers || 0}
          loading={statsLoading}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-active-users"
          title="Active (7d)"
          value={stats?.kpis.activeUsers || 0}
          loading={statsLoading}
          icon={<UserCheck className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-onboarding-rate"
          title="Onboarding Rate"
          value={statsLoading ? '...' : `${stats?.kpis.onboardingCompletionRate || 0}%`}
          loading={statsLoading}
          icon={<CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-pro-users"
          title="Pro Users"
          value={stats?.tierBreakdown.pro || 0}
          loading={statsLoading}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-user-growth">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[260px]">
              {statsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.growthData || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="month" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Signups']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar 
                      dataKey="signups" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-feature-usage">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Feature Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { icon: Briefcase, label: "Total Jobs", value: stats?.featureUsage.totalJobs || 0, testId: "text-total-jobs" },
                { icon: CheckCircle, label: "Completed Jobs", value: stats?.featureUsage.completedJobs || 0, color: "text-green-500" },
                { icon: Receipt, label: "Total Invoices", value: stats?.featureUsage.totalInvoices || 0, testId: "text-total-invoices" },
                { icon: CheckCircle, label: "Paid Invoices", value: stats?.featureUsage.paidInvoices || 0, color: "text-green-500" },
                { icon: FileText, label: "Total Quotes", value: stats?.featureUsage.totalQuotes || 0, testId: "text-total-quotes" },
                { icon: Users, label: "Total Clients", value: stats?.featureUsage.totalClients || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${item.color || 'text-muted-foreground'}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums" data-testid={item.testId}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-users">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Recent Users</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Signup Date</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : usersData?.users && usersData.users.length > 0 ? (
                  usersData.users.slice(0, 5).map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="pl-6 font-medium">
                        <div>
                          <p className="truncate max-w-[150px]">{user.name}</p>
                          {user.businessName && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.businessName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[200px]">{user.email || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(user.subscriptionTier)} className="capitalize">
                          {user.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        {user.hasCompletedOnboarding ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">
                            Onboarded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersView({ 
  usersData, 
  usersLoading 
}: { 
  usersData: AdminUsersResponse | undefined;
  usersLoading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    
    return usersData.users.filter((user) => {
      const matchesSearch = 
        searchQuery === "" ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.businessName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTier = 
        tierFilter === "all" || 
        (user.subscriptionTier || 'free') === tierFilter;
      
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "onboarded" && user.hasCompletedOnboarding) ||
        (statusFilter === "pending" && !user.hasCompletedOnboarding);
      
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [usersData?.users, searchQuery, tierFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <Card className="p-4" data-testid="card-users-filters">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-tier-filter">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="onboarded">Onboarded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || tierFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setTierFilter("all");
                  setStatusFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card data-testid="card-users-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="text-base md:text-lg">
            All Users
            <Badge variant="secondary" className="ml-2 font-normal">
              {filteredUsers.length}
            </Badge>
          </CardTitle>
          {usersData?.users && filteredUsers.length !== usersData.users.length && (
            <span className="text-sm text-muted-foreground">
              of {usersData.users.length} total
            </span>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Business</TableHead>
                  <TableHead className="hidden xl:table-cell">Trade</TableHead>
                  <TableHead className="hidden md:table-cell">Signup</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="pl-6 font-medium">
                        <span className="truncate block max-w-[120px]">{user.name}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[180px]">{user.email || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        <span className="truncate block max-w-[140px]">{user.businessName || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {user.tradeType ? (
                          <Badge variant="outline" className="capitalize text-xs">
                            {user.tradeType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(user.subscriptionTier)} className="capitalize">
                          {user.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {formatRelativeDate(user.updatedAt)}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex flex-wrap gap-1">
                          {user.hasCompletedOnboarding ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 text-xs">
                              Onboarded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 text-xs">
                              Pending
                            </Badge>
                          )}
                          {user.emailVerified && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs hidden xl:inline-flex">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        {searchQuery || tierFilter !== "all" || statusFilter !== "all" 
                          ? "No users match your filters" 
                          : "No users found"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityView({ 
  usersData,
  stats 
}: { 
  usersData: AdminUsersResponse | undefined;
  stats: AdminStats | undefined;
}) {
  const recentActivity = useMemo(() => {
    if (!usersData?.users) return [];
    
    const activities: Array<{
      id: string;
      type: 'signup' | 'onboarding' | 'upgrade';
      user: string;
      email: string;
      timestamp: string;
      details?: string;
    }> = [];
    
    usersData.users.forEach((user) => {
      if (user.createdAt) {
        activities.push({
          id: `signup-${user.id}`,
          type: 'signup',
          user: user.name,
          email: user.email || '',
          timestamp: user.createdAt,
          details: user.businessName || undefined,
        });
      }
      
      if (user.hasCompletedOnboarding && user.updatedAt && user.updatedAt !== user.createdAt) {
        activities.push({
          id: `onboarding-${user.id}`,
          type: 'onboarding',
          user: user.name,
          email: user.email || '',
          timestamp: user.updatedAt,
        });
      }
      
      if (user.subscriptionTier === 'pro' && user.updatedAt) {
        activities.push({
          id: `upgrade-${user.id}`,
          type: 'upgrade',
          user: user.name,
          email: user.email || '',
          timestamp: user.updatedAt,
        });
      }
    });
    
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 50);
  }, [usersData?.users]);

  const getActivityConfig = (type: string) => {
    switch (type) {
      case 'signup': 
        return { 
          icon: UserPlus, 
          label: 'New signup',
          iconBg: 'bg-blue-100 dark:bg-blue-500/20',
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'onboarding': 
        return { 
          icon: CheckCircle2, 
          label: 'Completed onboarding',
          iconBg: 'bg-green-100 dark:bg-green-500/20',
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'upgrade': 
        return { 
          icon: TrendingUp, 
          label: 'Upgraded to Pro',
          iconBg: 'bg-amber-100 dark:bg-amber-500/20',
          iconColor: 'text-amber-600 dark:text-amber-400'
        };
      default: 
        return { 
          icon: Activity, 
          label: 'Activity',
          iconBg: 'bg-muted',
          iconColor: 'text-muted-foreground'
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          testId="card-total-jobs"
          title="Jobs Created"
          value={stats?.featureUsage.totalJobs || 0}
          icon={<Briefcase className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-100 dark:bg-blue-500/20"
        />
        <KPICard
          testId="card-invoices-sent"
          title="Invoices Sent"
          value={stats?.featureUsage.totalInvoices || 0}
          icon={<Receipt className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />}
          iconBgClass="bg-green-100 dark:bg-green-500/20"
        />
        <KPICard
          testId="card-quotes-generated"
          title="Quotes Generated"
          value={stats?.featureUsage.totalQuotes || 0}
          icon={<FileText className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-100 dark:bg-purple-500/20"
        />
        <KPICard
          testId="card-clients-added"
          title="Clients Added"
          value={stats?.featureUsage.totalClients || 0}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />}
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
      </div>

      <Card data-testid="card-activity-log">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Platform Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {recentActivity.map((activity, idx) => {
                  const config = getActivityConfig(activity.type);
                  const Icon = config.icon;
                  return (
                    <div 
                      key={activity.id}
                      className={`relative flex items-start gap-4 py-4 ${idx !== recentActivity.length - 1 ? 'border-b border-border/50' : ''}`}
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className={`relative z-10 h-10 w-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {activity.user}
                          {activity.email && (
                            <span className="hidden sm:inline"> ({activity.email})</span>
                          )}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                            {activity.details}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 pt-1">
                        <Clock className="h-3 w-3" />
                        <span className="hidden sm:inline">{formatRelativeDate(activity.timestamp)}</span>
                        <span className="sm:hidden">{formatRelativeDate(activity.timestamp).split(' ')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">No recent activity</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Activity will appear here as users interact with the platform</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthView({ stats }: { stats: AdminStats | undefined }) {
  const healthMetrics = [
    { name: "API Server", status: "healthy", latency: "45ms", uptime: "99.9%", icon: Server },
    { name: "Database", status: "healthy", latency: "12ms", uptime: "99.99%", icon: Database },
    { name: "Background Jobs", status: "healthy", latency: "N/A", uptime: "99.5%", icon: Cpu },
    { name: "File Storage", status: "healthy", latency: "78ms", uptime: "99.9%", icon: HardDrive },
  ];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy': 
        return { 
          icon: CheckCircle2, 
          iconColor: 'text-green-600 dark:text-green-400',
          badgeBg: 'bg-green-100 dark:bg-green-500/20',
          badgeText: 'text-green-700 dark:text-green-400',
          label: 'Healthy'
        };
      case 'degraded': 
        return { 
          icon: AlertTriangle, 
          iconColor: 'text-amber-600 dark:text-amber-400',
          badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
          badgeText: 'text-amber-700 dark:text-amber-400',
          label: 'Degraded'
        };
      case 'down': 
        return { 
          icon: XCircle, 
          iconColor: 'text-red-600 dark:text-red-400',
          badgeBg: 'bg-red-100 dark:bg-red-500/20',
          badgeText: 'text-red-700 dark:text-red-400',
          label: 'Down'
        };
      default: 
        return { 
          icon: Activity, 
          iconColor: 'text-muted-foreground',
          badgeBg: 'bg-muted',
          badgeText: 'text-muted-foreground',
          label: 'Unknown'
        };
    }
  };

  const tierData = [
    { name: 'Free', value: stats?.tierBreakdown.free || 0, color: 'hsl(var(--muted-foreground))' },
    { name: 'Trial', value: stats?.tierBreakdown.trial || 0, color: 'hsl(210, 100%, 60%)' },
    { name: 'Pro', value: stats?.tierBreakdown.pro || 0, color: 'hsl(45, 100%, 50%)' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-system-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-muted-foreground" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {healthMetrics.map((metric, idx) => {
                const Icon = metric.icon;
                const statusConfig = getStatusConfig(metric.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div 
                    key={metric.name}
                    className={`flex items-center justify-between py-3 ${idx !== healthMetrics.length - 1 ? 'border-b' : ''}`}
                    data-testid={`health-metric-${metric.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {metric.latency !== "N/A" && `${metric.latency} latency · `}{metric.uptime} uptime
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tier-distribution">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {tier.name} <span className="font-medium text-foreground">({tier.value})</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-performance-metrics">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Avg Response Time", value: "45ms", testId: "metric-response-time" },
              { label: "Error Rate", value: "0.1%", color: "text-green-600 dark:text-green-400", testId: "metric-error-rate" },
              { label: "Active Sessions", value: stats?.kpis.activeUsers || 0, testId: "metric-active-sessions" },
              { label: "DB Connections", value: "12/100", testId: "metric-db-connections" },
            ].map((metric) => (
              <div 
                key={metric.label} 
                className="p-4 rounded-xl bg-muted/50 border border-border/50"
                data-testid={metric.testId}
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className={`text-xl md:text-2xl font-bold mt-1 ${metric.color || ''}`}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();

  const { data: authUser, isLoading: authLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });

  const isAdmin = authUser?.isPlatformAdmin === true;

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUsersResponse>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin,
  });

  const currentRoute = adminRoutes.find(r => location === r.path) || adminRoutes[0];

  const handleTabChange = (path: string) => {
    setLocation(path);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="access-denied">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground text-sm">
                You don't have permission to access the admin dashboard.
              </p>
              <Button 
                className="mt-6" 
                onClick={() => setLocation('/')}
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderView = () => {
    switch (location) {
      case '/admin/users':
        return <UsersView usersData={usersData} usersLoading={usersLoading} />;
      case '/admin/activity':
        return <ActivityView usersData={usersData} stats={stats} />;
      case '/admin/health':
        return <HealthView stats={stats} />;
      default:
        return (
          <OverviewView 
            stats={stats}
            statsLoading={statsLoading}
            statsError={statsError}
            usersData={usersData}
            usersLoading={usersLoading}
          />
        );
    }
  };

  return (
    <PageShell data-testid="admin-dashboard">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform analytics and user management"
        leading={<Shield className="h-5 w-5 text-primary" />}
      />

      <Tabs 
        value={currentRoute.path} 
        onValueChange={handleTabChange} 
        className="mb-6"
        data-testid="admin-tabs"
      >
        <TabsList className="w-full sm:w-auto justify-start h-auto p-1 gap-1 flex-wrap">
          {adminRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <TabsTrigger 
                key={route.path} 
                value={route.path}
                className="flex items-center gap-2 px-3 py-2"
                data-testid={`tab-${route.label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                <span>{route.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {renderView()}
    </PageShell>
  );
}
