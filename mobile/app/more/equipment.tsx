import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

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
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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

  const totalValue = useMemo(() => {
    return equipment.reduce((sum, e) => {
      const val = e.currentValue ?? e.purchasePrice ?? 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [equipment]);

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

  const renderSummaryCards = () => (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
          <Feather name="check-circle" size={22} color="#22c55e" />
        </View>
        <Text style={styles.summaryValue}>{filterCounts.active}</Text>
        <Text style={styles.summaryLabel}>ACTIVE</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
          <Feather name="tool" size={22} color="#f59e0b" />
        </View>
        <Text style={styles.summaryValue}>{filterCounts.maintenance}</Text>
        <Text style={styles.summaryLabel}>MAINTENANCE</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
          <Feather name="dollar-sign" size={22} color="#3b82f6" />
        </View>
        <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
        <Text style={styles.summaryLabel}>TOTAL VALUE</Text>
      </View>
    </View>
  );

  const renderCard = (item: Equipment) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardNameRow}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          </View>
          {item.model ? (
            <Text style={styles.cardModel} numberOfLines={1}>{item.model}</Text>
          ) : null}
        </View>

        {item.location ? (
          <View style={styles.cardMetaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{item.location}</Text>
          </View>
        ) : null}

        {item.serialNumber ? (
          <View style={styles.cardMetaRow}>
            <Feather name="hash" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>SN: {item.serialNumber}</Text>
          </View>
        ) : item.manufacturer ? (
          <View style={styles.cardMetaRow}>
            <Feather name="box" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{item.manufacturer}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {item.purchasePrice != null ? (
            <Text style={styles.cardPrice}>{formatCurrency(item.purchasePrice)}</Text>
          ) : <View />}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
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
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color="#ef4444" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading equipment...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.pageTitle}>Equipment</Text>
                <Text style={styles.pageSubtitle}>{equipment.length} total items</Text>
              </View>
            </View>

            {renderFilterChips()}
            {renderSummaryCards()}

            {error ? renderError() : filteredEquipment.length === 0 ? renderEmptyState() : (
              <View style={styles.cardList}>
                {filteredEquipment.map(renderCard)}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
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
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  filterScroll: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardList: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  cardModel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardMetaText: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 260,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
});
