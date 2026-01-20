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
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL } from '../../src/lib/api';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';
import LiveDocumentPreview from '../../src/components/LiveDocumentPreview';
import { TemplateId, DOCUMENT_TEMPLATES } from '../../src/lib/document-templates';

interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  isDefault?: boolean;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
    templateStyle?: TemplateId;
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

const templateStyles: { id: TemplateId; name: string; description: string }[] = [
  { id: 'professional', name: 'Professional', description: 'Traditional layout with bordered tables' },
  { id: 'modern', name: 'Modern', description: 'Clean design with bold brand colors' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-clean with subtle styling' },
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
  createdByYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  createdByYouBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary,
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  previewScrollView: {
    flex: 1,
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
  styleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  styleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  styleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  styleName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  styleDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colorPreview: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPresets: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  colorPreset: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPresetActive: {
    borderColor: colors.foreground,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  switchLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    padding: 2,
  },
  switchTrackActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  switchThumbActive: {
    marginLeft: 20,
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
  previewTotalBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  previewTotalText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  styling: {
    brandColor: string;
    logoDisplay: boolean;
    templateStyle: TemplateId;
  };
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    gstEnabled: boolean;
  };
  defaultLineItems: LineItem[];
}

const colorPresets = [
  '#1e3a5f',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0891b2',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, businessSettings } = useAuthStore();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quote' | 'invoice' | 'job'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    type: 'quote',
    tradeType: 'general',
    styling: {
      brandColor: '#1e3a5f',
      logoDisplay: true,
      templateStyle: 'minimal',
    },
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
      styling: {
        brandColor: businessSettings?.brandColor || '#1e3a5f',
        logoDisplay: true,
        templateStyle: 'minimal',
      },
      defaults: {
        title: '',
        description: '',
        terms: '',
        depositPct: 0,
        gstEnabled: businessSettings?.gstEnabled ?? true,
      },
      defaultLineItems: []
    });
    setEditingTemplate(null);
    setActiveTab('edit');
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
          styling: newTemplate.styling,
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
      styling: {
        brandColor: template.styling?.brandColor || '#1e3a5f',
        logoDisplay: template.styling?.logoDisplay ?? true,
        templateStyle: (template.styling?.templateStyle as TemplateId) || 'minimal',
      },
      defaults: {
        title: template.defaults?.title || '',
        description: template.defaults?.description || '',
        terms: template.defaults?.terms || '',
        depositPct: template.defaults?.depositPct || 0,
        gstEnabled: template.defaults?.gstEnabled ?? true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setActiveTab('edit');
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

  const subtotal = useMemo(() => {
    return newTemplate.defaultLineItems.reduce((sum, item) => {
      return sum + (item.qty || 0) * (item.unitPrice || 0);
    }, 0);
  }, [newTemplate.defaultLineItems]);

  const gst = newTemplate.defaults.gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  const previewLineItems = useMemo(() => {
    const items = newTemplate.defaultLineItems
      .filter(item => item.description.trim())
      .map(item => ({
        description: item.description,
        quantity: item.qty || 1,
        unitPrice: item.unitPrice || 0,
      }));
    
    if (items.length === 0) {
      return [
        { description: 'Sample Service Item', quantity: 2, unitPrice: 150 },
        { description: 'Materials & Supplies', quantity: 1, unitPrice: 85 },
      ];
    }
    return items;
  }, [newTemplate.defaultLineItems]);

  const businessInfo = useMemo(() => ({
    businessName: businessSettings?.businessName || 'Your Business Name',
    abn: businessSettings?.abn,
    address: businessSettings?.address,
    phone: businessSettings?.phone,
    email: businessSettings?.email,
    logoUrl: newTemplate.styling.logoDisplay ? businessSettings?.logoUrl : undefined,
    brandColor: newTemplate.styling.brandColor,
    gstEnabled: newTemplate.defaults.gstEnabled,
  }), [businessSettings, newTemplate.styling, newTemplate.defaults.gstEnabled]);

  const sampleClient = useMemo(() => ({
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '0400 123 456',
    address: '123 Sample Street, Sydney NSW 2000',
  }), []);

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

  const renderEditTab = () => (
    <ScrollView 
      style={styles.modalContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Template Name *</Text>
        <TextInput
          style={styles.input}
          value={newTemplate.name}
          onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
          placeholder="e.g., Plumbing Quote Template"
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

      <Text style={styles.sectionHeader}>Document Style</Text>
      
      {templateStyles.map((style) => (
        <TouchableOpacity
          key={style.id}
          style={[
            styles.styleCard,
            newTemplate.styling.templateStyle === style.id && styles.styleCardActive
          ]}
          onPress={() => setNewTemplate({
            ...newTemplate,
            styling: { ...newTemplate.styling, templateStyle: style.id }
          })}
          activeOpacity={0.7}
        >
          <View style={styles.styleCardHeader}>
            <Text style={styles.styleName}>{style.name}</Text>
            {newTemplate.styling.templateStyle === style.id && (
              <Feather name="check-circle" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.styleDescription}>{style.description}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionHeader}>Brand Color</Text>
      
      <View style={styles.inputGroup}>
        <View style={styles.colorPickerRow}>
          <View 
            style={[styles.colorPreview, { backgroundColor: newTemplate.styling.brandColor }]}
          />
          <TextInput
            style={styles.colorInput}
            value={newTemplate.styling.brandColor}
            onChangeText={(text) => setNewTemplate({
              ...newTemplate,
              styling: { ...newTemplate.styling, brandColor: text }
            })}
            placeholder="#1e3a5f"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.colorPresets}>
          {colorPresets.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorPreset,
                { backgroundColor: color },
                newTemplate.styling.brandColor === color && styles.colorPresetActive
              ]}
              onPress={() => setNewTemplate({
                ...newTemplate,
                styling: { ...newTemplate.styling, brandColor: color }
              })}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>Display Options</Text>

      <TouchableOpacity
        style={styles.switchRow}
        onPress={() => setNewTemplate({
          ...newTemplate,
          styling: { ...newTemplate.styling, logoDisplay: !newTemplate.styling.logoDisplay }
        })}
        activeOpacity={0.7}
      >
        <Text style={styles.switchLabel}>Show Logo on Documents</Text>
        <View style={[
          styles.switchTrack,
          newTemplate.styling.logoDisplay && styles.switchTrackActive
        ]}>
          <View style={[
            styles.switchThumb,
            newTemplate.styling.logoDisplay && styles.switchThumbActive
          ]} />
        </View>
      </TouchableOpacity>

      {newTemplate.type !== 'job' && (
        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => setNewTemplate({
            ...newTemplate,
            defaults: { ...newTemplate.defaults, gstEnabled: !newTemplate.defaults.gstEnabled }
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLabel}>Include GST (10%)</Text>
          <View style={[
            styles.switchTrack,
            newTemplate.defaults.gstEnabled && styles.switchTrackActive
          ]}>
            <View style={[
              styles.switchThumb,
              newTemplate.defaults.gstEnabled && styles.switchThumbActive
            ]} />
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionHeader}>Default Content</Text>

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

      {newTemplate.type !== 'job' && (
        <>
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
        </>
      )}

      {newTemplate.type === 'job' && (
        <View style={styles.inputGroup}>
          <View style={{ 
            backgroundColor: colors.primaryLight, 
            padding: spacing.md, 
            borderRadius: radius.lg,
            marginTop: spacing.md
          }}>
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500', marginBottom: 4 }}>
              Job Template
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              Job templates save the default title and description for quick job creation. 
              They don't include pricing as jobs get quoted separately.
            </Text>
          </View>
        </View>
      )}

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
  );

  const renderPreviewTab = () => {
    if (newTemplate.type === 'job') {
      return (
        <View style={[styles.previewContainer, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
          <Feather name="briefcase" size={48} color={colors.warning} style={{ marginBottom: spacing.lg }} />
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm, textAlign: 'center' }}>
            Job Template Preview
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg }}>
            Job templates don't generate documents. They provide quick defaults for creating new jobs.
          </Text>
          <View style={{ 
            backgroundColor: colors.card, 
            borderRadius: radius.lg, 
            padding: spacing.lg,
            width: '100%',
            borderWidth: 1,
            borderColor: colors.border
          }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Title</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: spacing.md }}>
              {newTemplate.defaults.title || 'Untitled Job'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Description</Text>
            <Text style={{ fontSize: 14, color: colors.foreground }}>
              {newTemplate.defaults.description || 'No description set'}
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.previewContainer}>
        <LiveDocumentPreview
          type={newTemplate.type}
          documentNumber={newTemplate.type === 'quote' ? 'Q-PREVIEW' : 'INV-PREVIEW'}
          title={newTemplate.defaults.title || `Sample ${newTemplate.type === 'quote' ? 'Quote' : 'Invoice'}`}
          description={newTemplate.defaults.description || 'This is a preview of how your document will look with the selected template style and settings.'}
          date={new Date().toISOString()}
          validUntil={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
          dueDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()}
          lineItems={previewLineItems}
          notes="Thank you for your business!"
          terms={newTemplate.defaults.terms || 'Payment due within 14 days. Late payments may incur additional fees.'}
          business={businessInfo}
          client={sampleClient}
          showDepositSection={newTemplate.defaults.depositPct > 0}
          depositPercent={newTemplate.defaults.depositPct}
          gstEnabled={newTemplate.defaults.gstEnabled}
          templateId={newTemplate.styling.templateStyle}
          templateCustomization={{
            accentColor: newTemplate.styling.brandColor,
          }}
        />
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
                  {type === 'all' ? 'All' : type}
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
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Templates Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create templates to quickly generate quotes, invoices, and jobs with pre-filled information.
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
                <Text style={styles.emptyButtonText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.templateList}>
              {filteredTemplates.map((template) => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <View style={styles.templateMeta}>
                        <Text style={styles.templateType}>{template.type}</Text>
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
                  
                  {template.defaults?.title && (
                    <View style={styles.templateDetails}>
                      <Text style={styles.templateTitle}>{template.defaults.title}</Text>
                    </View>
                  )}
                  
                  <View style={styles.badgeRow}>
                    {!template.isDefault && (
                      <View style={styles.createdByYouBadge}>
                        <Feather name="user" size={10} color={colors.primary} />
                        <Text style={styles.createdByYouBadgeText}>Created by you</Text>
                      </View>
                    )}
                    {template.defaultLineItems?.length > 0 && (
                      <Text style={styles.badge}>
                        {template.defaultLineItems.length} item{template.defaultLineItems.length !== 1 ? 's' : ''}
                      </Text>
                    )}
                    {template.defaults?.gstEnabled && (
                      <Text style={styles.badge}>GST included</Text>
                    )}
                    {template.defaults?.depositPct > 0 && (
                      <Text style={styles.badge}>{template.defaults.depositPct}% deposit</Text>
                    )}
                    {template.styling?.templateStyle && (
                      <Text style={styles.badge}>{template.styling.templateStyle} style</Text>
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
          onRequestClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
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
              <View style={styles.previewTotalBadge}>
                <Text style={styles.previewTotalText}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'edit' && styles.tabActive]}
                onPress={() => setActiveTab('edit')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="edit-2" 
                  size={16} 
                  color={activeTab === 'edit' ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.tabText, activeTab === 'edit' && styles.tabTextActive]}>
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'preview' && styles.tabActive]}
                onPress={() => setActiveTab('preview')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="eye" 
                  size={16} 
                  color={activeTab === 'preview' ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>
                  Preview
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'edit' ? renderEditTab() : renderPreviewTab()}
          </View>
        </Modal>
      </View>
    </>
  );
}
