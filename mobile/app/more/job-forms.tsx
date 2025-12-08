import { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, pageShell } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea' | 'signature' | 'photo' | 'date' | 'time';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  fields: FormField[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

const DEFAULT_TEMPLATES: Omit<FormTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Safety Checklist',
    description: 'Pre-work safety checklist for job sites',
    category: 'safety',
    isActive: true,
    isDefault: false,
    fields: [
      { id: 'ppe', type: 'checkbox', label: 'PPE worn (hard hat, hi-vis, safety boots)', required: true },
      { id: 'site_hazards', type: 'checkbox', label: 'Site hazards identified and addressed', required: true },
      { id: 'isolation_check', type: 'checkbox', label: 'Power/water isolation confirmed', required: true },
      { id: 'first_aid', type: 'checkbox', label: 'First aid kit accessible', required: true },
      { id: 'emergency_exits', type: 'checkbox', label: 'Emergency exits identified', required: true },
      { id: 'working_alone', type: 'select', label: 'Working alone?', required: true, options: ['Yes', 'No'] },
      { id: 'weather_ok', type: 'checkbox', label: 'Weather conditions safe for work', required: true },
      { id: 'hazard_notes', type: 'textarea', label: 'Additional hazard notes', required: false, placeholder: 'Describe any other hazards observed' },
      { id: 'signature', type: 'signature', label: 'Worker signature', required: true },
    ],
  },
  {
    name: 'Site Induction',
    description: 'Customer site induction and safety briefing',
    category: 'compliance',
    isActive: true,
    isDefault: false,
    fields: [
      { id: 'site_contact', type: 'text', label: 'Site contact name', required: true, placeholder: 'Name of person giving induction' },
      { id: 'site_contact_phone', type: 'text', label: 'Site contact phone', required: true, placeholder: 'Phone number' },
      { id: 'parking', type: 'text', label: 'Parking location', required: false, placeholder: 'Where to park' },
      { id: 'access_code', type: 'text', label: 'Access code/key location', required: false, placeholder: 'Gate code, key location, etc.' },
      { id: 'hazards_briefed', type: 'checkbox', label: 'Site hazards briefed', required: true },
      { id: 'emergency_procedures', type: 'checkbox', label: 'Emergency procedures explained', required: true },
      { id: 'toilet_facilities', type: 'text', label: 'Toilet facilities location', required: false },
      { id: 'special_requirements', type: 'textarea', label: 'Special requirements', required: false, placeholder: 'Pet on site, hours restrictions, etc.' },
      { id: 'customer_signature', type: 'signature', label: 'Customer signature', required: true },
      { id: 'worker_signature', type: 'signature', label: 'Worker signature', required: true },
    ],
  },
  {
    name: 'Work Order',
    description: 'Job work order with scope and materials',
    category: 'general',
    isActive: true,
    isDefault: false,
    fields: [
      { id: 'scope_of_work', type: 'textarea', label: 'Scope of work', required: true, placeholder: 'Describe work to be completed' },
      { id: 'materials_used', type: 'textarea', label: 'Materials used', required: false, placeholder: 'List materials and quantities' },
      { id: 'start_time', type: 'time', label: 'Work start time', required: true },
      { id: 'end_time', type: 'time', label: 'Work end time', required: true },
      { id: 'work_completed', type: 'checkbox', label: 'Work completed as per quote', required: true },
      { id: 'variations', type: 'textarea', label: 'Variations or additional work', required: false, placeholder: 'Any changes from original scope' },
      { id: 'site_left_clean', type: 'checkbox', label: 'Site left clean and tidy', required: true },
      { id: 'before_photo', type: 'photo', label: 'Before photo', required: false },
      { id: 'after_photo', type: 'photo', label: 'After photo', required: false },
      { id: 'worker_signature', type: 'signature', label: 'Worker signature', required: true },
    ],
  },
  {
    name: 'Job Completion',
    description: 'Customer sign-off for completed work',
    category: 'compliance',
    isActive: true,
    isDefault: false,
    fields: [
      { id: 'work_inspected', type: 'checkbox', label: 'Customer has inspected completed work', required: true },
      { id: 'work_satisfactory', type: 'select', label: 'Work completed to satisfaction?', required: true, options: ['Yes', 'No', 'Partial'] },
      { id: 'follow_up_required', type: 'select', label: 'Follow-up required?', required: true, options: ['Yes', 'No'] },
      { id: 'follow_up_notes', type: 'textarea', label: 'Follow-up notes', required: false, placeholder: 'What needs to be done' },
      { id: 'warranty_explained', type: 'checkbox', label: 'Warranty terms explained', required: true },
      { id: 'customer_feedback', type: 'textarea', label: 'Customer feedback', required: false, placeholder: 'Any comments or feedback' },
      { id: 'rating', type: 'select', label: 'Customer rating', required: false, options: ['5 - Excellent', '4 - Good', '3 - Average', '2 - Poor', '1 - Very Poor'] },
      { id: 'customer_signature', type: 'signature', label: 'Customer signature', required: true },
      { id: 'completion_date', type: 'date', label: 'Completion date', required: true },
    ],
  },
  {
    name: 'Electrical Test & Tag',
    description: 'Electrical testing and tagging record',
    category: 'electrical',
    isActive: true,
    isDefault: false,
    fields: [
      { id: 'equipment_name', type: 'text', label: 'Equipment name/description', required: true },
      { id: 'serial_number', type: 'text', label: 'Serial number', required: false },
      { id: 'location', type: 'text', label: 'Equipment location', required: true },
      { id: 'visual_inspection', type: 'select', label: 'Visual inspection result', required: true, options: ['Pass', 'Fail'] },
      { id: 'earth_continuity', type: 'select', label: 'Earth continuity test', required: true, options: ['Pass', 'Fail', 'N/A'] },
      { id: 'insulation_resistance', type: 'select', label: 'Insulation resistance test', required: true, options: ['Pass', 'Fail', 'N/A'] },
      { id: 'polarity_check', type: 'select', label: 'Polarity check', required: true, options: ['Pass', 'Fail', 'N/A'] },
      { id: 'overall_result', type: 'select', label: 'Overall result', required: true, options: ['Pass - Tag Applied', 'Fail - Out of Service'] },
      { id: 'next_test_date', type: 'date', label: 'Next test date', required: true },
      { id: 'technician_name', type: 'text', label: 'Technician name', required: true },
      { id: 'license_number', type: 'text', label: 'License number', required: true },
      { id: 'technician_signature', type: 'signature', label: 'Technician signature', required: true },
    ],
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  safety: 'shield',
  compliance: 'check-square',
  general: 'file-text',
  electrical: 'zap',
  plumbing: 'droplet',
  hvac: 'wind',
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  addButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: pageShell.paddingBottom,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  templateCategory: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  templateDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.successLight,
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  inactiveStatus: {
    backgroundColor: colors.muted,
  },
  inactiveStatusText: {
    color: colors.mutedForeground,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
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
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  closeButton: {
    padding: spacing.sm,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  defaultTemplateCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  defaultTemplateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  defaultTemplateName: {
    ...typography.subtitle,
    color: colors.foreground,
    flex: 1,
  },
  defaultTemplateDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  fieldCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default function JobFormsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get<FormTemplate[]>('/api/job-forms/templates');
      if (response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTemplates();
    setRefreshing(false);
  };

  const handleAddDefaultTemplate = async (template: typeof DEFAULT_TEMPLATES[0]) => {
    setIsCreating(true);
    try {
      const response = await api.post('/api/job-forms/templates', template);
      if (response.data) {
        setTemplates(prev => [...prev, response.data as FormTemplate]);
        Alert.alert('Success', `"${template.name}" template added`);
      }
    } catch (error) {
      console.error('Error creating template:', error);
      Alert.alert('Error', 'Failed to create template');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = (template: FormTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {} },
        { 
          text: 'Delete', 
          onPress: async () => {
            try {
              await api.delete(`/api/job-forms/templates/${template.id}`);
              setTemplates(prev => prev.filter(t => t.id !== template.id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        },
      ]
    );
  };

  const renderTemplate = (template: FormTemplate) => {
    const iconName = CATEGORY_ICONS[template.category || 'general'] || 'file-text';
    const fields = Array.isArray(template.fields) ? template.fields : [];

    return (
      <TouchableOpacity
        key={template.id}
        style={styles.templateCard}
        onPress={() => {
          Alert.alert(
            template.name,
            `${fields.length} fields\n\nCategory: ${template.category || 'General'}`,
            [
              { text: 'Close', onPress: () => {} },
              { 
                text: 'Delete', 
                onPress: () => handleDeleteTemplate(template)
              },
            ]
          );
        }}
        activeOpacity={0.7}
        data-testid={`form-template-${template.id}`}
      >
        <View style={styles.templateHeader}>
          <View style={styles.templateIcon}>
            <Feather name={iconName as any} size={20} color={colors.primary} />
          </View>
          <View style={styles.templateInfo}>
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.templateCategory}>{template.category || 'General'}</Text>
          </View>
        </View>
        
        {template.description && (
          <Text style={styles.templateDescription}>{template.description}</Text>
        )}
        
        <View style={styles.templateMeta}>
          <View style={styles.metaItem}>
            <Feather name="list" size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{fields.length} fields</Text>
          </View>
          <View style={[
            styles.statusBadge,
            !template.isActive && styles.inactiveStatus,
          ]}>
            <Text style={[
              styles.statusText,
              !template.isActive && styles.inactiveStatusText,
            ]}>
              {template.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          data-testid="button-back"
        >
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Job Forms</Text>
          <Text style={styles.headerSubtitle}>
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          data-testid="button-add-template"
        >
          <Feather name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {templates.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Templates</Text>
            {templates.map(renderTemplate)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No form templates</Text>
            <Text style={styles.emptyDescription}>
              Add pre-built templates to collect safety checklists, site inductions, and completion sign-offs on your jobs.
            </Text>
            <Button
              variant="default"
              onPress={() => setShowAddModal(true)}
              style={{ marginTop: spacing.lg }}
            >
              Add Template
            </Button>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Form Template</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAddModal(false)}
                data-testid="button-close-modal"
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {DEFAULT_TEMPLATES.map((template, index) => {
                const alreadyAdded = templates.some(t => t.name === template.name);
                const iconName = CATEGORY_ICONS[template.category || 'general'] || 'file-text';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.defaultTemplateCard,
                      alreadyAdded && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      if (!alreadyAdded && !isCreating) {
                        handleAddDefaultTemplate(template);
                      }
                    }}
                    disabled={alreadyAdded || isCreating}
                    data-testid={`add-template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <View style={styles.defaultTemplateHeader}>
                      <Feather 
                        name={iconName as any} 
                        size={18} 
                        color={alreadyAdded ? colors.mutedForeground : colors.primary} 
                        style={{ marginRight: spacing.sm }}
                      />
                      <Text style={styles.defaultTemplateName}>{template.name}</Text>
                      {alreadyAdded ? (
                        <Feather name="check" size={18} color={colors.success} />
                      ) : (
                        <Text style={styles.fieldCount}>{template.fields.length} fields</Text>
                      )}
                    </View>
                    <Text style={styles.defaultTemplateDesc}>{template.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
