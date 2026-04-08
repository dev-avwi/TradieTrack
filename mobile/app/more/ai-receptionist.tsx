import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Alert, TextInput, Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows, typography, pageShell } from '../../src/lib/design-tokens';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface KnowledgeBankContent {
  faqs?: Array<{ question: string; answer: string }>;
  serviceDescriptions?: string;
  pricingInfo?: string;
  specialInstructions?: string;
}

interface VoiceChangeRequest {
  id: string;
  requestedDescription: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface CallLog {
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  status: string;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  outcome: string | null;
  callerIntent: string | null;
  createdAt: string;
}

interface ReceptionistConfig {
  enabled: boolean;
  mode: string;
  voice: string;
  greeting: string | null;
  transferNumbers: TransferNumber[];
  businessHours: { start: string; end: string; timezone: string; days: number[] } | null;
  dedicatedPhoneNumber: string | null;
  vapiAssistantId: string | null;
  approvalStatus: string | null;
  knowledgeBank: KnowledgeBankContent | null;
}

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith('+61')) {
    const local = phone.replace('+61', '0');
    return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  return phone;
}

const VOICE_OPTIONS: { id: string; name: string; accent: string }[] = [
  { id: 'Jess', name: 'Jess', accent: 'Australian Female' },
  { id: 'Harry', name: 'Harry', accent: 'Australian Male' },
  { id: 'Chris', name: 'Chris', accent: 'Australian Male' },
];

const MODE_OPTIONS: { id: string; label: string; icon: FeatherIconName; description: string }[] = [
  { id: 'off', label: 'Off', icon: 'phone-off', description: 'AI Receptionist is disabled' },
  { id: 'after_hours', label: 'After Hours Only', icon: 'moon', description: 'Only active outside business hours' },
  { id: 'always_on_transfer', label: 'Always On + Transfer', icon: 'phone-forwarded', description: 'Answer all calls, transfer to your team when available' },
  { id: 'always_on_message', label: 'Always On + Message', icon: 'message-square', description: 'Answer all calls, take a message for you' },
  { id: 'selective', label: 'Selective', icon: 'filter', description: 'AI answers when you choose not to pick up' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: pageShell.paddingHorizontal, paddingTop: pageShell.paddingTop, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  pageTitle: { ...typography.largeTitle, color: colors.foreground, flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm },
  cardTitle: { ...typography.body, fontWeight: '700', color: colors.foreground, marginBottom: spacing.xs },
  cardSubtitle: { ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.md },
  enableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  enableLabel: { ...typography.body, fontWeight: '600', color: colors.foreground },
  enableSublabel: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.mutedForeground, marginTop: spacing.lg, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  modeOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.sm, borderWidth: 1, gap: spacing.md },
  modeIconContainer: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modeLabel: { ...typography.body, fontWeight: '600', color: colors.foreground },
  modeDescription: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  voiceOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.sm, borderWidth: 1, gap: spacing.md },
  voiceName: { ...typography.body, fontWeight: '600', color: colors.foreground },
  voiceAccent: { ...typography.caption, color: colors.mutedForeground },
  textArea: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body, minHeight: 80, textAlignVertical: 'top' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body },
  inputLabel: { ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.xs },
  phoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  phoneInput: { flex: 1, color: colors.foreground, ...typography.body },
  phoneLabel: { ...typography.caption, color: colors.mutedForeground, width: 60 },
  daysRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dayButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
  dayText: { ...typography.caption, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, gap: spacing.xs, alignSelf: 'flex-start' },
  statusText: { ...typography.caption, fontWeight: '600' },
  phoneNumber: { ...typography.body, fontWeight: '700', color: colors.primary, fontSize: 18 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveButtonText: { ...typography.body, fontWeight: '700', color: '#fff' },
  transferRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  transferName: { ...typography.body, fontWeight: '600', color: colors.foreground, flex: 1 },
  transferPhone: { ...typography.caption, color: colors.mutedForeground },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', gap: spacing.sm },
  addButtonText: { ...typography.body, fontWeight: '600' },
});

const SHARED_PLATFORM_NUMBER = '0485 013 993';

export default function AIReceptionistScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings, fetchBusinessSettings } = useAuthStore();
  const hasDedicatedNumber = !!businessSettings?.dedicatedPhoneNumber;
  const [config, setConfig] = useState<ReceptionistConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('off');
  const [voice, setVoice] = useState('Jess');
  const [greeting, setGreeting] = useState('');
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [transferNumbers, setTransferNumbers] = useState<TransferNumber[]>([]);
  const [knowledgeBank, setKnowledgeBank] = useState<KnowledgeBankContent>({});
  const [voiceRequests, setVoiceRequests] = useState<VoiceChangeRequest[]>([]);
  const [voiceRequestText, setVoiceRequestText] = useState('');
  const [isSavingKB, setIsSavingKB] = useState(false);
  const [isSubmittingVR, setIsSubmittingVR] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState<string | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [userChangedEnabled, setUserChangedEnabled] = useState(false);

  const pollProvisioningStatus = useCallback(async (maxAttempts = 15) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const statusRes = await api.get<{ status: string; phoneNumber?: string; error?: string }>('/api/ai-receptionist/provisioning-status');
        const data = statusRes.data;
        if (data?.status === 'active' || data?.status === 'approved') {
          setProvisioningStatus('complete');
          await fetchConfig();
          setIsProvisioning(false);
          return;
        }
        if (data?.status === 'failed' || data?.error) {
          setProvisioningError(data?.error || 'Provisioning failed. Please try again.');
          setIsProvisioning(false);
          return;
        }
        setProvisioningStatus(i < 5 ? 'Setting up your number...' : 'Almost there...');
      } catch {
        // continue polling
      }
    }
    await fetchConfig();
    setIsProvisioning(false);
    setProvisioningStatus(null);
  }, []);

  const handleProvisionNumber = async () => {
    const numberDisplay = formatPhoneDisplay(businessSettings?.dedicatedPhoneNumber || '');
    Alert.alert(
      'Activate AI Receptionist',
      `This will set up your AI assistant on ${numberDisplay || 'your dedicated number'}. It will answer calls, take messages, and book appointments. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            setIsProvisioning(true);
            setProvisioningStatus('Saving your preferences...');
            setProvisioningError(null);
            try {
              await api.patch('/api/ai-receptionist/config', {
                mode: mode || 'after_hours',
                voice,
                greeting: greeting || null,
                transferNumbers,
                businessHours: { start: startTime, end: endTime, timezone, days: selectedDays },
              });
              setProvisioningStatus('Setting up your AI assistant...');
              const checkoutRes = await api.post<{ success?: boolean; provisioning?: boolean; url?: string }>('/api/subscription/ai-receptionist-checkout');
              if (checkoutRes.data?.url) {
                setIsProvisioning(false);
                setProvisioningStatus(null);
                Alert.alert(
                  'Setup Required',
                  'AI Receptionist setup requires completing your business account configuration at jobrunner.com.au. Contact support@jobrunner.com.au for assistance.',
                  [{ text: 'OK' }]
                );
                return;
              }
              setProvisioningStatus('Configuring AI voice and responses...');
              pollProvisioningStatus();
            } catch (e: any) {
              setIsProvisioning(false);
              setProvisioningStatus(null);
              Alert.alert('Error', e?.message || 'Could not set up AI Receptionist. Please try again.');
            }
          },
        },
      ]
    );
  };

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<ReceptionistConfig>('/api/ai-receptionist/config');
      const data = response.data;
      if (data) {
        setConfig(data);
        setEnabled(data.enabled);
        setMode(data.mode || 'off');
        setVoice(data.voice || 'Jess');
        setGreeting(data.greeting || '');
        setTransferNumbers(data.transferNumbers || []);
        if (data.businessHours?.days) setSelectedDays(data.businessHours.days);
        if (data.businessHours?.start) setStartTime(data.businessHours.start);
        if (data.businessHours?.end) setEndTime(data.businessHours.end);
        if (data.businessHours?.timezone) setTimezone(data.businessHours.timezone);
        if (data.knowledgeBank) setKnowledgeBank(data.knowledgeBank);
        setConfigLoaded(true);
        setUserChangedEnabled(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load AI Receptionist settings. Pull down to retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVoiceRequests = useCallback(async () => {
    try {
      const response = await api.get<VoiceChangeRequest[]>('/api/ai-receptionist/voice-requests');
      setVoiceRequests(response.data || []);
    } catch (e) {
    }
  }, []);

  const fetchRecentCalls = useCallback(async () => {
    try {
      const response = await api.get<CallLog[]>('/api/ai-receptionist/calls?limit=10');
      setRecentCalls(response.data || []);
    } catch (e) {
    }
  }, []);

  useEffect(() => { fetchConfig(); fetchVoiceRequests(); fetchRecentCalls(); }, [fetchConfig, fetchVoiceRequests, fetchRecentCalls]);

  const handleSave = async () => {
    if (!configLoaded) {
      Alert.alert('Not Ready', 'Settings are still loading. Please wait and try again.');
      return;
    }
    setIsSaving(true);
    try {
      await api.patch('/api/ai-receptionist/config', {
        mode,
        voice,
        greeting: greeting || null,
        transferNumbers,
        businessHours: { start: startTime, end: endTime, timezone, days: selectedDays },
      });

      if (userChangedEnabled) {
        const wasEnabled = config?.enabled || false;
        if (enabled && !wasEnabled) {
          await api.post('/api/ai-receptionist/enable');
        } else if (!enabled && wasEnabled) {
          await api.post('/api/ai-receptionist/disable');
        }
      }

      await fetchConfig();
      Alert.alert('Saved', 'AI Receptionist settings updated.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKnowledgeBank = async () => {
    setIsSavingKB(true);
    try {
      await api.patch('/api/ai-receptionist/config', { knowledgeBank });
      Alert.alert('Saved', 'Knowledge bank has been synced to the AI.');
    } catch {
      Alert.alert('Error', 'Could not save knowledge bank.');
    } finally {
      setIsSavingKB(false);
    }
  };

  const handleSubmitVoiceRequest = async () => {
    if (!voiceRequestText.trim() || voiceRequestText.length < 5) return;
    setIsSubmittingVR(true);
    try {
      await api.post('/api/ai-receptionist/voice-requests', { requestedDescription: voiceRequestText });
      Alert.alert('Submitted', "We'll review your request and get back to you.");
      setVoiceRequestText('');
      fetchVoiceRequests();
    } catch {
      Alert.alert('Error', 'Could not submit voice request.');
    } finally {
      setIsSubmittingVR(false);
    }
  };

  const addFaq = () => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: '', answer: '' }],
    }));
  };

  const removeFaq = (index: number) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).filter((_, i) => i !== index),
    }));
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).map((faq, i) => i === index ? { ...faq, [field]: value } : faq),
    }));
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
  };

  const addTransferNumber = () => {
    Alert.prompt('Add Transfer Number', 'Enter a name for this contact (e.g. "Office" or "Jake")', (name: string) => {
      if (!name) return;
      Alert.prompt('Phone Number', 'Enter the phone number', (phone: string) => {
        if (!phone) return;
        setTransferNumbers(prev => [...prev, { name, phone, priority: prev.length + 1 }]);
      }, 'plain-text', '', 'phone-pad');
    });
  };

  const addTransferNumberFallback = () => {
    setTransferNumbers(prev => [...prev, { name: `Contact ${prev.length + 1}`, phone: '', priority: prev.length + 1 }]);
  };

  const removeTransferNumber = (index: number) => {
    setTransferNumbers(prev => prev.filter((_, i) => i !== index));
  };

  const updateTransferNumber = (index: number, field: 'name' | 'phone', value: string) => {
    setTransferNumbers(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchConfig(); fetchRecentCalls(); }} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>AI Receptionist</Text>
        </View>

        {!config?.enabled && mode === 'off' && (
          <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: `${colors.primary}20` }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="phone" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.cardTitle, color: colors.foreground }}>Get started in 3 steps</Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Set up your AI receptionist in under 2 minutes</Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>1</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Choose a mode (after hours, always on, etc.)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>2</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Pick a voice and customise your greeting</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>3</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Enable and save — you're live</Text>
              </View>
            </View>
          </View>
        )}

        {!hasDedicatedNumber && !config?.dedicatedPhoneNumber ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.warning}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                <Feather name="phone-off" size={28} color={colors.warning} />
              </View>
              <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                Dedicated Number Required
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xs }}>
                You're currently using the shared JobRunner number ({SHARED_PLATFORM_NUMBER}).
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.lg }}>
                To set up an AI Receptionist, you need your own dedicated phone number first. Your AI will answer calls and take messages on that number.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                onPress={() => router.push('/more/phone-numbers')}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={16} color={colors.primaryForeground} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primaryForeground }}>Get a Dedicated Number</Text>
              </TouchableOpacity>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.sm }}>
                Includes SMS and AI calls
              </Text>
            </View>
          </View>
        ) : config?.dedicatedPhoneNumber || hasDedicatedNumber ? (
          <View style={styles.card}>
            {isProvisioning ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="loader" size={28} color={colors.primary} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Setting Up AI Receptionist
                </Text>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.sm }} />
                <Text style={{ ...typography.caption, color: colors.primary, textAlign: 'center', fontWeight: '500', marginBottom: spacing.xs }}>
                  {provisioningStatus || 'Please wait...'}
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18 }}>
                  This usually takes 10-30 seconds. Please don't close this screen.
                </Text>
              </View>
            ) : provisioningError ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.destructive}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="alert-circle" size={28} color={colors.destructive} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Setup Issue
                </Text>
                <Text style={{ ...typography.caption, color: colors.destructive || '#ef4444', textAlign: 'center', lineHeight: 18, marginBottom: spacing.md }}>
                  {provisioningError}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                  onPress={handleProvisionNumber}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryForeground }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : !config?.vapiAssistantId ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="cpu" size={28} color={colors.primary} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Ready to Set Up AI Receptionist
                </Text>
                <View style={{ padding: spacing.md, backgroundColor: `${colors.success}10`, borderRadius: radius.lg, marginBottom: spacing.md, width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Feather name="check-circle" size={16} color={colors.success} />
                    <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600' }}>
                      Number: {formatPhoneDisplay(businessSettings?.dedicatedPhoneNumber || config?.dedicatedPhoneNumber || '')}
                    </Text>
                  </View>
                </View>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.md }}>
                  Your AI assistant will answer calls, take messages, and book appointments on your dedicated number. Configure your preferences below, then activate.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                  onPress={handleProvisionNumber}
                  activeOpacity={0.7}
                >
                  <Feather name="zap" size={16} color={colors.primaryForeground} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primaryForeground }}>Activate AI Receptionist</Text>
                </TouchableOpacity>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.sm }}>
                  Business add-on
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.enableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enableLabel}>AI Receptionist</Text>
                    <Text style={styles.enableSublabel}>Answer calls, book jobs, and take messages automatically</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(val) => {
                      if (!val && config?.enabled) {
                        Alert.alert(
                          'Disable AI Receptionist?',
                          'This will stop the AI from answering calls on your dedicated number. You can re-enable it anytime.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Disable',
                              style: 'destructive',
                              onPress: () => {
                                setEnabled(false);
                                setUserChangedEnabled(true);
                              },
                            },
                          ]
                        );
                      } else {
                        setEnabled(val);
                        setUserChangedEnabled(true);
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                  />
                </View>

                <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: radius.lg }}>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: 4 }}>Your business number</Text>
                  <Text style={styles.phoneNumber}>{config?.dedicatedPhoneNumber || businessSettings?.dedicatedPhoneNumber}</Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4, lineHeight: 16 }}>
                    This number handles AI calls and SMS via Chat Hub.
                  </Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: enabled ? colors.success + '20' : colors.muted, marginTop: spacing.md }]}>
                  <Feather name={enabled ? 'check-circle' : 'x-circle'} size={14} color={enabled ? colors.success : colors.mutedForeground} />
                  <Text style={[styles.statusText, { color: enabled ? colors.success : colors.mutedForeground }]}>
                    {enabled ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Mode</Text>
        {MODE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.modeOption, { borderColor: mode === opt.id ? colors.primary : colors.cardBorder, backgroundColor: mode === opt.id ? colors.primary + '08' : colors.card }]}
            onPress={() => setMode(opt.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIconContainer, { backgroundColor: mode === opt.id ? colors.primary + '20' : colors.muted }]}>
              <Feather name={opt.icon} size={20} color={mode === opt.id ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeLabel}>{opt.label}</Text>
              <Text style={styles.modeDescription}>{opt.description}</Text>
            </View>
            {mode === opt.id && <Feather name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Voice</Text>
        {VOICE_OPTIONS.map(v => (
          <TouchableOpacity
            key={v.id}
            style={[styles.voiceOption, { borderColor: voice === v.id ? colors.primary : colors.cardBorder, backgroundColor: voice === v.id ? colors.primary + '08' : colors.card }]}
            onPress={() => setVoice(v.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIconContainer, { backgroundColor: voice === v.id ? colors.primary + '20' : colors.muted }]}>
              <Feather name="mic" size={18} color={voice === v.id ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceName}>{v.name}</Text>
              <Text style={styles.voiceAccent}>{v.accent}</Text>
            </View>
            {voice === v.id && <Feather name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>
        ))}

        {(mode === 'always_on_transfer' || mode === 'selective') && (
          <>
            <Text style={styles.sectionTitle}>Transfer Numbers</Text>
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>Numbers the AI can transfer calls to when your team is available</Text>
              {transferNumbers.map((tn, index) => (
                <View key={index} style={styles.transferRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.transferName, { padding: 0 }]}
                      value={tn.name}
                      onChangeText={(val) => updateTransferNumber(index, 'name', val)}
                      placeholder="Contact name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TextInput
                      style={[styles.transferPhone, { padding: 0, marginTop: 4 }]}
                      value={tn.phone}
                      onChangeText={(val) => updateTransferNumber(index, 'phone', val)}
                      placeholder="04XX XXX XXX"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeTransferNumber(index)} activeOpacity={0.7}>
                    <Feather name="trash-2" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addButton, { borderColor: colors.primary + '40' }]}
                onPress={addTransferNumberFallback}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.primary} />
                <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Transfer Number</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Custom Greeting</Text>
        <TextInput
          style={styles.textArea}
          value={greeting}
          onChangeText={setGreeting}
          placeholder="G'day, you've reached [Business Name]. How can I help?"
          placeholderTextColor={colors.mutedForeground}
          multiline
        />

        <Text style={styles.sectionTitle}>Business Hours</Text>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>Select which days the AI should answer calls</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day, i) => {
              const dayNum = i + 1;
              const isSelected = selectedDays.includes(dayNum);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, {
                    borderColor: isSelected ? colors.primary : colors.cardBorder,
                    backgroundColor: isSelected ? colors.primary + '15' : 'transparent',
                  }]}
                  onPress={() => toggleDay(dayNum)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, { color: isSelected ? colors.primary : colors.mutedForeground }]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Start Time</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="08:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>End Time</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="17:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.inputLabel}>Timezone</Text>
            <TextInput
              style={styles.input}
              value={timezone}
              onChangeText={setTimezone}
              placeholder="Australia/Sydney"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (isSaving || !configLoaded) && { opacity: 0.7 }]}
          onPress={() => {
            if (!configLoaded) return;
            if (!config?.dedicatedPhoneNumber) {
              handleSave();
              Alert.alert(
                'Request Submitted',
                'Your AI Receptionist preferences have been saved. Our team will provision a dedicated phone number and notify you when it\'s ready.',
                [{ text: 'OK' }]
              );
              return;
            }
            handleSave();
          }}
          disabled={isSaving || !configLoaded}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {config?.dedicatedPhoneNumber ? 'Save Settings' : 'Save & Request Setup'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ backgroundColor: `${colors.info}10`, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: `${colors.info}20` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="info" size={16} color={colors.info} />
            <Text style={{ ...typography.label, color: colors.foreground }}>AI-Powered Service</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.mutedForeground, lineHeight: 18 }}>
            The AI Receptionist uses artificial intelligence to answer calls and respond to SMS messages on behalf of your business. Callers will hear an AI-generated voice. You are responsible for reviewing messages and call summaries for accuracy.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="book-open" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Knowledge Bank</Text>
          </View>
          <Text style={styles.cardSubtitle}>Train your AI with business-specific info so it can answer callers accurately.</Text>

          <Text style={styles.inputLabel}>Service Descriptions</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.serviceDescriptions || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, serviceDescriptions: v }))}
            placeholder="Describe your services, specialties..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <Text style={styles.inputLabel}>Pricing Information</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.pricingInfo || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, pricingInfo: v }))}
            placeholder="Call-out fees, hourly rates..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <Text style={styles.inputLabel}>Special Instructions</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.specialInstructions || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, specialInstructions: v }))}
            placeholder="Areas you service, special handling..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={styles.inputLabel}>FAQs</Text>
            <TouchableOpacity
              style={[styles.addButton, { borderColor: colors.primary + '50', paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
              onPress={addFaq}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary, fontSize: 13 }]}>Add FAQ</Text>
            </TouchableOpacity>
          </View>
          {(knowledgeBank.faqs || []).map((faq, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.xs }]}
                    value={faq.question}
                    onChangeText={(v) => updateFaq(i, 'question', v)}
                    placeholder="Common question..."
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={styles.textArea}
                    value={faq.answer}
                    onChangeText={(v) => updateFaq(i, 'answer', v)}
                    placeholder="Answer..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                  />
                </View>
                <TouchableOpacity onPress={() => removeFaq(i)} activeOpacity={0.7}>
                  <Feather name="trash-2" size={18} color={colors.destructive || '#ef4444'} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, isSavingKB && { opacity: 0.7 }]}
            onPress={handleSaveKnowledgeBank}
            disabled={isSavingKB}
            activeOpacity={0.8}
          >
            {isSavingKB ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Knowledge Bank</Text>
            )}
          </TouchableOpacity>
        </View>

        {recentCalls.length > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="phone-incoming" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Recent Calls</Text>
              </View>
              <View style={{ backgroundColor: colors.cardBorder, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>{recentCalls.length} call{recentCalls.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            {recentCalls.map((call) => {
              const isExpanded = expandedCallId === call.id;
              const outcomeColors: Record<string, { bg: string; text: string; label: string }> = {
                message_taken: { bg: '#dbeafe', text: '#1d4ed8', label: 'Message' },
                transferred: { bg: '#dcfce7', text: '#15803d', label: 'Transferred' },
                booked: { bg: '#f3e8ff', text: '#7c3aed', label: 'Booked' },
                missed: { bg: '#fee2e2', text: '#b91c1c', label: 'Missed' },
              };
              const oc = outcomeColors[call.outcome || ''] || { bg: colors.cardBorder, text: colors.mutedForeground, label: call.outcome || 'Call' };
              const callDate = new Date(call.createdAt);
              const durationText = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '';

              return (
                <TouchableOpacity
                  key={call.id}
                  activeOpacity={0.7}
                  onPress={() => setExpandedCallId(isExpanded ? null : call.id)}
                  style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden' }}
                >
                  <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600' }} numberOfLines={1}>
                        {call.callerName || (call.callerPhone ? formatPhoneDisplay(call.callerPhone) : 'Unknown Caller')}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                        {callDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {durationText ? ` \u00B7 ${durationText}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ backgroundColor: oc.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: oc.text }}>{oc.label}</Text>
                      </View>
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                    </View>
                  </View>
                  {isExpanded && (
                    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md, gap: spacing.sm }}>
                      {call.summary && (
                        <View>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: '600', marginBottom: 4 }}>Summary</Text>
                          <Text style={{ ...typography.body, color: colors.foreground, backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.md, fontSize: 13 }}>{call.summary}</Text>
                        </View>
                      )}
                      {call.transcript && (
                        <View>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: '600', marginBottom: 4 }}>Transcript</Text>
                          <Text style={{ ...typography.body, color: colors.foreground, backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.md, fontSize: 13 }} numberOfLines={8}>{call.transcript}</Text>
                        </View>
                      )}
                      {call.callerPhone && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${call.callerPhone}`)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}
                        >
                          <Feather name="phone" size={14} color={colors.primary} />
                          <Text style={{ ...typography.body, color: colors.primary, fontSize: 13 }}>{formatPhoneDisplay(call.callerPhone)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="mic" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Request a Voice</Text>
          </View>
          <Text style={styles.cardSubtitle}>Want a different voice? Describe what you'd like and we'll set it up.</Text>

          {voiceRequests.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[styles.inputLabel, { marginBottom: spacing.sm }]}>Your Requests</Text>
              {voiceRequests.map((req) => (
                <View key={req.id} style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{req.requestedDescription}</Text>
                      {req.adminNotes ? <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>Admin: {req.adminNotes}</Text> : null}
                      <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>{new Date(req.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: req.status === 'resolved' ? '#dcfce7' : req.status === 'in_progress' ? '#dbeafe' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    }]}>
                      <Text style={[styles.statusText, {
                        color: req.status === 'resolved' ? '#15803d' : req.status === 'in_progress' ? '#1d4ed8' : req.status === 'rejected' ? '#b91c1c' : '#92400e',
                      }]}>
                        {req.status === 'in_progress' ? 'In Progress' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={voiceRequestText}
            onChangeText={setVoiceRequestText}
            placeholder="Describe the voice you'd like (e.g., 'younger female voice', 'British accent')..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.cardBorder }, (isSubmittingVR || voiceRequestText.length < 5) && { opacity: 0.5 }]}
            onPress={handleSubmitVoiceRequest}
            disabled={isSubmittingVR || voiceRequestText.length < 5}
            activeOpacity={0.8}
          >
            {isSubmittingVR ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="send" size={16} color={colors.foreground} />
                <Text style={[styles.saveButtonText, { color: colors.foreground }]}>Submit Request</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
