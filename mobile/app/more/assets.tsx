import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface Asset {
  id: string;
  name: string;
  description?: string;
  category?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  currentValue?: string;
  condition?: string;
  location?: string;
  assignedTo?: string;
  photoUrl?: string;
  notes?: string;
  isActive?: boolean;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

type FilterKey = 'all' | 'tool' | 'equipment' | 'vehicle' | 'material';

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'tool', label: 'Tools', icon: 'tool' },
  { key: 'equipment', label: 'Equipment', icon: 'hard-drive' },
  { key: 'vehicle', label: 'Vehicles', icon: 'truck' },
  { key: 'material', label: 'Materials', icon: 'package' },
];

const CATEGORIES = [
  { value: 'tool', label: 'Tool', icon: 'tool' as const },
  { value: 'equipment', label: 'Equipment', icon: 'hard-drive' as const },
  { value: 'vehicle', label: 'Vehicle', icon: 'truck' as const },
  { value: 'material', label: 'Material', icon: 'package' as const },
];

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'retired', label: 'Retired' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  searchSection: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.foreground,
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.foreground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  assetCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  assetIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  assetHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  assetSerial: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  conditionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  conditionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  assetDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  assetDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  assetDetailText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  assetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryOptionText: {
    fontSize: 12,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  categoryOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  conditionOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conditionOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  conditionOptionText: {
    fontSize: 13,
    color: colors.foreground,
  },
  conditionOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  deleteButton: {
    backgroundColor: colors.destructive,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.destructiveForeground,
  },
});

export default function AssetsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'tool',
    serialNumber: '',
    location: '',
    condition: 'good',
    purchasePrice: '',
    notes: '',
  });

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/assets');
      setAssets(response.data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      Alert.alert('Error', 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = !searchQuery || 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.location?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === 'all' || asset.category === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [assets, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const tools = assets.filter(a => a.category === 'tool').length;
    const needsMaintenance = assets.filter(a => {
      if (!a.nextMaintenanceDate) return false;
      return new Date(a.nextMaintenanceDate) <= new Date();
    }).length;
    const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.currentValue || a.purchasePrice || '0') || 0), 0);
    return { total, tools, needsMaintenance, totalValue };
  }, [assets]);

  const getConditionColors = (condition?: string) => {
    switch (condition) {
      case 'new': return { bg: colors.infoLight, text: colors.info };
      case 'good': return { bg: colors.successLight, text: colors.success };
      case 'fair': return { bg: colors.warningLight, text: colors.warning };
      case 'poor': return { bg: colors.destructiveLight, text: colors.destructive };
      case 'retired': return { bg: colors.muted, text: colors.mutedForeground };
      default: return { bg: colors.muted, text: colors.foreground };
    }
  };

  const getCategoryIcon = (category?: string): keyof typeof Feather.glyphMap => {
    switch (category) {
      case 'tool': return 'tool';
      case 'equipment': return 'hard-drive';
      case 'vehicle': return 'truck';
      case 'material': return 'package';
      default: return 'package';
    }
  };

  const openCreateModal = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      description: '',
      category: 'tool',
      serialNumber: '',
      location: '',
      condition: 'good',
      purchasePrice: '',
      notes: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description || '',
      category: asset.category || 'tool',
      serialNumber: asset.serialNumber || '',
      location: asset.location || '',
      condition: asset.condition || 'good',
      purchasePrice: asset.purchasePrice || '',
      notes: asset.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        serialNumber: formData.serialNumber.trim() || null,
        location: formData.location.trim() || null,
        condition: formData.condition,
        purchasePrice: formData.purchasePrice ? formData.purchasePrice : null,
        notes: formData.notes.trim() || null,
      };

      if (editingAsset) {
        await api.put(`/api/assets/${editingAsset.id}`, payload);
        Alert.alert('Success', 'Asset updated successfully');
      } else {
        await api.post('/api/assets', payload);
        Alert.alert('Success', 'Asset created successfully');
      }
      
      setModalVisible(false);
      fetchAssets();
    } catch (error) {
      console.error('Error saving asset:', error);
      Alert.alert('Error', 'Failed to save asset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingAsset) return;

    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete "${editingAsset.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/assets/${editingAsset.id}`);
              setModalVisible(false);
              fetchAssets();
              Alert.alert('Success', 'Asset deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete asset');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value?: string) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    return `$${num.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assets</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={openCreateModal}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchAssets}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search assets..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            <View style={styles.filtersRow}>
              {FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    activeFilter === filter.key && styles.filterChipActive,
                  ]}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.7}
                >
                  <Feather 
                    name={filter.icon} 
                    size={14} 
                    color={activeFilter === filter.key ? colors.primaryForeground : colors.foreground} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    activeFilter === filter.key && styles.filterChipTextActive,
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Assets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {formatCurrency(stats.totalValue.toString()) || '$0'}
              </Text>
              <Text style={styles.statLabel}>Total Value</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, stats.needsMaintenance > 0 ? { color: colors.warning } : {}]}>
                {stats.needsMaintenance}
              </Text>
              <Text style={styles.statLabel}>Due Service</Text>
            </View>
          </View>

          <View style={styles.listContainer}>
            {filteredAssets.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="package" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>
                  {searchQuery ? 'No assets found' : 'No assets yet'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {searchQuery 
                    ? 'Try adjusting your search or filters'
                    : 'Track your tools, equipment, and vehicles to manage your business assets.'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={openCreateModal}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={18} color={colors.primaryForeground} />
                    <Text style={styles.emptyStateButtonText}>Add First Asset</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredAssets.map((asset) => {
                const conditionColors = getConditionColors(asset.condition);
                return (
                  <TouchableOpacity
                    key={asset.id}
                    style={styles.assetCard}
                    onPress={() => openEditModal(asset)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assetHeader}>
                      <View style={styles.assetHeaderContent}>
                        <View style={styles.assetIconContainer}>
                          <Feather 
                            name={getCategoryIcon(asset.category)} 
                            size={22} 
                            color={colors.primary} 
                          />
                        </View>
                        <View style={styles.assetInfo}>
                          <Text style={styles.assetName}>{asset.name}</Text>
                          {asset.serialNumber && (
                            <Text style={styles.assetSerial}>S/N: {asset.serialNumber}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[styles.conditionBadge, { backgroundColor: conditionColors.bg }]}>
                        <Text style={[styles.conditionBadgeText, { color: conditionColors.text }]}>
                          {asset.condition || 'Unknown'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.assetDetails}>
                      {asset.location && (
                        <View style={styles.assetDetailItem}>
                          <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                          <Text style={styles.assetDetailText}>{asset.location}</Text>
                        </View>
                      )}
                      {formatCurrency(asset.currentValue || asset.purchasePrice) && (
                        <View style={styles.assetDetailItem}>
                          <Feather name="dollar-sign" size={14} color={colors.mutedForeground} />
                          <Text style={styles.assetDetailText}>
                            {formatCurrency(asset.currentValue || asset.purchasePrice)}
                          </Text>
                        </View>
                      )}
                      {asset.category && (
                        <View style={styles.assetDetailItem}>
                          <Feather name="tag" size={14} color={colors.mutedForeground} />
                          <Text style={styles.assetDetailText}>
                            {asset.category.charAt(0).toUpperCase() + asset.category.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingAsset ? 'Edit Asset' : 'Add Asset'}
                </Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Feather name="x" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Asset name"
                    placeholderTextColor={colors.mutedForeground}
                    value={formData.name}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <View style={styles.categoryRow}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.categoryOption,
                          formData.category === cat.value && styles.categoryOptionActive,
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name={cat.icon} 
                          size={20} 
                          color={formData.category === cat.value ? colors.primary : colors.foreground} 
                        />
                        <Text style={[
                          styles.categoryOptionText,
                          formData.category === cat.value && styles.categoryOptionTextActive,
                        ]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Serial Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="S/N or ID"
                    placeholderTextColor={colors.mutedForeground}
                    value={formData.serialNumber}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, serialNumber: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Where is it stored?"
                    placeholderTextColor={colors.mutedForeground}
                    value={formData.location}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Condition</Text>
                  <View style={styles.conditionRow}>
                    {CONDITIONS.map((cond) => (
                      <TouchableOpacity
                        key={cond.value}
                        style={[
                          styles.conditionOption,
                          formData.condition === cond.value && styles.conditionOptionActive,
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, condition: cond.value }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.conditionOptionText,
                          formData.condition === cond.value && styles.conditionOptionTextActive,
                        ]}>
                          {cond.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Purchase Price (AUD)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={formData.purchasePrice}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, purchasePrice: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Add any notes..."
                    placeholderTextColor={colors.mutedForeground}
                    value={formData.description}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingAsset ? 'Update Asset' : 'Create Asset'}
                    </Text>
                  )}
                </TouchableOpacity>

                {editingAsset && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteButtonText}>Delete Asset</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
