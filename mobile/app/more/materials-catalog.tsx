import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface CatalogItem {
  id: string;
  userId: string;
  tradeType: string;
  name: string;
  description: string;
  unit: string;
  unitPrice: string;
  defaultQty?: string;
  tags?: string[];
}

const TRADE_TYPES = [
  'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting',
  'Roofing', 'Landscaping', 'General', 'Cleaning', 'Other'
];

const UNITS = [
  { value: 'hour', label: 'Per Hour' },
  { value: 'item', label: 'Per Item' },
  { value: 'm', label: 'Per Metre' },
  { value: 'sqm', label: 'Per Square Metre' },
  { value: 'day', label: 'Per Day' },
  { value: 'fixed', label: 'Fixed Price' },
];

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
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  addButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  sharedBadge: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.info,
  },
  itemActions: {
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
    backgroundColor: colors.muted,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  actionButtonDanger: {
    backgroundColor: `${colors.destructive}15`,
  },
  actionButtonDangerText: {
    color: colors.destructive,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalContent: {
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectButtonText: {
    fontSize: 13,
    color: colors.foreground,
  },
  selectButtonTextActive: {
    color: colors.primaryForeground,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priceInputContainer: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});

export default function MaterialsCatalogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrade, setFilterTrade] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tradeType: 'General',
    unit: 'item',
    unitPrice: '',
    defaultQty: '1',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<CatalogItem[]>('/api/catalog');
      if (response.data) {
        setCatalogItems(response.data);
      }
    } catch (error) {
      console.error('[Catalog] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      tradeType: 'General',
      unit: 'item',
      unitPrice: '',
      defaultQty: '1',
    });
    setEditingItem(null);
  };

  const openEditModal = (item: CatalogItem) => {
    if (item.userId === 'shared') {
      Alert.alert('Cannot Edit', 'Shared catalog items cannot be modified.');
      return;
    }
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      tradeType: item.tradeType,
      unit: item.unit,
      unitPrice: item.unitPrice,
      defaultQty: item.defaultQty || '1',
    });
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter an item name.');
      return;
    }
    if (!formData.unitPrice.trim()) {
      Alert.alert('Error', 'Please enter a price.');
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || formData.name,
        tradeType: formData.tradeType,
        unit: formData.unit,
        unitPrice: formData.unitPrice,
        defaultQty: formData.defaultQty || '1',
      };
      
      if (editingItem) {
        const response = await api.put(`/api/catalog/${editingItem.id}`, payload);
        if (response.error) {
          Alert.alert('Error', response.error);
          return;
        }
        Alert.alert('Success', 'Item updated successfully!');
      } else {
        const response = await api.post('/api/catalog', payload);
        if (response.error) {
          Alert.alert('Error', response.error);
          return;
        }
        Alert.alert('Success', 'Item added to catalog!');
      }
      
      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch (error) {
      console.error('[Catalog] Failed to save:', error);
      Alert.alert('Error', 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (item: CatalogItem) => {
    if (item.userId === 'shared') {
      Alert.alert('Cannot Delete', 'Shared catalog items cannot be deleted.');
      return;
    }
    
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/catalog/${item.id}`);
              await fetchData();
              Alert.alert('Deleted', 'Item removed from catalog.');
            } catch (error) {
              console.error('[Catalog] Failed to delete:', error);
              Alert.alert('Error', 'Failed to delete item.');
            }
          }
        },
      ]
    );
  };

  const getUnitLabel = (unit: string) => {
    return UNITS.find(u => u.value === unit)?.label || unit;
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };

  const filteredItems = useMemo(() => {
    let items = catalogItems;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    
    if (filterTrade) {
      items = items.filter(item => item.tradeType === filterTrade);
    }
    
    return items;
  }, [catalogItems, searchQuery, filterTrade]);

  const myItems = filteredItems.filter(i => i.userId !== 'shared');
  const sharedItems = filteredItems.filter(i => i.userId === 'shared');
  
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
              onRefresh={fetchData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Price Book</Text>
              <Text style={styles.pageSubtitle}>Your saved materials and services</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name="package" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{myItems.length}</Text>
              <Text style={styles.statLabel}>MY ITEMS</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name="layers" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{sharedItems.length}</Text>
              <Text style={styles.statLabel}>SHARED ITEMS</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search items..."
              placeholderTextColor={colors.mutedForeground}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.lg }}
          >
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filterTrade && styles.filterChipActive]}
                onPress={() => setFilterTrade(null)}
              >
                <Text style={[styles.filterChipText, !filterTrade && styles.filterChipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {TRADE_TYPES.map(trade => (
                <TouchableOpacity
                  key={trade}
                  style={[styles.filterChip, filterTrade === trade && styles.filterChipActive]}
                  onPress={() => setFilterTrade(trade)}
                >
                  <Text style={[
                    styles.filterChipText, 
                    filterTrade === trade && styles.filterChipTextActive
                  ]}>
                    {trade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="package" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Items Found</Text>
              <Text style={styles.emptyText}>
                Add your commonly used materials,{'\n'}
                services and labour rates.
              </Text>
            </View>
          ) : (
            <>
              {myItems.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>My Items</Text>
                  {myItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>{formatPrice(item.unitPrice)}</Text>
                      </View>
                      <Text style={styles.itemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <View style={styles.itemMeta}>
                        <View style={styles.itemMetaItem}>
                          <Feather name="tag" size={12} color={colors.mutedForeground} />
                          <Text style={styles.itemMetaText}>{item.tradeType}</Text>
                        </View>
                        <View style={styles.itemMetaItem}>
                          <Feather name="box" size={12} color={colors.mutedForeground} />
                          <Text style={styles.itemMetaText}>{getUnitLabel(item.unit)}</Text>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => openEditModal(item)}
                          activeOpacity={0.7}
                        >
                          <Feather name="edit-2" size={16} color={colors.foreground} />
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.actionButtonDanger]}
                          onPress={() => handleDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={16} color={colors.destructive} />
                          <Text style={[styles.actionButtonText, styles.actionButtonDangerText]}>
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {sharedItems.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                    Shared Items
                  </Text>
                  {sharedItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <View style={styles.sharedBadge}>
                            <Text style={styles.sharedBadgeText}>SHARED</Text>
                          </View>
                        </View>
                        <Text style={styles.itemPrice}>{formatPrice(item.unitPrice)}</Text>
                      </View>
                      <Text style={styles.itemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <View style={styles.itemMeta}>
                        <View style={styles.itemMetaItem}>
                          <Feather name="tag" size={12} color={colors.mutedForeground} />
                          <Text style={styles.itemMetaText}>{item.tradeType}</Text>
                        </View>
                        <View style={styles.itemMetaItem}>
                          <Feather name="box" size={12} color={colors.mutedForeground} />
                          <Text style={styles.itemMetaText}>{getUnitLabel(item.unit)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Edit Item' : 'Add Item'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Tap Replacement"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Item description..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Trade Type</Text>
              <View style={styles.selectGrid}>
                {TRADE_TYPES.slice(0, 6).map(trade => (
                  <TouchableOpacity
                    key={trade}
                    style={[
                      styles.selectButton,
                      formData.tradeType === trade && styles.selectButtonActive
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, tradeType: trade }))}
                  >
                    <Text style={[
                      styles.selectButtonText,
                      formData.tradeType === trade && styles.selectButtonTextActive
                    ]}>
                      {trade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Unit</Text>
              <View style={styles.selectGrid}>
                {UNITS.map(unit => (
                  <TouchableOpacity
                    key={unit.value}
                    style={[
                      styles.selectButton,
                      formData.unit === unit.value && styles.selectButtonActive
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, unit: unit.value }))}
                  >
                    <Text style={[
                      styles.selectButtonText,
                      formData.unit === unit.value && styles.selectButtonTextActive
                    ]}>
                      {unit.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.priceRow}>
              <View style={[styles.formGroup, styles.priceInputContainer]}>
                <Text style={styles.formLabel}>Price ($) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.unitPrice}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    unitPrice: text.replace(/[^0-9.]/g, '') 
                  }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.formGroup, styles.priceInputContainer]}>
                <Text style={styles.formLabel}>Default Qty</Text>
                <TextInput
                  style={styles.input}
                  value={formData.defaultQty}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    defaultQty: text.replace(/[^0-9.]/g, '') 
                  }))}
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.submitButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingItem ? 'Update Item' : 'Add to Catalog'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
