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
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface Job {
  id: string;
  title: string;
  description?: string;
  status: string;
  clientId: string;
  address?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  nextRecurrenceDate?: string;
}

interface Client {
  id: string;
  name: string;
  businessName?: string;
}

const RECURRENCE_PATTERNS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  jobInfoText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  jobActions: {
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  patternButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  patternButtonText: {
    fontSize: 13,
    color: colors.foreground,
  },
  patternButtonTextActive: {
    color: colors.primaryForeground,
  },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  clientSelectorText: {
    fontSize: 16,
    color: colors.foreground,
  },
  clientSelectorPlaceholder: {
    color: colors.mutedForeground,
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
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  intervalInput: {
    width: 80,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
  },
  intervalLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  clientList: {
    maxHeight: 300,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  clientItemActive: {
    backgroundColor: colors.primaryLight,
  },
  clientItemText: {
    fontSize: 16,
    color: colors.foreground,
  },
  clientSelectModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default function RecurringJobsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  
  const [recurringJobs, setRecurringJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    clientName: '',
    recurrencePattern: 'weekly',
    recurrenceInterval: '1',
    address: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsRes, clientsRes] = await Promise.all([
        api.get<Job[]>('/api/recurring/jobs'),
        api.get<Client[]>('/api/clients')
      ]);
      
      if (jobsRes.data) {
        setRecurringJobs(jobsRes.data);
      }
      if (clientsRes.data) {
        setClients(clientsRes.data);
      }
    } catch (error) {
      console.error('[RecurringJobs] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.businessName || client?.name || 'Unknown Client';
  };

  const formatPattern = (pattern?: string, interval?: number) => {
    if (!pattern) return 'Not set';
    const patternLabel = RECURRENCE_PATTERNS.find(p => p.value === pattern)?.label || pattern;
    if (interval && interval > 1) {
      return `Every ${interval} ${patternLabel.toLowerCase()}s`;
    }
    return patternLabel;
  };

  const formatNextDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const handleStopRecurring = (jobId: string, title: string) => {
    Alert.alert(
      'Stop Recurring Job',
      `Are you sure you want to stop "${title}" from recurring? This won't delete existing jobs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/recurring/jobs/${jobId}/stop`, {});
              await fetchData();
              Alert.alert('Success', 'Recurring job has been stopped.');
            } catch (error) {
              console.error('[RecurringJobs] Failed to stop recurring:', error);
              Alert.alert('Error', 'Failed to stop recurring job.');
            }
          }
        },
      ]
    );
  };

  const handleCreateRecurring = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a job title.');
      return;
    }
    if (!formData.clientId) {
      Alert.alert('Error', 'Please select a client.');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await api.post('/api/recurring/jobs', {
        title: formData.title,
        description: formData.description,
        clientId: formData.clientId,
        address: formData.address,
        isRecurring: true,
        recurrencePattern: formData.recurrencePattern,
        recurrenceInterval: parseInt(formData.recurrenceInterval) || 1,
        nextRecurrenceDate: new Date().toISOString(),
      });
      
      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }
      
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        clientId: '',
        clientName: '',
        recurrencePattern: 'weekly',
        recurrenceInterval: '1',
        address: '',
      });
      await fetchData();
      Alert.alert('Success', 'Recurring job created successfully!');
    } catch (error) {
      console.error('[RecurringJobs] Failed to create:', error);
      Alert.alert('Error', 'Failed to create recurring job.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectClient = (client: Client) => {
    setFormData(prev => ({
      ...prev,
      clientId: client.id,
      clientName: client.businessName || client.name,
    }));
    setShowClientModal(false);
  };

  const activeCount = recurringJobs.filter(j => j.isRecurring).length;
  
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
              <Text style={styles.pageTitle}>Recurring Jobs</Text>
              <Text style={styles.pageSubtitle}>Set up jobs that repeat automatically</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={styles.addButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name="repeat" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{activeCount}</Text>
              <Text style={styles.statLabel}>ACTIVE RECURRING</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Feather name="calendar" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{recurringJobs.length}</Text>
              <Text style={styles.statLabel}>TOTAL SCHEDULED</Text>
            </View>
          </View>

          {recurringJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="repeat" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Recurring Jobs</Text>
              <Text style={styles.emptyText}>
                Set up recurring jobs for regular maintenance,{'\n'}
                cleaning, or other repeating work.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Active Recurring Jobs</Text>
              {recurringJobs.map(job => (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {formatPattern(job.recurrencePattern, job.recurrenceInterval)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.jobInfo}>
                    <Feather name="user" size={14} color={colors.mutedForeground} />
                    <Text style={styles.jobInfoText}>{getClientName(job.clientId)}</Text>
                  </View>
                  
                  {job.address && (
                    <View style={styles.jobInfo}>
                      <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                      <Text style={styles.jobInfoText}>{job.address}</Text>
                    </View>
                  )}
                  
                  <View style={styles.jobInfo}>
                    <Feather name="calendar" size={14} color={colors.mutedForeground} />
                    <Text style={styles.jobInfoText}>
                      Next: {formatNextDate(job.nextRecurrenceDate)}
                    </Text>
                  </View>
                  
                  <View style={styles.jobActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => router.push(`/job/${job.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <Feather name="eye" size={16} color={colors.foreground} />
                      <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionButtonDanger]}
                      onPress={() => handleStopRecurring(job.id, job.title)}
                      activeOpacity={0.7}
                    >
                      <Feather name="x-circle" size={16} color={colors.destructive} />
                      <Text style={[styles.actionButtonText, styles.actionButtonDangerText]}>
                        Stop
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
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
              onPress={() => setShowCreateModal(false)}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Recurring Job</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Job Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="e.g., Monthly Pool Cleaning"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Client *</Text>
              <TouchableOpacity 
                style={styles.clientSelector}
                onPress={() => setShowClientModal(true)}
              >
                <Text style={[
                  styles.clientSelectorText,
                  !formData.clientName && styles.clientSelectorPlaceholder
                ]}>
                  {formData.clientName || 'Select a client'}
                </Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Job description..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                placeholder="Job site address"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Recurrence Pattern</Text>
              <View style={styles.patternGrid}>
                {RECURRENCE_PATTERNS.map(pattern => (
                  <TouchableOpacity
                    key={pattern.value}
                    style={[
                      styles.patternButton,
                      formData.recurrencePattern === pattern.value && styles.patternButtonActive
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, recurrencePattern: pattern.value }))}
                  >
                    <Text style={[
                      styles.patternButtonText,
                      formData.recurrencePattern === pattern.value && styles.patternButtonTextActive
                    ]}>
                      {pattern.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Repeat Every</Text>
              <View style={styles.intervalRow}>
                <TextInput
                  style={styles.intervalInput}
                  value={formData.recurrenceInterval}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    recurrenceInterval: text.replace(/[^0-9]/g, '') 
                  }))}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={styles.intervalLabel}>
                  {formData.recurrencePattern === 'daily' ? 'day(s)' :
                   formData.recurrencePattern === 'weekly' ? 'week(s)' :
                   formData.recurrencePattern === 'fortnightly' ? 'period(s)' :
                   formData.recurrencePattern === 'monthly' ? 'month(s)' :
                   formData.recurrencePattern === 'quarterly' ? 'quarter(s)' :
                   'year(s)'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.submitButton, isSaving && { opacity: 0.7 }]}
              onPress={handleCreateRecurring}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitButtonText}>Create Recurring Job</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.clientSelectModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowClientModal(false)}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Client</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.clientList}>
            {clients.map(client => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.clientItem,
                  formData.clientId === client.id && styles.clientItemActive
                ]}
                onPress={() => selectClient(client)}
              >
                <Feather 
                  name={formData.clientId === client.id ? 'check-circle' : 'circle'} 
                  size={20} 
                  color={formData.clientId === client.id ? colors.primary : colors.mutedForeground} 
                />
                <Text style={styles.clientItemText}>
                  {client.businessName || client.name}
                </Text>
              </TouchableOpacity>
            ))}
            {clients.length === 0 && (
              <View style={{ padding: spacing.lg }}>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  No clients found. Add a client first.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
