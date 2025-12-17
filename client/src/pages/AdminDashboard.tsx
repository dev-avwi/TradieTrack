import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  Briefcase,
  FileText,
  Receipt,
  TrendingUp,
  Shield
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
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  const { data: authUser, isLoading: authLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });

  // Only isPlatformAdmin flag grants admin access
  const isAdmin = authUser?.isPlatformAdmin === true;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, isAdmin, navigate]);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUsersResponse>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin,
  });

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
    return null;
  }

  const getTierBadgeVariant = (tier: string | null) => {
    switch (tier) {
      case 'pro': return 'default';
      case 'trial': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const formatRelativeDate = (dateStr: string | null) => {
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
  };

  return (
    <PageShell>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide analytics and user management"
        leading={<Shield className="h-6 w-6" />}
      />

      {statsError && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">Failed to load admin data. Make sure you have admin access.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
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
            <CardTitle>All Registered Users</CardTitle>
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
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : usersData?.users && usersData.users.length > 0 ? (
                    usersData.users.map((user) => (
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
    </PageShell>
  );
}
