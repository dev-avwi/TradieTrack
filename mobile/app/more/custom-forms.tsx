import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

interface CustomForm {
  id: string;
  name: string;
  description?: string;
  formType: 'general' | 'safety' | 'compliance' | 'inspection';
  fields: FormField[];
  isActive: boolean;
  requiresSignature?: boolean;
}

const FIELD_TYPES: { type: FormField['type']; label: string; icon: string; description: string }[] = [
  { type: 'text', label: 'Text', icon: 'type', description: 'Single line text' },
  { type: 'number', label: 'Number', icon: 'hash', description: 'Numeric input' },
  { type: 'email', label: 'Email', icon: 'mail', description: 'Email address' },
  { type: 'phone', label: 'Phone', icon: 'phone', description: 'Phone number' },
  { type: 'textarea', label: 'Text Area', icon: 'align-left', description: 'Multi-line text' },
  { type: 'checkbox', label: 'Checkbox', icon: 'check-square', description: 'Yes/No option' },
  { type: 'radio', label: 'Radio', icon: 'circle', description: 'Single choice' },
  { type: 'select', label: 'Dropdown', icon: 'list', description: 'Dropdown list' },
  { type: 'date', label: 'Date', icon: 'calendar', description: 'Date picker' },
  { type: 'time', label: 'Time', icon: 'clock', description: 'Time picker' },
  { type: 'photo', label: 'Photo', icon: 'camera', description: 'Photo capture' },
  { type: 'signature', label: 'Signature', icon: 'edit-3', description: 'Signature pad' },
  { type: 'section', label: 'Section', icon: 'minus', description: 'Header divider' },
];

const FORM_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'file-text' },
  { value: 'safety', label: 'Safety', icon: 'shield' },
  { value: 'compliance', label: 'Compliance', icon: 'clipboard' },
  { value: 'inspection', label: 'Inspection', icon: 'search' },
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
    paddingVertical: spacing.xxl * 2,
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
  const [showFormModal, setShowFormModal] = useState(false);
  const [showFieldTypeModal, setShowFieldTypeModal] = useState(false);
  const [showFieldEditModal, setShowFieldEditModal] = useState(false);
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('general');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
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
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadForms();
    setIsRefreshing(false);
  };

  const resetFormState = () => {
    setFormName('');
    setFormDescription('');
    setFormType('general');
    setRequiresSignature(false);
    setIsActive(true);
    setFields([]);
    setEditingForm(null);
  };

  const handleCreateNew = () => {
    resetFormState();
    setShowFormModal(true);
  };

  const handleEditForm = (form: CustomForm) => {
    setEditingForm(form);
    setFormName(form.name);
    setFormDescription(form.description || '');
    setFormType(form.formType || 'general');
    setRequiresSignature(form.requiresSignature || false);
    setIsActive(form.isActive);
    setFields(Array.isArray(form.fields) ? form.fields : []);
    setShowFormModal(true);
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

  const handleSaveForm = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Please enter a form name');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        formType,
        requiresSignature,
        isActive,
        fields,
      };

      if (editingForm) {
        await api.patch(`/api/custom-forms/${editingForm.id}`, payload);
        Alert.alert('Success', 'Form updated');
      } else {
        await api.post('/api/custom-forms', payload);
        Alert.alert('Success', 'Form created');
      }
      
      setShowFormModal(false);
      resetFormState();
      await loadForms();
    } catch (error) {
      Alert.alert('Error', 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = (type: FormField['type']) => {
    const newField: FormField = {
      id: Date.now().toString(),
      type,
      label: FIELD_TYPES.find(f => f.type === type)?.label || 'New Field',
      required: false,
      options: type === 'radio' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setShowFieldTypeModal(false);
    
    setEditingField(newField);
    setFieldLabel(newField.label);
    setFieldPlaceholder(newField.placeholder || '');
    setFieldRequired(newField.required || false);
    setFieldOptions(newField.options || []);
    setShowFieldEditModal(true);
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setFieldLabel(field.label);
    setFieldPlaceholder(field.placeholder || '');
    setFieldRequired(field.required || false);
    setFieldOptions(field.options || []);
    setShowFieldEditModal(true);
  };

  const handleSaveField = () => {
    if (!editingField) return;
    
    const updatedField: FormField = {
      ...editingField,
      label: fieldLabel.trim() || editingField.label,
      placeholder: fieldPlaceholder.trim() || undefined,
      required: fieldRequired,
      options: editingField.type === 'radio' || editingField.type === 'select' ? fieldOptions : undefined,
    };

    setFields(fields.map(f => f.id === editingField.id ? updatedField : f));
    setShowFieldEditModal(false);
    setEditingField(null);
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleMoveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if (direction === 'up' && index > 0) {
      const newFields = [...fields];
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
      setFields(newFields);
    } else if (direction === 'down' && index < fields.length - 1) {
      const newFields = [...fields];
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
      setFields(newFields);
    }
  };

  const addOption = () => {
    if (newOption.trim()) {
      setFieldOptions([...fieldOptions, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setFieldOptions(fieldOptions.filter((_, i) => i !== index));
  };

  const getFieldIcon = (type: FormField['type']) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    return fieldType?.icon || 'type';
  };

  const getFormIcon = (type: string) => {
    const formTypeItem = FORM_TYPES.find(f => f.value === type);
    return formTypeItem?.icon || 'file-text';
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
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + spacing.md }]}
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

      {/* Form Editor Modal */}
      <Modal visible={showFormModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingForm ? 'Edit Form' : 'Create Form'}
              </Text>
              <TouchableOpacity onPress={() => setShowFormModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Form Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g., Safety Checklist"
                  placeholderTextColor={colors.mutedForeground}
                  data-testid="input-form-name"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Optional description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  data-testid="input-form-description"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Form Type</Text>
                <View style={styles.typeSelector}>
                  {FORM_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[styles.typeOption, formType === type.value && styles.typeOptionActive]}
                      onPress={() => setFormType(type.value)}
                      data-testid={`button-type-${type.value}`}
                    >
                      <Feather 
                        name={type.icon as any} 
                        size={14} 
                        color={formType === type.value ? colors.primary : colors.mutedForeground} 
                      />
                      <Text style={[styles.typeOptionText, formType === type.value && styles.typeOptionTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requires Signature</Text>
                <Switch
                  value={requiresSignature}
                  onValueChange={setRequiresSignature}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={requiresSignature ? colors.primary : colors.mutedForeground}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.muted, true: colors.successLight }}
                  thumbColor={isActive ? colors.success : colors.mutedForeground}
                />
              </View>
              
              <View style={styles.fieldsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Form Fields ({fields.length})</Text>
                  <TouchableOpacity 
                    style={styles.addFieldButton}
                    onPress={() => setShowFieldTypeModal(true)}
                    data-testid="button-add-field"
                  >
                    <Feather name="plus" size={14} color={colors.primary} />
                    <Text style={styles.addFieldButtonText}>Add Field</Text>
                  </TouchableOpacity>
                </View>
                
                {fields.map((field, index) => (
                  <View key={field.id} style={styles.fieldCard}>
                    <View style={styles.fieldIcon}>
                      <Feather name={getFieldIcon(field.type) as any} size={iconSizes.sm} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.fieldInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        {field.required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>REQ</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.fieldType}>{FIELD_TYPES.find(f => f.type === field.type)?.description}</Text>
                    </View>
                    <View style={styles.fieldActions}>
                      {index > 0 && (
                        <TouchableOpacity 
                          style={styles.fieldActionButton}
                          onPress={() => handleMoveField(field.id, 'up')}
                        >
                          <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      {index < fields.length - 1 && (
                        <TouchableOpacity 
                          style={styles.fieldActionButton}
                          onPress={() => handleMoveField(field.id, 'down')}
                        >
                          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={styles.fieldActionButton}
                        onPress={() => handleEditField(field)}
                      >
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.fieldActionButton}
                        onPress={() => handleDeleteField(field.id)}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                {fields.length === 0 && (
                  <View style={[styles.emptyState, { paddingVertical: spacing.xl }]}>
                    <Text style={styles.emptyText}>No fields added yet. Tap "Add Field" to start building your form.</Text>
                  </View>
                )}
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowFormModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, isSaving && styles.disabledButton]}
                onPress={handleSaveForm}
                disabled={isSaving}
                data-testid="button-save-form"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Form</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Field Type Selector Modal */}
      <Modal visible={showFieldTypeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Field</Text>
              <TouchableOpacity onPress={() => setShowFieldTypeModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.fieldTypeGrid}>
              {FIELD_TYPES.map(fieldType => (
                <TouchableOpacity
                  key={fieldType.type}
                  style={styles.fieldTypeItem}
                  onPress={() => handleAddField(fieldType.type)}
                  data-testid={`button-field-type-${fieldType.type}`}
                >
                  <View style={styles.fieldTypeItemIcon}>
                    <Feather name={fieldType.icon as any} size={iconSizes.md} color={colors.primary} />
                  </View>
                  <Text style={styles.fieldTypeItemLabel}>{fieldType.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Field Editor Modal */}
      <Modal visible={showFieldEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Field</Text>
              <TouchableOpacity onPress={() => setShowFieldEditModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Label *</Text>
                <TextInput
                  style={styles.input}
                  value={fieldLabel}
                  onChangeText={setFieldLabel}
                  placeholder="Field label"
                  placeholderTextColor={colors.mutedForeground}
                  data-testid="input-field-label"
                />
              </View>
              
              {editingField?.type !== 'section' && editingField?.type !== 'checkbox' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Placeholder (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={fieldPlaceholder}
                    onChangeText={setFieldPlaceholder}
                    placeholder="Placeholder text..."
                    placeholderTextColor={colors.mutedForeground}
                    data-testid="input-field-placeholder"
                  />
                </View>
              )}
              
              {(editingField?.type === 'radio' || editingField?.type === 'select') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Options</Text>
                  {fieldOptions.map((option, index) => (
                    <View key={index} style={styles.optionRow}>
                      <TextInput
                        style={styles.optionInput}
                        value={option}
                        onChangeText={(text) => {
                          const newOptions = [...fieldOptions];
                          newOptions[index] = text;
                          setFieldOptions(newOptions);
                        }}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <TouchableOpacity 
                        style={styles.deleteOptionButton}
                        onPress={() => removeOption(index)}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.optionRow}>
                    <TextInput
                      style={styles.optionInput}
                      value={newOption}
                      onChangeText={setNewOption}
                      placeholder="Add option..."
                      placeholderTextColor={colors.mutedForeground}
                      onSubmitEditing={addOption}
                      data-testid="input-new-option"
                    />
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: colors.primaryLight }]}
                      onPress={addOption}
                    >
                      <Feather name="plus" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {editingField?.type !== 'section' && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Required</Text>
                  <Switch
                    value={fieldRequired}
                    onValueChange={setFieldRequired}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={fieldRequired ? colors.primary : colors.mutedForeground}
                  />
                </View>
              )}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowFieldEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveField}
                data-testid="button-save-field"
              >
                <Text style={styles.saveButtonText}>Save Field</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
