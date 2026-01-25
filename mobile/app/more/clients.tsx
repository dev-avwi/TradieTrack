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
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;

function KPIBox({ 
  icon, 
  title, 
  value, 
  onPress 
}: { 
  icon: string; 
  title: string; 
  value: string; 
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity 
      style={styles.kpiBox} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.kpiIconContainer, { backgroundColor: colors.primaryLight }]}>
        <Feather name={icon as any} size={iconSizes.md} color={colors.primary} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function ClientCard({ 
  client, 
  onPress,
  onCall,
  onEmail,
  onSms,
  onCreateJob,
  onDelete,
}: { 
  client: any; 
  onPress: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onSms?: () => void;
  onCreateJob?: () => void;
  onDelete?: () => void;
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
      style={styles.clientCardFull}
    >
      <View style={styles.clientCardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
        </View>
        
        <View style={styles.clientCardInfo}>
          <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
          <View style={styles.clientMeta}>
            <View style={styles.jobsBadge}>
              <Text style={styles.jobsBadgeText}>
                {client.jobsCount || 0} {(client.jobsCount || 0) === 1 ? 'job' : 'jobs'}
              </Text>
            </View>
          </View>
          
          <View style={styles.contactRow}>
            {client.email && (
              <View style={styles.contactItem}>
                <Feather name="mail" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText} numberOfLines={1}>{client.email}</Text>
              </View>
            )}
            {client.phone && (
              <View style={styles.contactItem}>
                <Feather name="phone" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText}>{client.phone}</Text>
              </View>
            )}
            {client.address && (
              <View style={styles.contactItem}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText} numberOfLines={1}>{client.address}</Text>
              </View>
            )}
          </View>
        </View>
        
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
      
      <View style={styles.clientCardActions}>
        {client.phone && (
          <TouchableOpacity 
            style={styles.cardActionButton}
            onPress={(e) => { e.stopPropagation(); onCall?.(); }}
          >
            <Feather name="phone" size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>Call</Text>
          </TouchableOpacity>
        )}
        {client.email && (
          <TouchableOpacity 
            style={styles.cardActionButton}
            onPress={(e) => { e.stopPropagation(); onEmail?.(); }}
          >
            <Feather name="mail" size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>Email</Text>
          </TouchableOpacity>
        )}
        {client.phone && (
          <TouchableOpacity 
            style={styles.cardActionButton}
            onPress={(e) => { e.stopPropagation(); onSms?.(); }}
          >
            <Feather name="message-circle" size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>SMS</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.cardActionButton, styles.cardActionButtonPrimary]}
          onPress={(e) => { e.stopPropagation(); onCreateJob?.(); }}
        >
          <Feather name="briefcase" size={14} color={colors.white} />
          <Text style={[styles.cardActionText, styles.cardActionTextPrimary]}>Job</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.cardActionButton, styles.cardActionButtonDestructive]}
          onPress={(e) => { e.stopPropagation(); onDelete?.(); }}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </AnimatedCardPressable>
  );
}

export default function ClientsScreen() {
  const { clients, fetchClients, isLoading, deleteClient } = useClientsStore();
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

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

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

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleSms = (phone: string) => {
    Linking.openURL(`sms:${phone}`);
  };

  const handleCreateJob = (clientId: string) => {
    router.push(`/more/create-job?clientId=${clientId}`);
  };

  const handleDeleteClient = (client: any) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete "${client.name}"? This will also delete all associated jobs, quotes, and invoices.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteClient(client.id, true);
            if (success) {
              Alert.alert('Success', 'Client deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete client');
            }
          },
        },
      ]
    );
  };

  const renderClientList = () => {
    return (
      <View style={styles.clientsList}>
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onPress={() => router.push(`/more/client/${client.id}`)}
            onCall={() => client.phone && handleCall(client.phone)}
            onEmail={() => client.email && handleEmail(client.email)}
            onSms={() => client.phone && handleSms(client.phone)}
            onCreateJob={() => handleCreateJob(client.id)}
            onDelete={() => handleDeleteClient(client)}
          />
        ))}
      </View>
    );
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

          <View style={styles.kpiRow}>
            <KPIBox 
              icon="users" 
              title="Total" 
              value={filterCounts.all.toString()} 
              onPress={() => setActiveFilter('all')}
            />
            <KPIBox 
              icon="mail" 
              title="With Email" 
              value={filterCounts.with_email.toString()} 
              onPress={() => setActiveFilter('with_email')}
            />
            <KPIBox 
              icon="phone" 
              title="With Phone" 
              value={filterCounts.with_phone.toString()} 
              onPress={() => setActiveFilter('with_phone')}
            />
            <KPIBox 
              icon="map-pin" 
              title="With Addr" 
              value={filterCounts.with_address.toString()} 
              onPress={() => setActiveFilter('with_address')}
            />
          </View>

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
                    : 'Save client details once, use them everywhere. Makes quoting and invoicing a breeze.'}
                </Text>
                {!searchQuery && activeFilter === 'all' && (
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={handleCreateClient}
                  >
                    <Feather name="plus" size={16} color={colors.white} />
                    <Text style={styles.emptyStateButtonText}>Add Your First Client</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              renderClientList()
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
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  kpiTitle: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },

  clientsList: {
    gap: spacing.md,
  },
  clientCardFull: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  clientCardInfo: {
    flex: 1,
  },
  clientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  jobsBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  jobsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  contactRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactItemText: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  clientCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  cardActionButtonPrimary: {
    backgroundColor: colors.primary,
    marginLeft: 'auto',
  },
  cardActionButtonDestructive: {
    backgroundColor: colors.destructive + '15',
    paddingHorizontal: spacing.sm,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  cardActionTextPrimary: {
    color: colors.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    lineHeight: 20,
  },
});
