import { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, sizes } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

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
  isActive: boolean | null;
  emailVerified: boolean | null;
  hasCompletedOnboarding: boolean;
  businessName: string | null;
}

interface SystemHealth {
  api: { status: string; latency: number };
  database: { status: string; latency: number };
  backgroundJobs: { status: string; pending: number };
  storage: { status: string; used: string };
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  kpiIcon: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  menuIcon: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  healthCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  healthDot: {
    width: sizes.dotSm,
    height: sizes.dotSm,
    borderRadius: sizes.dotSm / 2,
    marginRight: spacing.xs + 2,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  userEmail: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  badgeFree: {
    backgroundColor: colors.muted,
  },
  badgePro: {
    backgroundColor: colors.primary,
  },
  badgeTrial: {
    backgroundColor: colors.warning,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  badgeTextLight: {
    color: colors.foreground,
  },
  badgeTextDark: {
    color: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default function AdminDashboard() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'health'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get<AdminStats>('/api/admin/stats'),
        api.get<{ users: AdminUser[] }>('/api/admin/users'),
      ]);
      
      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data?.users) setUsers(usersRes.data.users);
      
      // Mock health data for now
      setHealth({
        api: { status: 'healthy', latency: 45 },
        database: { status: 'healthy', latency: 12 },
        backgroundJobs: { status: 'healthy', pending: 0 },
        storage: { status: 'healthy', used: '2.4 GB' },
      });
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('unauthorized')) {
        // Access denied - will show access denied UI
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAdminData();
    setRefreshing(false);
  }, [fetchAdminData]);

  // Check if user is platform admin
  if (!user?.isPlatformAdmin) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.accessDenied]}>
          <Feather name="shield-off" size={48} color={colors.mutedForeground} />
          <Text style={styles.accessDeniedText}>Access Denied</Text>
          <Text style={styles.accessDeniedSubtext}>
            This area is restricted to platform administrators.
          </Text>
          <TouchableOpacity 
            style={{ marginTop: spacing['2xl'] }}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const getTierBadge = (tier: string | null) => {
    const tierLower = tier?.toLowerCase() || 'free';
    let badgeStyle = styles.badgeFree;
    let textStyle = styles.badgeTextLight;
    
    if (tierLower === 'pro' || tierLower === 'team') {
      badgeStyle = styles.badgePro;
      textStyle = styles.badgeTextDark;
    } else if (tierLower === 'trial') {
      badgeStyle = styles.badgeTrial;
      textStyle = styles.badgeTextDark;
    }
    
    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={[styles.badgeText, textStyle]}>{tier || 'Free'}</Text>
      </View>
    );
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#f59e0b';
      case 'down': return '#ef4444';
      default: return colors.mutedForeground;
    }
  };

  const renderOverview = () => (
    <>
      <Text style={styles.sectionTitle}>Platform KPIs</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Feather name="users" size={20} color={colors.primary} style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{stats?.kpis.totalUsers || 0}</Text>
          <Text style={styles.kpiLabel}>Total Users</Text>
        </View>
        <View style={styles.kpiCard}>
          <Feather name="activity" size={20} color="#22c55e" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{stats?.kpis.activeUsers || 0}</Text>
          <Text style={styles.kpiLabel}>Active (7d)</Text>
        </View>
        <View style={styles.kpiCard}>
          <Feather name="check-circle" size={20} color="#8b5cf6" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{stats?.kpis.onboardingCompletionRate || 0}%</Text>
          <Text style={styles.kpiLabel}>Onboarding Rate</Text>
        </View>
        <View style={styles.kpiCard}>
          <Feather name="trending-up" size={20} color="#f59e0b" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{stats?.tierBreakdown?.pro || 0}</Text>
          <Text style={styles.kpiLabel}>Pro Users</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Feature Usage</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.featureUsage?.totalJobs || 0}</Text>
          <Text style={styles.kpiLabel}>Total Jobs</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.featureUsage?.totalInvoices || 0}</Text>
          <Text style={styles.kpiLabel}>Invoices</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.featureUsage?.totalQuotes || 0}</Text>
          <Text style={styles.kpiLabel}>Quotes</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.featureUsage?.totalClients || 0}</Text>
          <Text style={styles.kpiLabel}>Clients</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Subscription Breakdown</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.tierBreakdown?.free || 0}</Text>
          <Text style={styles.kpiLabel}>Free Tier</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{stats?.tierBreakdown?.trial || 0}</Text>
          <Text style={styles.kpiLabel}>Trial Users</Text>
        </View>
      </View>
    </>
  );

  const renderUsers = () => (
    <>
      <Text style={styles.sectionTitle}>All Users ({users.length})</Text>
      {users.map((user) => (
        <View key={user.id} style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.name || 'Unnamed User'}</Text>
              <Text style={styles.userEmail}>{user.email || 'No email'}</Text>
              {user.businessName && (
                <Text style={[styles.userEmail, { marginTop: spacing.xs }]}>{user.businessName}</Text>
              )}
            </View>
            {getTierBadge(user.subscriptionTier)}
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather 
                name={user.emailVerified ? 'check-circle' : 'x-circle'} 
                size={14} 
                color={user.emailVerified ? '#22c55e' : colors.mutedForeground} 
              />
              <Text style={[styles.userEmail, { marginLeft: spacing.xs, marginTop: 0 }]}>
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather 
                name={user.hasCompletedOnboarding ? 'check-circle' : 'clock'} 
                size={14} 
                color={user.hasCompletedOnboarding ? '#22c55e' : colors.mutedForeground} 
              />
              <Text style={[styles.userEmail, { marginLeft: spacing.xs, marginTop: 0 }]}>
                {user.hasCompletedOnboarding ? 'Onboarded' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );

  const renderHealth = () => (
    <>
      <Text style={styles.sectionTitle}>System Status</Text>
      
      <View style={styles.healthCard}>
        <Feather name="server" size={24} color={colors.foreground} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={styles.userName}>API Server</Text>
          <Text style={styles.userEmail}>Latency: {health?.api.latency || 0}ms</Text>
        </View>
        <View style={styles.healthStatus}>
          <View style={[styles.healthDot, { backgroundColor: getHealthColor(health?.api.status || 'unknown') }]} />
          <Text style={{ color: getHealthColor(health?.api.status || 'unknown'), fontWeight: '600' }}>
            {health?.api.status || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.healthCard}>
        <Feather name="database" size={24} color={colors.foreground} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={styles.userName}>Database</Text>
          <Text style={styles.userEmail}>Latency: {health?.database.latency || 0}ms</Text>
        </View>
        <View style={styles.healthStatus}>
          <View style={[styles.healthDot, { backgroundColor: getHealthColor(health?.database.status || 'unknown') }]} />
          <Text style={{ color: getHealthColor(health?.database.status || 'unknown'), fontWeight: '600' }}>
            {health?.database.status || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.healthCard}>
        <Feather name="zap" size={24} color={colors.foreground} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={styles.userName}>Background Jobs</Text>
          <Text style={styles.userEmail}>Pending: {health?.backgroundJobs.pending || 0}</Text>
        </View>
        <View style={styles.healthStatus}>
          <View style={[styles.healthDot, { backgroundColor: getHealthColor(health?.backgroundJobs.status || 'unknown') }]} />
          <Text style={{ color: getHealthColor(health?.backgroundJobs.status || 'unknown'), fontWeight: '600' }}>
            {health?.backgroundJobs.status || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.healthCard}>
        <Feather name="hard-drive" size={24} color={colors.foreground} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={styles.userName}>Storage</Text>
          <Text style={styles.userEmail}>Used: {health?.storage.used || 'N/A'}</Text>
        </View>
        <View style={styles.healthStatus}>
          <View style={[styles.healthDot, { backgroundColor: getHealthColor(health?.storage.status || 'unknown') }]} />
          <Text style={{ color: getHealthColor(health?.storage.status || 'unknown'), fontWeight: '600' }}>
            {health?.storage.status || 'Unknown'}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Admin Dashboard</Text>
            <Text style={styles.pageSubtitle}>Platform management and analytics</Text>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'users' && styles.tabActive]}
              onPress={() => setActiveTab('users')}
            >
              <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'health' && styles.tabActive]}
              onPress={() => setActiveTab('health')}
            >
              <Text style={[styles.tabText, activeTab === 'health' && styles.tabTextActive]}>Health</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'health' && renderHealth()}
        </ScrollView>
      </View>
    </>
  );
}
