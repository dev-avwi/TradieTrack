import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePicker } from '../../src/components/ui/DatePicker';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useClientsStore, useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import api from '../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    headerRight: {
      width: 36,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: 15,
      color: colors.foreground,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      minHeight: 52,
    },
    selectorPlaceholder: {
      fontSize: 15,
      color: colors.mutedForeground,
    },
    selectedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    clientAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedItemText: {
      flex: 1,
    },
    selectedItemName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    selectedItemDetail: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    addressInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    addressIcon: {
      marginRight: 10,
    },
    addressField: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.foreground,
    },
    statusDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      fontSize: 15,
      color: colors.foreground,
    },
    scheduleRow: {
      flexDirection: 'row',
      gap: 12,
    },
    clearSchedule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    clearScheduleText: {
      fontSize: 13,
      color: colors.destructive,
    },
    actionsContainer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.foreground,
    },
    modalSearch: {
      backgroundColor: colors.background,
      borderRadius: 10,
      margin: 16,
      padding: 12,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalList: {
      paddingHorizontal: 16,
    },
    clientItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    clientItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    clientItemContent: {
      flex: 1,
    },
    clientItemName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    clientItemEmail: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    statusItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    statusItemText: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    emptyList: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyListText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    suggestionsCard: {
      backgroundColor: colors.successLight || colors.success + '15',
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    suggestionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    suggestionsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
    },
    suggestionsLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    suggestionsChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionChip: {
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionChipText: {
      fontSize: 13,
      color: colors.foreground,
    },
    suggestionsLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    suggestionsLoadingText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
  });
}

function ClientSelector({
  clients,
  selectedId,
  onSelect,
  visible,
  onClose,
  colors,
  onQuickAdd,
}: {
  clients: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  onQuickAdd?: () => void;
}) {
  const [search, setSearch] = useState('');
  const styles = useMemo(() => createStyles(colors), [colors]);

  const filteredClients = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client (Optional)</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.clientItem, !selectedId && styles.clientItemSelected]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <Text style={styles.clientItemName}>No Client</Text>
            {!selectedId && <Feather name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          {onQuickAdd && (
            <TouchableOpacity
              style={[styles.clientItem, { backgroundColor: colors.primaryLight, borderColor: colors.primary, marginBottom: 8 }]}
              onPress={onQuickAdd}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="plus-circle" size={20} color={colors.primary} />
                <Text style={[styles.clientItemName, { color: colors.primary }]}>Quick Add New Client</Text>
              </View>
            </TouchableOpacity>
          )}

          <ScrollView style={styles.modalList}>
            {filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.clientItem,
                  selectedId === client.id && styles.clientItemSelected,
                ]}
                onPress={() => {
                  onSelect(client.id);
                  onClose();
                }}
              >
                <View style={styles.clientItemContent}>
                  <Text style={styles.clientItemName}>{client.name}</Text>
                  <Text style={styles.clientItemEmail}>{client.email}</Text>
                </View>
                {selectedId === client.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            {filteredClients.length === 0 && (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No clients found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatusSelector({
  selectedStatus,
  onSelect,
  visible,
  onClose,
  colors,
}: {
  selectedStatus: JobStatus;
  onSelect: (status: JobStatus) => void;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_OPTIONS: { value: JobStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: colors.pending },
    { value: 'scheduled', label: 'Scheduled', color: colors.scheduled },
    { value: 'in_progress', label: 'In Progress', color: colors.inProgress },
    { value: 'done', label: 'Done', color: colors.done },
    { value: 'invoiced', label: 'Invoiced', color: colors.invoiced },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Status</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList}>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusItem,
                  selectedStatus === status.value && styles.statusItemSelected,
                ]}
                onPress={() => {
                  onSelect(status.value);
                  onClose();
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={styles.statusItemText}>{status.label}</Text>
                {selectedStatus === status.value && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CreateJobScreen() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { fetchJobs } = useJobsStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState<string | null>(params.clientId || null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<JobStatus>('pending');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [notes, setNotes] = useState('');

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prefillSuggestions, setPrefillSuggestions] = useState<any>(null);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

  // Recurring job state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);

  const RECURRENCE_OPTIONS = [
    { value: 'weekly' as const, label: 'Weekly' },
    { value: 'fortnightly' as const, label: 'Fortnightly (2 weeks)' },
    { value: 'monthly' as const, label: 'Monthly' },
    { value: 'quarterly' as const, label: 'Quarterly (3 months)' },
    { value: 'yearly' as const, label: 'Yearly' },
  ];

  const calculateNextRecurrenceDate = (baseDate: string, pattern: string): string => {
    const date = new Date(baseDate);
    switch (pattern) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'fortnightly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString();
  };

  const STATUS_OPTIONS: { value: JobStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: colors.pending },
    { value: 'scheduled', label: 'Scheduled', color: colors.scheduled },
    { value: 'in_progress', label: 'In Progress', color: colors.inProgress },
    { value: 'done', label: 'Done', color: colors.done },
    { value: 'invoiced', label: 'Invoiced', color: colors.invoiced },
  ];

  useEffect(() => {
    fetchClients();
  }, []);

  // Handle pre-filled clientId from URL params
  useEffect(() => {
    if (params.clientId && clients.length > 0) {
      const client = clients.find((c) => c.id === params.clientId);
      if (client?.address && !address) {
        setAddress(client.address);
      }
    }
  }, [params.clientId, clients]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  const handleClientSelect = async (id: string | null) => {
    setClientId(id);
    setPrefillSuggestions(null);
    setLoadingPrefill(false);
    
    if (!id) {
      // Client deselected - reset state and exit early
      return;
    }
    
    const client = clients.find((c) => c.id === id);
    // Auto-fill address from client if empty
    if (client?.address && !address) {
      setAddress(client.address);
    }
    
    // Fetch smart pre-fill suggestions
    setLoadingPrefill(true);
    try {
      const response = await api.get<any>(`/api/clients/${id}/prefill-suggestions`);
      if (response.data) {
        setPrefillSuggestions(response.data);
        // Auto-apply address suggestion if we haven't set one yet
        if (response.data.address && !address && !client?.address) {
          setAddress(response.data.address);
        }
      }
    } catch (error) {
      console.log('Pre-fill suggestions not available:', error);
      setPrefillSuggestions(null);
    } finally {
      setLoadingPrefill(false);
    }
  };

  const validateJob = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a job title');
      return false;
    }
    return true;
  };

  const saveJob = async () => {
    if (!validateJob()) return;

    setIsSaving(true);
    
    const { isOnline } = useOfflineStore.getState();
    const selectedClient = clients.find(c => c.id === clientId);

    const jobData: any = {
      title: title.trim(),
      description: description.trim() || null,
      clientId: clientId || null,
      clientName: selectedClient?.name,
      address: address.trim() || null,
      status,
      notes: notes.trim() || null,
    };

    if (scheduledAt) {
      jobData.scheduledAt = scheduledAt.toISOString();
      if (status === 'pending') {
        jobData.status = 'scheduled';
      }
    }

    if (estimatedDuration) {
      const hours = parseFloat(estimatedDuration);
      if (!isNaN(hours) && hours > 0) {
        jobData.estimatedDuration = Math.round(hours * 60);
      }
    }

    // Add recurring job fields
    if (isRecurring) {
      const baseDate = scheduledAt ? scheduledAt.toISOString() : new Date().toISOString();
      jobData.isRecurring = true;
      jobData.recurrencePattern = recurrencePattern;
      jobData.recurrenceInterval = 1;
      jobData.nextRecurrenceDate = calculateNextRecurrenceDate(baseDate, recurrencePattern);
      if (recurrenceEndDate) {
        jobData.recurrenceEndDate = new Date(recurrenceEndDate).toISOString();
      }
    }
    
    // Offline-first: save offline if no connection
    if (!isOnline) {
      try {
        await offlineStorage.saveJobOffline(jobData, 'create');
        Alert.alert(
          'Saved Offline', 
          'Job saved locally and will sync when you\'re back online.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Failed to save job offline:', error);
        Alert.alert('Error', 'Failed to save job offline. Please try again.');
      }
      setIsSaving(false);
      return;
    }
    
    // Online: try API first, fallback to offline if network error
    try {
      const response = await api.post<{ id: string }>('/api/jobs', jobData);

      if (response.data?.id) {
        await fetchJobs();
        Alert.alert(
          'Job Created!',
          'Your job has been created successfully.',
          [
            {
              text: 'View Job',
              onPress: () => router.replace(`/job/${response.data!.id}`),
            },
            {
              text: 'Back to Jobs',
              onPress: () => router.back(),
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error: any) {
      // Network error - save offline
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        try {
          await offlineStorage.saveJobOffline(jobData, 'create');
          Alert.alert(
            'Saved Offline', 
            'Job saved locally and will sync when connection is restored.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } catch (offlineError) {
          console.error('Failed to save job offline:', offlineError);
          Alert.alert('Error', 'Failed to save job. Please try again.');
        }
      } else {
        console.error('Save job error:', error);
        Alert.alert(
          'Error',
          error.response?.data?.error || 'Failed to save job. Please try again.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (date: Date) => {
    const newDate = scheduledAt ? new Date(scheduledAt) : new Date();
    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setScheduledAt(newDate);
  };

  const handleTimeChange = (time: Date) => {
    const newDate = scheduledAt ? new Date(scheduledAt) : new Date();
    newDate.setHours(time.getHours(), time.getMinutes());
    setScheduledAt(newDate);
  };

  const handleQuickAddClient = async () => {
    if (!quickClientName.trim()) {
      Alert.alert('Missing Name', 'Please enter a client name');
      return;
    }

    setIsAddingClient(true);
    const { isOnline } = useOfflineStore.getState();
    
    try {
      if (isOnline) {
        const response = await api.post<{ id: string }>('/api/clients', {
          name: quickClientName.trim(),
          email: quickClientEmail.trim() || null,
          phone: quickClientPhone.trim() || null,
        });

        if (response.data?.id) {
          await fetchClients();
          handleClientSelect(response.data.id);
          setShowQuickAddClient(false);
          setQuickClientName('');
          setQuickClientEmail('');
          setQuickClientPhone('');
          Alert.alert('Success', 'Client added successfully');
        }
      } else {
        const savedClient = await offlineStorage.saveClientOffline({
          name: quickClientName.trim(),
          email: quickClientEmail.trim() || undefined,
          phone: quickClientPhone.trim() || undefined,
        }, 'create');

        await fetchClients();
        handleClientSelect(savedClient.id);
        setShowQuickAddClient(false);
        setQuickClientName('');
        setQuickClientEmail('');
        setQuickClientPhone('');
        Alert.alert('Saved Offline', 'Client saved offline. Will sync when back online.');
      }
    } catch (error: any) {
      console.error('Quick add client error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add client');
    } finally {
      setIsAddingClient(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Job</Text>
          <View style={styles.headerRight} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Job Title */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bathroom renovation"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Details about the job..."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Client Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client (Optional)</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowClientPicker(true)}
              >
                {selectedClient ? (
                  <View style={styles.selectedItem}>
                    <View style={styles.clientAvatar}>
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.selectedItemText}>
                      <Text style={styles.selectedItemName}>{selectedClient.name}</Text>
                      <Text style={styles.selectedItemDetail}>{selectedClient.email}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select a client</Text>
                )}
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.addressInput}>
                <Feather name="map-pin" size={18} color={colors.mutedForeground} style={styles.addressIcon} />
                <TextInput
                  style={styles.addressField}
                  placeholder="Job site address"
                  placeholderTextColor={colors.mutedForeground}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>

            {/* Past Job Suggestions */}
            {clientId && loadingPrefill && (
              <View style={styles.suggestionsLoading}>
                <ActivityIndicator size="small" color={colors.success} />
                <Text style={styles.suggestionsLoadingText}>Loading suggestions...</Text>
              </View>
            )}
            
            {clientId && prefillSuggestions && prefillSuggestions.recentJobDescriptions?.length > 0 && (
              <View style={styles.suggestionsCard}>
                <View style={styles.suggestionsHeader}>
                  <Feather name="clock" size={16} color={colors.success} />
                  <Text style={styles.suggestionsTitle}>Past Jobs</Text>
                </View>
                
                <Text style={styles.suggestionsLabel}>Tap to use as job title:</Text>
                <View style={styles.suggestionsChipsContainer}>
                  {prefillSuggestions.recentJobDescriptions.slice(0, 6).map((jobDesc: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionChip}
                      onPress={() => {
                        setTitle(jobDesc);
                        if (!description) {
                          setDescription(`Repeat work: ${jobDesc}`);
                        }
                      }}
                      testID={`suggestion-chip-${idx}`}
                    >
                      <Text style={styles.suggestionChipText}>{jobDesc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowStatusPicker(true)}
              >
                <View style={styles.statusDisplay}>
                  <View style={[styles.statusDot, { backgroundColor: selectedStatusOption?.color }]} />
                  <Text style={styles.statusText}>{selectedStatusOption?.label}</Text>
                </View>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Schedule Date/Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule (Optional)</Text>
              <View style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <DatePicker
                    value={scheduledAt || new Date()}
                    onChange={handleDateChange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    value={scheduledAt || new Date()}
                    onChange={handleTimeChange}
                    disabled={!scheduledAt}
                  />
                </View>
              </View>

              {scheduledAt && (
                <TouchableOpacity
                  style={styles.clearSchedule}
                  onPress={() => setScheduledAt(null)}
                >
                  <Feather name="x" size={14} color={colors.destructive} />
                  <Text style={styles.clearScheduleText}>Clear schedule</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Estimated Duration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estimated Duration (Hours)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 4"
                placeholderTextColor={colors.mutedForeground}
                value={estimatedDuration}
                onChangeText={setEstimatedDuration}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Internal Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Private notes (not visible to client)..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Recurring Job Section */}
            <View style={[styles.section, { backgroundColor: colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => setIsRecurring(!isRecurring)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Feather name="repeat" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 2 }}>Make this recurring</Text>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                      Automatically create jobs on a schedule
                    </Text>
                  </View>
                </View>
                <View style={[
                  { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 },
                  { backgroundColor: isRecurring ? colors.primary : colors.muted }
                ]}>
                  <View style={[
                    { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white },
                    { alignSelf: isRecurring ? 'flex-end' : 'flex-start' }
                  ]} />
                </View>
              </TouchableOpacity>

              {isRecurring && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Frequency</Text>
                    <TouchableOpacity
                      style={styles.selector}
                      onPress={() => setShowRecurrenceOptions(true)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Feather name="repeat" size={16} color={colors.primary} />
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.foreground }}>
                          {RECURRENCE_OPTIONS.find(o => o.value === recurrencePattern)?.label || 'Select frequency'}
                        </Text>
                      </View>
                      <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>End Date (Optional)</Text>
                    <View style={{ position: 'relative' }}>
                      <Feather name="calendar" size={16} color={colors.mutedForeground} style={{ position: 'absolute', left: 14, top: 16, zIndex: 1 }} />
                      <TextInput
                        style={[styles.input, { paddingLeft: 40 }]}
                        value={recurrenceEndDate}
                        onChangeText={setRecurrenceEndDate}
                        placeholder="YYYY-MM-DD (leave empty for no end)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryLight, padding: 12, borderRadius: 10 }}>
                    <Feather name="info" size={14} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.primary }}>
                      Next job will be created on{' '}
                      {new Date(calculateNextRecurrenceDate(
                        scheduledAt ? scheduledAt.toISOString() : new Date().toISOString(),
                        recurrencePattern
                      )).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.actionsContainer, { paddingBottom: bottomNavHeight }]}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveJob}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="save" size={20} color={colors.white} />
                  <Text style={styles.saveButtonText}>Create Job</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      <ClientSelector
        clients={clients}
        selectedId={clientId}
        onSelect={handleClientSelect}
        visible={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        colors={colors}
        onQuickAdd={() => {
          setShowClientPicker(false);
          setShowQuickAddClient(true);
        }}
      />

      <StatusSelector
        selectedStatus={status}
        onSelect={setStatus}
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        colors={colors}
      />

      <Modal visible={showQuickAddClient} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Add Client</Text>
                <TouchableOpacity 
                  onPress={() => setShowQuickAddClient(false)}
                  testID="button-close-quick-add"
                >
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={{ maxHeight: 400 }} 
                contentContainerStyle={{ padding: 16, gap: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                <View>
                  <Text style={styles.sectionTitle}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Client name"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientName}
                    onChangeText={setQuickClientName}
                    autoFocus
                    testID="input-quick-client-name"
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="client@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientEmail}
                    onChangeText={setQuickClientEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="input-quick-client-email"
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientPhone}
                    onChangeText={setQuickClientPhone}
                    keyboardType="phone-pad"
                    testID="input-quick-client-phone"
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.saveButton, { marginTop: 8, opacity: isAddingClient ? 0.6 : 1 }]}
                  onPress={handleQuickAddClient}
                  disabled={isAddingClient}
                  testID="button-add-quick-client"
                >
                  {isAddingClient ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Feather name="plus" size={18} color={colors.white} />
                      <Text style={styles.saveButtonText}>Add Client</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recurrence Options Modal */}
      <Modal visible={showRecurrenceOptions} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Frequency</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceOptions(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {RECURRENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusItem,
                    recurrencePattern === option.value && styles.statusItemSelected,
                  ]}
                  onPress={() => {
                    setRecurrencePattern(option.value);
                    setShowRecurrenceOptions(false);
                  }}
                >
                  <Feather 
                    name="repeat" 
                    size={18} 
                    color={recurrencePattern === option.value ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[
                    styles.statusItemText,
                    recurrencePattern === option.value && { color: colors.primary, fontWeight: '600' }
                  ]}>
                    {option.label}
                  </Text>
                  {recurrencePattern === option.value && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
