import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Alert, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell } from '../../src/lib/design-tokens';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface ReceptionistConfig {
  enabled: boolean;
  mode: string;
  voice: string;
  greeting: string | null;
  transferNumbers: TransferNumber[];
  businessHours: { start: string; end: string; timezone: string; days: number[] } | null;
  dedicatedPhoneNumber: string | null;
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

export default function AIReceptionistScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/api/ai-receptionist/config', {
        mode,
        voice,
        greeting: greeting || null,
        transferNumbers,
        businessHours: { start: startTime, end: endTime, timezone, days: selectedDays },
      });

      const wasEnabled = config?.enabled || false;
      if (enabled && !wasEnabled) {
        await api.post('/api/ai-receptionist/enable');
      } else if (!enabled && wasEnabled) {
        await api.post('/api/ai-receptionist/disable');
      }

      await fetchConfig();
      Alert.alert('Saved', 'AI Receptionist settings updated.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchConfig} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>AI Receptionist</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.enableRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enableLabel}>Enable AI Receptionist</Text>
              <Text style={styles.enableSublabel}>Answer calls, book jobs, and take messages automatically</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.muted, true: colors.primary + '40' }}
              thumbColor={enabled ? colors.primary : colors.mutedForeground}
            />
          </View>

          {config?.dedicatedPhoneNumber && (
            <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: radius.lg }}>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: 4 }}>Your AI phone number</Text>
              <Text style={styles.phoneNumber}>{config.dedicatedPhoneNumber}</Text>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: enabled ? colors.success + '20' : colors.muted, marginTop: spacing.md }]}>
            <Feather name={enabled ? 'check-circle' : 'x-circle'} size={14} color={enabled ? colors.success : colors.mutedForeground} />
            <Text style={[styles.statusText, { color: enabled ? colors.success : colors.mutedForeground }]}>
              {enabled ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

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
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
