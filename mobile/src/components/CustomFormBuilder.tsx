import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, typography } from '../lib/design-tokens';
import { api } from '../lib/api';

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  description?: string;
  defaultValue?: string;
}

interface CustomForm {
  id?: string;
  name: string;
  description?: string;
  category: 'job' | 'safety' | 'inspection' | 'other';
  fields: FormField[];
  isActive: boolean;
}

interface CustomFormBuilderProps {
  form?: CustomForm;
  onSave: (form: CustomForm) => Promise<void>;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { type: 'text' as const, label: 'Text', icon: 'type' as const, description: 'Single line text' },
  { type: 'number' as const, label: 'Number', icon: 'hash' as const, description: 'Numeric input' },
  { type: 'email' as const, label: 'Email', icon: 'mail' as const, description: 'Email address' },
  { type: 'phone' as const, label: 'Phone', icon: 'phone' as const, description: 'Phone number' },
  { type: 'textarea' as const, label: 'Long Text', icon: 'align-left' as const, description: 'Multi-line text' },
  { type: 'checkbox' as const, label: 'Checkbox', icon: 'check-square' as const, description: 'Yes/No option' },
  { type: 'radio' as const, label: 'Radio', icon: 'circle' as const, description: 'Single choice' },
  { type: 'select' as const, label: 'Dropdown', icon: 'list' as const, description: 'Select from list' },
  { type: 'date' as const, label: 'Date', icon: 'calendar' as const, description: 'Date picker' },
  { type: 'time' as const, label: 'Time', icon: 'clock' as const, description: 'Time picker' },
  { type: 'photo' as const, label: 'Photo', icon: 'camera' as const, description: 'Take/upload photo' },
  { type: 'signature' as const, label: 'Signature', icon: 'edit-3' as const, description: 'Digital signature' },
  { type: 'section' as const, label: 'Section', icon: 'minus' as const, description: 'Section divider' },
];

const CATEGORIES = [
  { value: 'job' as const, label: 'Job Form', icon: 'briefcase' as const },
  { value: 'safety' as const, label: 'Safety Checklist', icon: 'shield' as const },
  { value: 'inspection' as const, label: 'Inspection', icon: 'search' as const },
  { value: 'other' as const, label: 'Other', icon: 'file-text' as const },
];

function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function CustomFormBuilder({ form, onSave, onCancel }: CustomFormBuilderProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [formName, setFormName] = useState(form?.name || '');
  const [formDescription, setFormDescription] = useState(form?.description || '');
  const [category, setCategory] = useState<CustomForm['category']>(form?.category || 'job');
  const [fields, setFields] = useState<FormField[]>(form?.fields || []);
  const [isActive, setIsActive] = useState(form?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // Field type picker modal
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  
  // Field editor modal
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);

  // Category picker modal
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: generateId(),
      type,
      label: FIELD_TYPES.find(f => f.type === type)?.label || 'New Field',
      required: false,
      options: type === 'radio' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setShowFieldPicker(false);
    setEditingField(newField);
    setShowFieldEditor(true);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
    setShowFieldEditor(false);
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    Alert.alert(
      'Delete Field',
      'Are you sure you want to delete this field?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setFields(fields.filter(f => f.id !== fieldId)),
        },
      ]
    );
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Please enter a form name');
      return;
    }

    if (fields.length === 0) {
      Alert.alert('Error', 'Please add at least one field');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: form?.id,
        name: formName,
        description: formDescription,
        category,
        fields,
        isActive,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  const getFieldIcon = (type: FormField['type']): keyof typeof Feather.glyphMap => {
    return FIELD_TYPES.find(f => f.type === type)?.icon || 'file-text';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {form?.id ? 'Edit Form' : 'Create Form'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="save" size={16} color={colors.primaryForeground} />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Form Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="Enter form name..."
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Enter description..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TouchableOpacity
              style={styles.categorySelector}
              onPress={() => setShowCategoryPicker(true)}
            >
              <View style={styles.categoryDisplay}>
                <Feather
                  name={CATEGORIES.find(c => c.value === category)?.icon || 'file-text'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.categoryText}>
                  {CATEGORIES.find(c => c.value === category)?.label}
                </Text>
              </View>
              <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.switchTitle}>Active</Text>
              <Text style={styles.switchDescription}>Form is available for use</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        {/* Fields Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Form Fields</Text>
            <View style={styles.fieldCount}>
              <Text style={styles.fieldCountText}>{fields.length}</Text>
            </View>
          </View>

          {fields.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="layers" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyStateTitle}>No fields yet</Text>
              <Text style={styles.emptyStateText}>
                Add fields to build your form
              </Text>
            </View>
          ) : (
            <View style={styles.fieldsList}>
              {fields.map((field, index) => (
                <View key={field.id} style={styles.fieldCard}>
                  <View style={styles.fieldCardLeft}>
                    <View style={styles.fieldIconContainer}>
                      <Feather
                        name={getFieldIcon(field.type)}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.fieldInfo}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <Text style={styles.fieldType}>
                        {FIELD_TYPES.find(f => f.type === field.type)?.label}
                        {field.required && ' • Required'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.fieldActions}>
                    <TouchableOpacity
                      style={styles.fieldActionButton}
                      onPress={() => moveField(index, 'up')}
                      disabled={index === 0}
                    >
                      <Feather
                        name="chevron-up"
                        size={18}
                        color={index === 0 ? colors.muted : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.fieldActionButton}
                      onPress={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                    >
                      <Feather
                        name="chevron-down"
                        size={18}
                        color={index === fields.length - 1 ? colors.muted : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.fieldActionButton}
                      onPress={() => {
                        setEditingField(field);
                        setShowFieldEditor(true);
                      }}
                    >
                      <Feather name="edit-2" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.fieldActionButton}
                      onPress={() => deleteField(field.id)}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addFieldButton}
            onPress={() => setShowFieldPicker(true)}
          >
            <Feather name="plus" size={20} color={colors.primary} />
            <Text style={styles.addFieldText}>Add Field</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Field Type Picker Modal */}
      <Modal
        visible={showFieldPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFieldPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Field</Text>
            <ScrollView style={styles.fieldTypeList}>
              {FIELD_TYPES.map((fieldType) => (
                <TouchableOpacity
                  key={fieldType.type}
                  style={styles.fieldTypeItem}
                  onPress={() => addField(fieldType.type)}
                >
                  <View style={styles.fieldTypeIcon}>
                    <Feather name={fieldType.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.fieldTypeInfo}>
                    <Text style={styles.fieldTypeName}>{fieldType.label}</Text>
                    <Text style={styles.fieldTypeDesc}>{fieldType.description}</Text>
                  </View>
                  <Feather name="plus" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowFieldPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Field Editor Modal */}
      <FieldEditorModal
        visible={showFieldEditor}
        field={editingField}
        onSave={updateField}
        onClose={() => {
          setShowFieldEditor(false);
          setEditingField(null);
        }}
        colors={colors}
      />

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Category</Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryOption,
                  category === cat.value && styles.categoryOptionActive,
                ]}
                onPress={() => {
                  setCategory(cat.value);
                  setShowCategoryPicker(false);
                }}
              >
                <Feather
                  name={cat.icon}
                  size={20}
                  color={category === cat.value ? colors.primary : colors.foreground}
                />
                <Text
                  style={[
                    styles.categoryOptionText,
                    category === cat.value && styles.categoryOptionTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
                {category === cat.value && (
                  <Feather name="check" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface FieldEditorModalProps {
  visible: boolean;
  field: FormField | null;
  onSave: (field: FormField) => void;
  onClose: () => void;
  colors: ThemeColors;
}

function FieldEditorModal({ visible, field, onSave, onClose, colors }: FieldEditorModalProps) {
  const styles = useMemo(() => createStyles(colors, false), [colors]);
  
  const [label, setLabel] = useState(field?.label || '');
  const [placeholder, setPlaceholder] = useState(field?.placeholder || '');
  const [description, setDescription] = useState(field?.description || '');
  const [required, setRequired] = useState(field?.required || false);
  const [options, setOptions] = useState<string[]>(field?.options || []);
  const [newOption, setNewOption] = useState('');

  const needsOptions = field?.type === 'radio' || field?.type === 'select';

  const handleSave = () => {
    if (!field || !label.trim()) {
      Alert.alert('Error', 'Please enter a field label');
      return;
    }

    onSave({
      ...field,
      label,
      placeholder,
      description,
      required,
      options: needsOptions ? options : undefined,
    });
  };

  const addOption = () => {
    if (newOption.trim()) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  if (!field) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.editorSheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Edit Field</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Field label..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Placeholder (optional)</Text>
              <TextInput
                style={styles.input}
                value={placeholder}
                onChangeText={setPlaceholder}
                placeholder="Placeholder text..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Help Text (optional)</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Help text for users..."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>Required</Text>
                <Text style={styles.switchDescription}>User must fill this field</Text>
              </View>
              <Switch
                value={required}
                onValueChange={setRequired}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {needsOptions && (
              <View style={styles.optionsSection}>
                <Text style={styles.inputLabel}>Options</Text>
                {options.map((option, index) => (
                  <View key={index} style={styles.optionRow}>
                    <Text style={styles.optionText}>{option}</Text>
                    <TouchableOpacity onPress={() => removeOption(index)}>
                      <Feather name="x" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addOptionRow}>
                  <TextInput
                    style={[styles.input, styles.optionInput]}
                    value={newOption}
                    onChangeText={setNewOption}
                    placeholder="Add option..."
                    placeholderTextColor={colors.mutedForeground}
                    onSubmitEditing={addOption}
                  />
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={addOption}
                  >
                    <Feather name="plus" size={18} color={colors.primaryForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing['2xl'],
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    fieldCount: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    fieldCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.foreground,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    categorySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    categoryDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    categoryText: {
      fontSize: 15,
      color: colors.foreground,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    switchLabel: {
      flex: 1,
    },
    switchTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    switchDescription: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['2xl'],
      backgroundColor: colors.muted,
      borderRadius: radius.xl,
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
      marginTop: spacing.md,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
    fieldsList: {
      gap: spacing.sm,
    },
    fieldCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
    },
    fieldIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldInfo: {
      flex: 1,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    fieldType: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    fieldActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    fieldActionButton: {
      padding: spacing.xs,
    },
    addFieldButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    addFieldText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    bottomSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      maxHeight: '80%',
      paddingBottom: spacing['2xl'],
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    fieldTypeList: {
      paddingHorizontal: spacing.lg,
    },
    fieldTypeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fieldTypeIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    fieldTypeInfo: {
      flex: 1,
    },
    fieldTypeName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    fieldTypeDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    cancelButton: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: colors.mutedForeground,
    },
    categoryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoryOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    categoryOptionText: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    categoryOptionTextActive: {
      fontWeight: '600',
      color: colors.primary,
    },
    editorSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      maxHeight: '90%',
    },
    editorContent: {
      padding: spacing.lg,
    },
    optionsSection: {
      marginTop: spacing.md,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    },
    optionText: {
      fontSize: 14,
      color: colors.foreground,
    },
    addOptionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    optionInput: {
      flex: 1,
    },
    addOptionButton: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default CustomFormBuilder;
