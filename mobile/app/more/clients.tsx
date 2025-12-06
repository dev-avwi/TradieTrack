import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Alert
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../src/lib/design-tokens';

type FilterKey = 'all' | 'with_email' | 'with_phone' | 'with_address';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'users' },
  { key: 'with_email', label: 'With Email', icon: 'mail' },
  { key: 'with_phone', label: 'With Phone', icon: 'phone' },
  { key: 'with_address', label: 'With Address', icon: 'map-pin' },
];

function StatCard({ 
  title, 
  value, 
  icon,
  onPress,
  colors,
  styles,
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  onPress?: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.statCard}
    >
      <View style={styles.statIconContainer}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function RecentClientItem({ 
  client, 
  onPress,
  colors,
  styles,
}: { 
  client: any;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.recentItem}
    >
      <View style={styles.recentDot} />
      <View style={styles.recentContent}>
        <Text style={styles.recentName} numberOfLines={1}>{client.name}</Text>
        <Text style={styles.recentPhone}>{client.phone || 'No phone'}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const handleCreateClient = () => {
  router.push('/more/client/new');
};

export default function ClientsScreen() {
  const { clients, fetchClients, isLoading } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const refreshData = useCallback(async () => {
    await fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  // Calculate filter counts
  const filterCounts = {
    all: clients.length,
    with_email: clients.filter(c => c.email).length,
    with_phone: clients.filter(c => c.phone).length,
    with_address: clients.filter(c => c.address).length,
  };

  // Filter clients based on search and active filter
  const filteredClients = clients.filter(client => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      client.name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchQuery) ||
      client.address?.toLowerCase().includes(searchLower);
    
    let matchesFilter = true;
    if (activeFilter === 'with_email') matchesFilter = !!client.email;
    if (activeFilter === 'with_phone') matchesFilter = !!client.phone;
    if (activeFilter === 'with_address') matchesFilter = !!client.address;
    
    return matchesSearch && matchesFilter;
  });

  // Get recent clients (last 5 added)
  const recentClients = [...clients]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Clients</Text>
              <Text style={styles.pageSubtitle}>{clients.length} total</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newButton}
              onPress={handleCreateClient}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={styles.newButtonText}>New Client</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Feather name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients by name, email, phone, or address..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Pills with Counts */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTERS.map((filter) => {
              const count = filterCounts[filter.key];
              const isActive = activeFilter === filter.key;
              
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.filterPill,
                    isActive && styles.filterPillActive
                  ]}
                >
                  {filter.icon && (
                    <Feather 
                      name={filter.icon as any}
                      size={14} 
                      color={isActive ? colors.primaryForeground : colors.foreground} 
                    />
                  )}
                  <Text style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive
                  ]}>
                    {filter.label}
                  </Text>
                  <View style={[
                    styles.filterCount,
                    isActive && styles.filterCountActive
                  ]}>
                    <Text style={[
                      styles.filterCountText,
                      isActive && styles.filterCountTextActive
                    ]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Stats Grid - 2x2 */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="TOTAL CLIENTS"
                value={filterCounts.all}
                icon={<Feather name="users" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('all')}
                colors={colors}
                styles={styles}
              />
              <StatCard
                title="WITH EMAIL"
                value={filterCounts.with_email}
                icon={<Feather name="mail" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('with_email')}
                colors={colors}
                styles={styles}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="WITH PHONE"
                value={filterCounts.with_phone}
                icon={<Feather name="phone" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('with_phone')}
                colors={colors}
                styles={styles}
              />
              <StatCard
                title="WITH ADDRESS"
                value={filterCounts.with_address}
                icon={<Feather name="map-pin" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('with_address')}
                colors={colors}
                styles={styles}
              />
            </View>
          </View>

          {/* Recent Clients Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recent Clients</Text>
            {recentClients.length === 0 ? (
              <View style={styles.emptySection}>
                <Feather name="users" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptySectionText}>No clients yet</Text>
              </View>
            ) : (
              recentClients.map((client) => (
                <RecentClientItem
                  key={client.id}
                  client={client}
                  onPress={() => router.push(`/more/client/${client.id}`)}
                  colors={colors}
                  styles={styles}
                />
              ))
            )}
          </View>

          {/* All Clients Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Clients</Text>
              <Text style={styles.sectionCount}>{filteredClients.length} clients</Text>
            </View>
            
            {filteredClients.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No clients found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? 'Try a different search' : 'Add your first client to get started'}
                </Text>
              </View>
            ) : (
              filteredClients.map(client => (
                <TouchableOpacity
                  key={client.id}
                  style={styles.clientCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/more/client/${client.id}`)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    {client.email && (
                      <View style={styles.contactRow}>
                        <Feather name="mail" size={14} color={colors.mutedForeground} />
                        <Text style={styles.contactText}>{client.email}</Text>
                      </View>
                    )}
                    {client.phone && (
                      <View style={styles.contactRow}>
                        <Feather name="phone" size={14} color={colors.mutedForeground} />
                        <Text style={styles.contactText}>{client.phone}</Text>
                      </View>
                    )}
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  newButtonText: {
    color: colors.primaryForeground,
    ...typography.caption,
    fontWeight: '600',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  // Filter Pills
  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.primaryForeground,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: sizes.filterCountMin,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.primaryForeground,
  },

  // Stats Grid
  statsGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Section Container
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.mutedForeground,
  },

  // Recent Client Item
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  recentDot: {
    width: sizes.dotSm,
    height: sizes.dotSm,
    borderRadius: sizes.dotSm / 2,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  recentContent: {
    flex: 1,
  },
  recentName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  recentPhone: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Empty Section
  emptySection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptySectionText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Client Card
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.subtitle,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  contactText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
