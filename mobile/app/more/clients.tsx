import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';

type FilterKey = 'all' | 'with_email' | 'with_phone' | 'with_address';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'users' },
  { key: 'with_email', label: 'With Email', icon: 'mail' },
  { key: 'with_phone', label: 'With Phone', icon: 'phone' },
  { key: 'with_address', label: 'With Address', icon: 'map-pin' },
];

const handleCreateClient = () => {
  router.push('/more/client/new');
};

function ClientCard({ 
  client, 
  onPress 
}: { 
  client: any; 
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.clientCard}
    >
      <View style={styles.clientCardContent}>
        <View style={styles.clientCardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
            {client.jobsCount !== undefined && client.jobsCount > 0 && (
              <View style={styles.jobsBadge}>
                <Text style={styles.jobsBadgeText}>{client.jobsCount} {client.jobsCount === 1 ? 'job' : 'jobs'}</Text>
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
        
        {/* Contact details like web */}
        <View style={styles.clientDetails}>
          {client.email && (
            <View style={styles.clientDetailRow}>
              <Feather name="mail" size={12} color={colors.mutedForeground} />
              <Text style={styles.clientDetailText} numberOfLines={1}>{client.email}</Text>
            </View>
          )}
          {client.phone && (
            <View style={styles.clientDetailRow}>
              <Feather name="phone" size={12} color={colors.mutedForeground} />
              <Text style={styles.clientDetailText} numberOfLines={1}>{client.phone}</Text>
            </View>
          )}
          {client.address && (
            <View style={styles.clientDetailRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={styles.clientDetailText} numberOfLines={1}>{client.address}</Text>
            </View>
          )}
        </View>
      </View>
    </AnimatedCardPressable>
  );
}

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

  const filterCounts = {
    all: clients.length,
    with_email: clients.filter(c => c.email).length,
    with_phone: clients.filter(c => c.phone).length,
    with_address: clients.filter(c => c.address).length,
  };

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
              <Feather name="plus" size={iconSizes.lg} color={colors.white} />
              <Text style={styles.newButtonText}>New Client</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="users" size={iconSizes.md} color={colors.primary} />
              <Text style={styles.sectionTitle}>ALL CLIENTS</Text>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredClients.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="users" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No clients found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Add your first client to get started'}
                </Text>
              </View>
            ) : (
              <View style={styles.clientsList}>
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onPress={() => router.push(`/more/client/${client.id}`)}
                  />
                ))}
              </View>
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
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
    marginTop: spacing.xs,
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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
    color: colors.white,
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
    color: colors.white,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    letterSpacing: 0.5,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  clientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  clientCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  clientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobsBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  jobsBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  clientDetails: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  clientDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientDetailText: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
});
