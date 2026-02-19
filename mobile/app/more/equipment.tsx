import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useContentWidth, isTablet } from '../../src/lib/device';

type EquipmentStatus = 'active' | 'maintenance' | 'retired' | 'sold';
type FilterType = 'all' | 'active' | 'maintenance' | 'retired';

interface Equipment {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  warrantyExpiresAt?: string;
  location?: string;
  status: EquipmentStatus;
  assignedTo?: string;
  photos?: string[];
  isActive?: boolean;
  createdAt?: string;
}

const formatCurrency = (amount: number) => {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

const getStatusConfig = (status: EquipmentStatus) => {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)', icon: 'check-circle' as const };
    case 'maintenance':
      return { label: 'Maintenance', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', icon: 'tool' as const };
    case 'retired':
      return { label: 'Retired', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', icon: 'archive' as const };
    case 'sold':
      return { label: 'Sold', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', icon: 'tag' as const };
    default:
      return { label: status, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', icon: 'help-circle' as const };
  }
};

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<Equipment[]>('/api/equipment');
      if (res.error) {
        setError(res.error);
      } else {
        setEquipment(res.data || []);
      }
    } catch (err) {
      setError('Failed to load equipment');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredEquipment = useMemo(() => {
    if (activeFilter === 'all') return equipment;
    return equipment.filter(e => e.status === activeFilter);
  }, [equipment, activeFilter]);

  const filterCounts = useMemo(() => ({
    all: equipment.length,
    active: equipment.filter(e => e.status === 'active').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    retired: equipment.filter(e => e.status === 'retired').length,
  }), [equipment]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderFilterChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'active', 'maintenance', 'retired'] as FilterType[]).map((filter) => {
          const isActive = activeFilter === filter;
          const config = filter === 'all' ? null : getStatusConfig(filter as EquipmentStatus);
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, isActive && styles.activeFilterChip]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              {config && (
                <Feather
                  name={config.icon}
                  size={14}
                  color={isActive ? '#fff' : config.color}
                />
              )}
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {filter === 'all' ? 'All' : config!.label}
              </Text>
              <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, isActive && styles.activeFilterBadgeText]}>
                  {filterCounts[filter]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderCard = (item: Equipment) => {
    const statusConfig = getStatusConfig(item.status);
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              {item.model ? (
                <Text style={styles.cardSubtitle} numberOfLines={1}>{item.model}</Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <View style={styles.cardMeta}>
            {item.location ? (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={iconSizes.sm} color={colors.mutedForeground} />
                <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
              </View>
            ) : null}
            {item.assignedTo ? (
              <View style={styles.metaItem}>
                <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
                <Text style={styles.metaText} numberOfLines={1}>{item.assignedTo}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />

            {item.description ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>{item.description}</Text>
              </View>
            ) : null}

            {item.manufacturer ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Manufacturer</Text>
                <Text style={styles.detailValue}>{item.manufacturer}</Text>
              </View>
            ) : null}

            {item.serialNumber ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Serial Number</Text>
                <Text style={styles.detailValue}>{item.serialNumber}</Text>
              </View>
            ) : null}

            {item.purchasePrice != null ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchase Price</Text>
                <Text style={styles.detailValue}>{formatCurrency(item.purchasePrice)}</Text>
              </View>
            ) : null}

            {item.currentValue != null ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Value</Text>
                <Text style={styles.detailValue}>{formatCurrency(item.currentValue)}</Text>
              </View>
            ) : null}

            {item.purchaseDate ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchase Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(item.purchaseDate).toLocaleDateString('en-AU')}
                </Text>
              </View>
            ) : null}

            {item.warrantyExpiresAt ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Warranty Expires</Text>
                <Text style={styles.detailValue}>
                  {new Date(item.warrantyExpiresAt).toLocaleDateString('en-AU')}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Feather
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={iconSizes.md}
            color={colors.mutedForeground}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Feather name="tool" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No Equipment Found</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter !== 'all'
          ? `No ${activeFilter} equipment items. Try a different filter.`
          : 'Equipment items will appear here once added.'}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <Feather name="alert-circle" size={32} color="#ef4444" />
      </View>
      <Text style={styles.emptyTitle}>Something Went Wrong</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
        <Feather name="refresh-cw" size={iconSizes.md} color="#fff" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{
          title: 'Equipment',
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Equipment...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: 'Equipment',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Equipment</Text>
            <Text style={styles.pageSubtitle}>{equipment.length} total items</Text>
          </View>
        </View>

        {renderFilterChips()}

        {error ? renderError() : filteredEquipment.length === 0 ? renderEmptyState() : (
          <View style={styles.cardList}>
            {filteredEquipment.map(renderCard)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, paddingH: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: paddingH,
      paddingTop: spacing.lg,
      paddingBottom: spacing['3xl'],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    loadingText: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
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
    filterScroll: {
      marginBottom: spacing.lg,
      marginHorizontal: -paddingH,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: paddingH,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activeFilterChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      ...typography.caption,
      color: colors.foreground,
      fontWeight: '500',
    },
    activeFilterText: {
      color: '#fff',
    },
    filterBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    activeFilterBadge: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    activeFilterBadgeText: {
      color: '#fff',
    },
    cardList: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    cardHeader: {
      padding: spacing.lg,
    },
    cardTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    cardTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    cardSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    cardMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    expandedSection: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: spacing.xs,
    },
    detailLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
    },
    detailValue: {
      ...typography.caption,
      color: colors.foreground,
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
    },
    expandIndicator: {
      alignItems: 'center',
      paddingBottom: spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'],
      gap: spacing.md,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    emptySubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      maxWidth: 260,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    retryText: {
      ...typography.button,
      color: '#fff',
    },
  });
