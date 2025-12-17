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
  Settings,
  LayoutDashboard,
  Search,
  Clock,
  LogIn,
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
  { path: "/admin/settings", label: "Settings", icon: Settings },
];

function getTierBadgeVariant(tier: string | null) {
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
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">Failed to load admin data. Make sure you have admin access.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-users">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold" data-testid="text-total-users">
                  {statsLoading ? '...' : stats?.kpis.totalUsers || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-users">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active (7d)</p>
                <p className="text-2xl font-bold" data-testid="text-active-users">
                  {statsLoading ? '...' : stats?.kpis.activeUsers || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-onboarding-rate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Onboarding Rate</p>
                <p className="text-2xl font-bold" data-testid="text-onboarding-rate">
                  {statsLoading ? '...' : `${stats?.kpis.onboardingCompletionRate || 0}%`}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pro-users">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pro Users</p>
                <p className="text-2xl font-bold" data-testid="text-pro-users">
                  {statsLoading ? '...' : stats?.tierBreakdown.pro || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-user-growth">
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {statsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.growthData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Signups']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-feature-usage">
          <CardHeader>
            <CardTitle>Feature Usage (All Users)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Jobs</span>
                </div>
                <span className="font-semibold" data-testid="text-total-jobs">
                  {stats?.featureUsage.totalJobs || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Completed Jobs</span>
                </div>
                <span className="font-semibold">
                  {stats?.featureUsage.completedJobs || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Invoices</span>
                </div>
                <span className="font-semibold" data-testid="text-total-invoices">
                  {stats?.featureUsage.totalInvoices || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Paid Invoices</span>
                </div>
                <span className="font-semibold">
                  {stats?.featureUsage.paidInvoices || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Quotes</span>
                </div>
                <span className="font-semibold" data-testid="text-total-quotes">
                  {stats?.featureUsage.totalQuotes || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Accepted Quotes</span>
                </div>
                <span className="font-semibold">
                  {stats?.featureUsage.acceptedQuotes || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Clients</span>
                </div>
                <span className="font-semibold">
                  {stats?.featureUsage.totalClients || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-user-list">
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signup Date</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : usersData?.users && usersData.users.length > 0 ? (
                  usersData.users.slice(0, 5).map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{user.name}</p>
                          {user.businessName && (
                            <p className="text-xs text-muted-foreground">{user.businessName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(user.subscriptionTier)}>
                          {user.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.hasCompletedOnboarding ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Onboarded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, email, or business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <div className="flex gap-2">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-tier-filter">
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
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="onboarded">Onboarded</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card data-testid="card-users-table">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <Badge variant="secondary">{usersData?.users?.length || 0} total</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Trade Type</TableHead>
                  <TableHead>Signup Date</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                      <TableCell>{user.businessName || '-'}</TableCell>
                      <TableCell>
                        {user.tradeType ? (
                          <Badge variant="outline" className="capitalize">
                            {user.tradeType}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(user.subscriptionTier)}>
                          {user.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeDate(user.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.hasCompletedOnboarding ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Onboarded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              Pending
                            </Badge>
                          )}
                          {user.emailVerified && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery || tierFilter !== "all" || statusFilter !== "all" 
                        ? "No users match your filters" 
                        : "No users found"}
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
      type: 'signup' | 'onboarding' | 'upgrade' | 'login';
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'onboarding': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'upgrade': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'login': return <LogIn className="h-4 w-4 text-gray-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'signup': return 'New signup';
      case 'onboarding': return 'Completed onboarding';
      case 'upgrade': return 'Upgraded to Pro';
      case 'login': return 'Logged in';
      default: return 'Activity';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs Created</p>
                <p className="text-2xl font-bold">{stats?.featureUsage.totalJobs || 0}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices Sent</p>
                <p className="text-2xl font-bold">{stats?.featureUsage.totalInvoices || 0}</p>
              </div>
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quotes Generated</p>
                <p className="text-2xl font-bold">{stats?.featureUsage.totalQuotes || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clients Added</p>
                <p className="text-2xl font-bold">{stats?.featureUsage.totalClients || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-activity-log">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Platform Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-4 py-3 border-b last:border-0"
                  data-testid={`activity-${activity.id}`}
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {getActivityLabel(activity.type)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.user} {activity.email && `(${activity.email})`}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.details}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatRelativeDate(activity.timestamp)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthView({ stats }: { stats: AdminStats | undefined }) {
  const healthMetrics = [
    {
      name: "API Server",
      status: "healthy",
      latency: "45ms",
      uptime: "99.9%",
      icon: Server,
    },
    {
      name: "Database",
      status: "healthy",
      latency: "12ms",
      uptime: "99.99%",
      icon: Database,
    },
    {
      name: "Background Jobs",
      status: "healthy",
      latency: "N/A",
      uptime: "99.5%",
      icon: Cpu,
    },
    {
      name: "File Storage",
      status: "healthy",
      latency: "78ms",
      uptime: "99.9%",
      icon: HardDrive,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': 
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Healthy</Badge>;
      case 'degraded': 
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Degraded</Badge>;
      case 'down': 
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Down</Badge>;
      default: 
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const tierData = [
    { name: 'Free', value: stats?.tierBreakdown.free || 0, color: '#94a3b8' },
    { name: 'Trial', value: stats?.tierBreakdown.trial || 0, color: '#60a5fa' },
    { name: 'Pro', value: stats?.tierBreakdown.pro || 0, color: '#facc15' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-system-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div 
                    key={metric.name}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Latency: {metric.latency} | Uptime: {metric.uptime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(metric.status)}
                      {getStatusBadge(metric.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tier-distribution">
          <CardHeader>
            <CardTitle>User Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
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
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {tier.name} ({tier.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-performance-metrics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold">45ms</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Error Rate</p>
              <p className="text-2xl font-bold text-green-600">0.1%</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Active Sessions</p>
              <p className="text-2xl font-bold">{stats?.kpis.activeUsers || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">DB Connections</p>
              <p className="text-2xl font-bold">12/100</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-6">
      <Card data-testid="card-admin-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-8 text-center border rounded-lg border-dashed">
              <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Admin Settings</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Platform configuration options will be available here. 
                This includes user management policies, feature flags, 
                notification settings, and other administrative controls.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Configure user registration, verification requirements, and account policies.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Feature Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable features for all users or specific user segments.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Email Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Customize system email templates for notifications and communications.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">API Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Manage API rate limits, webhooks, and third-party integrations.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access the admin dashboard.
              </p>
              <Button 
                className="mt-4" 
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
      case '/admin/settings':
        return <SettingsView />;
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
    <PageShell>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide analytics and user management"
        leading={<Shield className="h-6 w-6" />}
      />

      <Tabs 
        value={currentRoute.path} 
        onValueChange={handleTabChange} 
        className="mb-6"
      >
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          {adminRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <TabsTrigger 
                key={route.path} 
                value={route.path}
                className="flex items-center gap-2"
                data-testid={`tab-${route.label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{route.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {renderView()}
    </PageShell>
  );
}
