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
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePicker } from '../../src/components/ui/DatePicker';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useClientsStore, useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import api from '../../src/lib/api';

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
      color: colors.white,
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
  });
}

function ClientSelector({
  clients,
  selectedId,
  onSelect,
  visible,
  onClose,
  colors,
}: {
  clients: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
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
  const { clients, fetchClients } = useClientsStore();
  const { fetchJobs } = useJobsStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<JobStatus>('pending');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [notes, setNotes] = useState('');

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prefillSuggestions, setPrefillSuggestions] = useState<any>(null);
  const [loadingPrefill, setLoadingPrefill] = useState(false);

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

    try {
      const jobData: any = {
        title: title.trim(),
        description: description.trim() || null,
        clientId: clientId || null,
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
      console.error('Save job error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to save job. Please try again.'
      );
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

            {/* Smart Pre-fill Suggestions */}
            {loadingPrefill && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Loading suggestions...</Text>
              </View>
            )}
            
            {prefillSuggestions && (prefillSuggestions.frequentItems?.length > 0 || prefillSuggestions.jobHistory?.length > 0) && (
              <View style={[styles.section, { backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Smart Suggestions</Text>
                </View>
                
                {prefillSuggestions.frequentItems?.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
                      Frequently used for this client:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {prefillSuggestions.frequentItems.slice(0, 5).map((item: any, idx: number) => (
                        <View key={idx} style={{ 
                          backgroundColor: colors.card, 
                          paddingHorizontal: 10, 
                          paddingVertical: 4, 
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: colors.border 
                        }}>
                          <Text style={{ fontSize: 12, color: colors.foreground }}>{item.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                
                {prefillSuggestions.jobHistory?.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
                      Recent jobs: {prefillSuggestions.jobHistory.slice(0, 2).map((j: any) => j.title).join(', ')}
                    </Text>
                  </View>
                )}
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
      />

      <StatusSelector
        selectedStatus={status}
        onSelect={setStatus}
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        colors={colors}
      />
    </>
  );
}
