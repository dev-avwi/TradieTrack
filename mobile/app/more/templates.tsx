import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL } from '../../src/lib/api';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';

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
    marginBottom: spacing.xl,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  filterDropdownText: {
    fontSize: 14,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  templateList: {
    gap: spacing.md,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateCategory: {
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  templatePrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  templateDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg + 4,
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
    padding: spacing.md + 2,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: spacing.md + 2,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    color: colors.foreground,
  },
  categoryButtonTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

function StatCard({ 
  title, 
  value, 
  icon,
  colors
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statLabelRow}>
        {icon}
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );
}

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token } = useAuthStore();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'quote',
    description: '',
    items: [] as { description: string; quantity: number; unitPrice: number }[]
  });
  const [isCreating, setIsCreating] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/catalog`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    refreshData();
  }, []);

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTemplate.name,
          description: newTemplate.description,
          category: newTemplate.type,
          unitPrice: 0,
        }),
      });

      if (response.ok) {
        await refreshData();
        setShowCreateModal(false);
        setNewTemplate({ name: '', type: 'quote', description: '', items: [] });
        Alert.alert('Success', 'Template created successfully');
      } else {
        Alert.alert('Error', 'Failed to create template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setIsCreating(false);
  };

  const handleDeleteTemplate = (id: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/catalog/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                await refreshData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        }
      ]
    );
  };

  const filteredTemplates = templates.filter(t => 
    typeFilter === 'all' || t.category === typeFilter
  );

  const quoteTemplates = templates.filter(t => t.category === 'quote' || t.category === 'service').length;
  const invoiceTemplates = templates.filter(t => t.category === 'invoice' || t.category === 'material').length;
  const jobTemplates = templates.filter(t => t.category === 'job' || t.category === 'labour').length;

  const formatPrice = (price: number) => {
    return `$${(price / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
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
              <Text style={styles.pageTitle}>Catalog</Text>
              <Text style={styles.pageSubtitle}>Manage your service and product catalog</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="Services"
              value={quoteTemplates}
              icon={<Feather name="file-text" size={14} color={colors.primary} />}
              colors={colors}
            />
            <StatCard
              title="Materials"
              value={invoiceTemplates}
              icon={<Feather name="file-text" size={14} color={colors.success} />}
              colors={colors}
            />
            <StatCard
              title="Labour"
              value={jobTemplates}
              icon={<Feather name="briefcase" size={14} color={colors.warning} />}
              colors={colors}
            />
          </View>

          <View style={styles.filtersRow}>
            <TouchableOpacity
              style={styles.filterDropdown}
              onPress={() => {
                const types = ['all', 'service', 'material', 'labour'];
                const currentIndex = types.indexOf(typeFilter);
                const nextIndex = (currentIndex + 1) % types.length;
                setTypeFilter(types[nextIndex]);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.filterDropdownText}>
                {typeFilter === 'all' ? 'All Types' : typeFilter}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {filteredTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No catalog items</Text>
              <Text style={styles.emptySubtitle}>
                Add services, materials and labour to speed up quoting
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.emptyButtonText}>Add First Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.templateList}>
              {filteredTemplates.map(template => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateCategory}>{template.category}</Text>
                    </View>
                    <View style={styles.templateActions}>
                      <Text style={styles.templatePrice}>
                        {formatPrice(template.unitPrice || 0)}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteTemplate(template.id)}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {template.description && (
                    <Text style={styles.templateDescription} numberOfLines={2}>
                      {template.description}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} activeOpacity={0.7}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Catalog Item</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.name}
                  onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
                  placeholder="e.g., Labour - Per Hour"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryButtons}>
                  {['service', 'material', 'labour'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        newTemplate.type === cat && styles.categoryButtonActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, type: cat })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        newTemplate.type === cat && styles.categoryButtonTextActive
                      ]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.description}
                  onChangeText={(text) => setNewTemplate({ ...newTemplate, description: text })}
                  placeholder="Brief description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}
                onPress={handleCreateTemplate}
                disabled={isCreating}
                activeOpacity={0.7}
              >
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {isCreating ? 'Creating...' : 'Create Item'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  );
}
