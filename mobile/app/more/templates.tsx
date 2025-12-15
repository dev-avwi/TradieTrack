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
  Modal,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL } from '../../src/lib/api';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';

interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
  };
  sections: {
    showHeader?: boolean;
    showLineItems?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showSignature?: boolean;
  };
  defaults: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
    dueTermDays?: number;
    gstEnabled?: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman', 'general'
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
    color: colors.primaryForeground,
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
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
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
    marginBottom: spacing.sm,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  templateType: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    textTransform: 'capitalize',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTrade: {
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  templateDetails: {
    marginTop: spacing.sm,
  },
  templateTitle: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 4,
  },
  templateItemsCount: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  templateTerms: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  badge: {
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
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
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  typeButtonTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  tradeTypeScroll: {
    marginBottom: spacing.lg,
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tradeChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  tradeChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lineItemInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItemQty: {
    width: 60,
  },
  lineItemPrice: {
    width: 80,
  },
  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addLineItemText: {
    fontSize: 14,
    color: colors.primary,
  },
  removeLineItemButton: {
    padding: spacing.sm,
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: 14,
    color: colors.foreground,
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
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
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

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  unit: string;
}

interface NewTemplate {
  name: string;
  type: 'quote' | 'invoice' | 'job';
  tradeType: string;
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    gstEnabled: boolean;
  };
  defaultLineItems: LineItem[];
}

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token } = useAuthStore();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quote' | 'invoice' | 'job'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    type: 'quote',
    tradeType: 'general',
    defaults: {
      title: '',
      description: '',
      terms: '',
      depositPct: 0,
      gstEnabled: true,
    },
    defaultLineItems: []
  });
  const [isCreating, setIsCreating] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const url = `${API_URL}/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
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
  }, [token, typeFilter]);

  useEffect(() => {
    refreshData();
  }, [typeFilter]);

  const resetForm = () => {
    setNewTemplate({
      name: '',
      type: 'quote',
      tradeType: 'general',
      defaults: {
        title: '',
        description: '',
        terms: '',
        depositPct: 0,
        gstEnabled: true,
      },
      defaultLineItems: []
    });
    setEditingTemplate(null);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }

    setIsCreating(true);
    try {
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate 
        ? `${API_URL}/api/templates/${editingTemplate.id}`
        : `${API_URL}/api/templates`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTemplate.name,
          type: newTemplate.type,
          tradeType: newTemplate.tradeType,
          familyKey: newTemplate.tradeType,
          defaults: newTemplate.defaults,
          defaultLineItems: newTemplate.defaultLineItems.filter(item => item.description.trim()),
          styling: {},
          sections: {
            showHeader: true,
            showLineItems: true,
            showTotals: true,
            showTerms: true,
            showSignature: false,
          },
        }),
      });

      if (response.ok) {
        await refreshData();
        setShowCreateModal(false);
        resetForm();
        Alert.alert('Success', editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      } else {
        const error = await response.text();
        Alert.alert('Error', error || 'Failed to save template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setIsCreating(false);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      type: template.type,
      tradeType: template.tradeType,
      defaults: {
        title: template.defaults?.title || '',
        description: template.defaults?.description || '',
        terms: template.defaults?.terms || '',
        depositPct: template.defaults?.depositPct || 0,
        gstEnabled: template.defaults?.gstEnabled ?? true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setShowCreateModal(true);
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          type: template.type,
          tradeType: template.tradeType,
          familyKey: template.familyKey,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
          styling: template.styling,
          sections: template.sections,
        }),
      });

      if (response.ok) {
        await refreshData();
        Alert.alert('Success', 'Template duplicated successfully');
      } else {
        Alert.alert('Error', 'Failed to duplicate template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleDeleteTemplate = (template: DocumentTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/templates/${template.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                await refreshData();
                Alert.alert('Success', 'Template deleted');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        }
      ]
    );
  };

  const addLineItem = () => {
    setNewTemplate({
      ...newTemplate,
      defaultLineItems: [
        ...newTemplate.defaultLineItems,
        { description: '', qty: 1, unitPrice: 0, unit: 'each' }
      ]
    });
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const items = [...newTemplate.defaultLineItems];
    items[index] = { ...items[index], [field]: value };
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const removeLineItem = (index: number) => {
    const items = newTemplate.defaultLineItems.filter((_, i) => i !== index);
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const filteredTemplates = templates;
  const quoteTemplates = templates.filter(t => t.type === 'quote').length;
  const invoiceTemplates = templates.filter(t => t.type === 'invoice').length;
  const jobTemplates = templates.filter(t => t.type === 'job').length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return 'file-text';
      case 'invoice': return 'file-text';
      case 'job': return 'briefcase';
      default: return 'file';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote': return colors.info;
      case 'invoice': return colors.success;
      case 'job': return colors.warning;
      default: return colors.primary;
    }
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
              <Text style={styles.pageTitle}>Templates</Text>
              <Text style={styles.pageSubtitle}>Manage document templates for quotes, invoices, and jobs</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.createButton}
              onPress={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="Quotes"
              value={quoteTemplates}
              icon={<Feather name="file-text" size={14} color={colors.info} />}
              colors={colors}
            />
            <StatCard
              title="Invoices"
              value={invoiceTemplates}
              icon={<Feather name="file-text" size={14} color={colors.success} />}
              colors={colors}
            />
            <StatCard
              title="Jobs"
              value={jobTemplates}
              icon={<Feather name="briefcase" size={14} color={colors.warning} />}
              colors={colors}
            />
          </View>

          <View style={styles.filtersRow}>
            {(['all', 'quote', 'invoice', 'job'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  typeFilter === type && styles.filterChipActive
                ]}
                onPress={() => setTypeFilter(type)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  typeFilter === type && styles.filterChipTextActive
                ]}>
                  {type === 'all' ? 'All Types' : type + 's'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No templates yet</Text>
              <Text style={styles.emptySubtitle}>
                Create templates to speed up creating quotes, invoices, and jobs
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.emptyButtonText}>Create First Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.templateList}>
              {filteredTemplates.map(template => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <View style={styles.templateMeta}>
                        <Text style={[styles.templateType, { backgroundColor: getTypeColor(template.type) + '20', color: getTypeColor(template.type) }]}>
                          {template.type}
                        </Text>
                        <Text style={styles.templateTrade}>{template.tradeType}</Text>
                      </View>
                    </View>
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDuplicateTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="copy" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.templateDetails}>
                    {template.defaults?.title && (
                      <Text style={styles.templateTitle} numberOfLines={1}>
                        {template.defaults.title}
                      </Text>
                    )}
                    
                    <View style={styles.badgeRow}>
                      {template.defaultLineItems?.length > 0 && (
                        <Text style={styles.badge}>
                          {template.defaultLineItems.length} line items
                        </Text>
                      )}
                      {template.defaults?.depositPct > 0 && (
                        <Text style={styles.badge}>
                          {template.defaults.depositPct}% deposit
                        </Text>
                      )}
                      {template.defaults?.gstEnabled && (
                        <Text style={styles.badge}>GST</Text>
                      )}
                    </View>

                    {template.defaults?.terms && (
                      <Text style={styles.templateTerms} numberOfLines={2}>
                        {template.defaults.terms}
                      </Text>
                    )}
                  </View>
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
              <TouchableOpacity 
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} 
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Name</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.name}
                  onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
                  placeholder="e.g., Standard Plumbing Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Type</Text>
                <View style={styles.typeButtons}>
                  {(['quote', 'invoice', 'job'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newTemplate.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, type })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newTemplate.type === type && styles.typeButtonTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trade Type</Text>
                <View style={styles.tradeTypeContainer}>
                  {tradeTypes.map((trade) => (
                    <TouchableOpacity
                      key={trade}
                      style={[
                        styles.tradeChip,
                        newTemplate.tradeType === trade && styles.tradeChipActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, tradeType: trade })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.tradeChipText,
                        newTemplate.tradeType === trade && styles.tradeChipTextActive
                      ]}>
                        {trade}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.sectionHeader}>Default Values</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Title</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.defaults.title}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, title: text } 
                  })}
                  placeholder="e.g., Plumbing Service Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.description}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, description: text } 
                  })}
                  placeholder="Brief description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Terms</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.terms}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, terms: text } 
                  })}
                  placeholder="Payment terms, conditions..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Deposit (%)</Text>
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  value={String(newTemplate.defaults.depositPct || '')}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, depositPct: parseInt(text) || 0 } 
                  })}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.sectionHeader}>Default Line Items</Text>

              {newTemplate.defaultLineItems.map((item, index) => (
                <View key={index} style={styles.lineItemRow}>
                  <TextInput
                    style={styles.lineItemInput}
                    value={item.description}
                    onChangeText={(text) => updateLineItem(index, 'description', text)}
                    placeholder="Description"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemQty]}
                    value={String(item.qty || '')}
                    onChangeText={(text) => updateLineItem(index, 'qty', parseInt(text) || 1)}
                    placeholder="Qty"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemPrice]}
                    value={String(item.unitPrice || '')}
                    onChangeText={(text) => updateLineItem(index, 'unitPrice', parseFloat(text) || 0)}
                    placeholder="Price"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.removeLineItemButton}
                    onPress={() => removeLineItem(index)}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addLineItemButton}
                onPress={addLineItem}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.addLineItemText}>Add Line Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}
                onPress={handleCreateTemplate}
                disabled={isCreating}
                activeOpacity={0.7}
              >
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {isCreating ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  );
}
