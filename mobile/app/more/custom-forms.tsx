import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';
import { CustomFormBuilder, FormField } from '../../src/components/CustomFormBuilder';

interface CustomForm {
  id: string;
  name: string;
  description?: string;
  formType: 'general' | 'safety' | 'compliance' | 'inspection';
  fields: FormField[];
  isActive: boolean;
  requiresSignature?: boolean;
}

const FORM_TYPE_ICONS: Record<string, string> = {
  general: 'file-text',
  safety: 'shield',
  compliance: 'clipboard',
  inspection: 'search',
  job: 'briefcase',
  other: 'file-text',
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingTop: spacing.xs,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'] * 2,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginBottom: spacing.lg,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  formIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  formDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  formMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  activeBadgeText: {
    color: colors.success,
  },
  inactiveBadge: {
    backgroundColor: colors.muted,
  },
  inactiveBadgeText: {
    color: colors.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeOptionText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  typeOptionTextActive: {
    color: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchLabel: {
    fontSize: 15,
    color: colors.foreground,
  },
  fieldsSection: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  addFieldButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  fieldCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  fieldType: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  requiredBadge: {
    backgroundColor: colors.destructiveLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginLeft: spacing.sm,
  },
  requiredText: {
    fontSize: 10,
    color: colors.destructive,
    fontWeight: '600',
  },
  fieldActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  fieldActionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.muted,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  disabledButton: {
    opacity: 0.6,
  },
  fieldTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  fieldTypeItem: {
    width: '31%',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  fieldTypeItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  fieldTypeItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteOptionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.destructiveLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function CustomFormsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);

  const loadForms = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<CustomForm[]>('/api/custom-forms');
      if (res.data) {
        setForms(res.data);
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      loadForms();
    }, [loadForms])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadForms();
    setIsRefreshing(false);
  };

  const handleCreateNew = () => {
    setEditingForm(null);
    setShowFormBuilder(true);
  };

  const handleEditForm = (form: CustomForm) => {
    setEditingForm(form);
    setShowFormBuilder(true);
  };

  const handleDeleteForm = (form: CustomForm) => {
    Alert.alert(
      'Delete Form',
      `Are you sure you want to delete "${form.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/custom-forms/${form.id}`);
              await loadForms();
              Alert.alert('Success', 'Form deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete form');
            }
          },
        },
      ]
    );
  };

  const handleFormBuilderSave = async (formData: { id?: string; name: string; description?: string; category: string; fields: FormField[]; isActive: boolean }) => {
    const payload = {
      name: formData.name,
      description: formData.description || null,
      formType: formData.category,
      isActive: formData.isActive,
      fields: formData.fields,
    };

    if (editingForm?.id) {
      await api.patch(`/api/custom-forms/${editingForm.id}`, payload);
      Alert.alert('Success', 'Form updated');
    } else {
      await api.post('/api/custom-forms', payload);
      Alert.alert('Success', 'Form created');
    }
    
    setShowFormBuilder(false);
    setEditingForm(null);
    await loadForms();
  };

  const getFormIcon = (type: string) => {
    return FORM_TYPE_ICONS[type] || 'file-text';
  };

  const renderForm = ({ item: form }: { item: CustomForm }) => (
    <TouchableOpacity 
      style={styles.formCard}
      onPress={() => handleEditForm(form)}
      activeOpacity={0.7}
      data-testid={`form-card-${form.id}`}
    >
      <View style={styles.formCardHeader}>
        <View style={styles.formIconContainer}>
          <Feather name={getFormIcon(form.formType) as any} size={iconSizes.lg} color={colors.primary} />
        </View>
        <View style={styles.formCardActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEditForm(form)}
            data-testid={`button-edit-form-${form.id}`}
          >
            <Feather name="edit-2" size={iconSizes.sm} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDeleteForm(form)}
            data-testid={`button-delete-form-${form.id}`}
          >
            <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.formName}>{form.name}</Text>
      {form.description && (
        <Text style={styles.formDescription} numberOfLines={2}>{form.description}</Text>
      )}
      
      <View style={styles.formMeta}>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { textTransform: 'capitalize' }]}>{form.formType}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Array.isArray(form.fields) ? form.fields.length : 0} fields</Text>
        </View>
        {form.requiresSignature && (
          <View style={styles.badge}>
            <Feather name="edit-3" size={10} color={colors.mutedForeground} />
            <Text style={styles.badgeText}>Sign</Text>
          </View>
        )}
        <View style={[styles.badge, form.isActive ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.badgeText, form.isActive ? styles.activeBadgeText : styles.inactiveBadgeText]}>
            {form.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Custom Forms',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setShowFormBuilder(true)}
              style={{ marginRight: spacing.md }}
            >
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Custom Forms</Text>
            <Text style={styles.pageSubtitle}>Create and manage form templates</Text>
          </View>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreateNew}
            data-testid="button-create-form"
          >
            <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : forms.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="clipboard" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No forms yet</Text>
            <Text style={styles.emptyText}>Create your first custom form template</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
              <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Create Form</Text>
            </TouchableOpacity>
          </View>
        ) : (
          forms.map(form => (
            <View key={form.id}>
              {renderForm({ item: form })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Custom Form Builder Modal */}
      {showFormBuilder && (
        <Modal visible={showFormBuilder} animationType="slide" presentationStyle="pageSheet">
          <CustomFormBuilder
            form={editingForm ? {
              id: editingForm.id,
              name: editingForm.name,
              description: editingForm.description,
              category: (editingForm.formType || 'job') as 'job' | 'safety' | 'inspection' | 'other',
              fields: editingForm.fields || [],
              isActive: editingForm.isActive,
            } : undefined}
            onSave={handleFormBuilderSave}
            onCancel={() => {
              setShowFormBuilder(false);
              setEditingForm(null);
            }}
          />
        </Modal>
      )}
    </View>
  );
}
