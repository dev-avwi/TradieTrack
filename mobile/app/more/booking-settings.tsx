import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Alert, TextInput, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell } from '../../src/lib/design-tokens';

interface BookingConfig {
  enabled: boolean;
  slug: string;
  title: string;
  description: string;
  services: { name: string; duration: number; price: number }[];
  availableDays: number[];
  startTime: string;
  endTime: string;
  autoConfirm: boolean;
  requirePhone: boolean;
  requireAddress: boolean;
}

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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  label: { ...typography.body, fontWeight: '600', color: colors.foreground },
  sublabel: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.mutedForeground, marginTop: spacing.lg, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body },
  textArea: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body, minHeight: 80, textAlignVertical: 'top' },
  inputLabel: { ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.xs, marginTop: spacing.md },
  daysRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dayButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
  dayText: { ...typography.caption, fontWeight: '600' },
  serviceCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm },
  serviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceName: { ...typography.body, fontWeight: '600', color: colors.foreground },
  serviceDetail: { ...typography.caption, color: colors.mutedForeground },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
  linkText: { ...typography.body, color: colors.primary, fontWeight: '600', flex: 1 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveButtonText: { ...typography.body, fontWeight: '700', color: '#fff' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', gap: spacing.sm, marginTop: spacing.sm },
  addButtonText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});

export default function BookingSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [requirePhone, setRequirePhone] = useState(true);
  const [requireAddress, setRequireAddress] = useState(false);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [services, setServices] = useState<{ name: string; duration: number; price: number }[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<BookingConfig>('/api/business-settings/booking');
      const data = response.data;
      if (data) {
        setEnabled(data.enabled ?? false);
        setSlug(data.slug || '');
        setTitle(data.title || '');
        setDescription(data.description || '');
        setAutoConfirm(data.autoConfirm ?? false);
        setRequirePhone(data.requirePhone ?? true);
        setRequireAddress(data.requireAddress ?? false);
        setSelectedDays(data.availableDays || [1, 2, 3, 4, 5]);
        setServices(data.services || []);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load booking settings. Pull down to retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/api/business-settings', {
        bookingPageEnabled: enabled,
        bookingSlug: slug,
        bookingPageTitle: title,
        bookingPageDescription: description,
        bookingPageServices: services,
        bookingAvailableDays: selectedDays,
        bookingAutoConfirm: autoConfirm,
        bookingRequirePhone: requirePhone,
        bookingRequireAddress: requireAddress,
      });
      Alert.alert('Saved', 'Booking page settings updated.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
  };

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const addService = () => {
    setServices(prev => [...prev, { name: 'New Service', duration: 60, price: 0 }]);
  };

  const updateService = (index: number, field: string, value: string) => {
    setServices(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === 'name') return { ...s, name: value };
      if (field === 'duration') return { ...s, duration: parseInt(value) || 0 };
      if (field === 'price') return { ...s, price: parseFloat(value) || 0 };
      return s;
    }));
  };

  const bookingUrl = slug ? `${user?.businessName ? user.businessName.toLowerCase().replace(/\s+/g, '-') : 'your-business'}.jobrunner.com.au/book/${slug}` : '';

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
          <Text style={styles.pageTitle}>Booking Page</Text>
        </View>

        {!enabled && (
          <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: `${colors.primary}20` }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="calendar" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.cardTitle, color: colors.foreground }}>Quick setup</Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Let customers book online in minutes</Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>1</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Add your services and pricing</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>2</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Set your available days and hours</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>3</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Enable and share your booking link</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Enable Booking Page</Text>
              <Text style={styles.sublabel}>Let customers book jobs directly from your website</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.muted, true: colors.primary + '40' }}
              thumbColor={enabled ? colors.primary : colors.mutedForeground}
            />
          </View>

          {enabled && slug ? (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(`https://${bookingUrl}`).catch(() => {})}
              activeOpacity={0.7}
            >
              <Feather name="external-link" size={16} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{bookingUrl}</Text>
              <Feather name="copy" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Page Details</Text>
        <Text style={styles.inputLabel}>Page URL Slug</Text>
        <TextInput
          style={styles.input}
          value={slug}
          onChangeText={(text) => setSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
          placeholder="e.g. book-now"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.inputLabel}>Page Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Book a Job"
          placeholderTextColor={colors.mutedForeground}
        />

        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your services and what customers can expect..."
          placeholderTextColor={colors.mutedForeground}
          multiline
        />

        <Text style={styles.sectionTitle}>Available Days</Text>
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

        <Text style={styles.sectionTitle}>Services</Text>
        {services.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.serviceName, { padding: 0 }]}
                  value={service.name}
                  onChangeText={(val) => updateService(index, 'name', val)}
                  placeholder="Service name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
                  <TextInput
                    style={[styles.serviceDetail, { padding: 0, minWidth: 50 }]}
                    value={String(service.duration)}
                    onChangeText={(val) => updateService(index, 'duration', val)}
                    keyboardType="number-pad"
                    placeholder="60"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={styles.serviceDetail}>min</Text>
                  <Text style={styles.serviceDetail}>$</Text>
                  <TextInput
                    style={[styles.serviceDetail, { padding: 0, minWidth: 50 }]}
                    value={String(service.price)}
                    onChangeText={(val) => updateService(index, 'price', val)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={() => removeService(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addService} activeOpacity={0.7}>
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={styles.addButtonText}>Add Service</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Options</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Auto-confirm bookings</Text>
              <Text style={styles.sublabel}>Automatically confirm new bookings</Text>
            </View>
            <Switch
              value={autoConfirm}
              onValueChange={setAutoConfirm}
              trackColor={{ false: colors.muted, true: colors.primary + '40' }}
              thumbColor={autoConfirm ? colors.primary : colors.mutedForeground}
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Require phone number</Text>
              <Text style={styles.sublabel}>Customers must provide a phone number</Text>
            </View>
            <Switch
              value={requirePhone}
              onValueChange={setRequirePhone}
              trackColor={{ false: colors.muted, true: colors.primary + '40' }}
              thumbColor={requirePhone ? colors.primary : colors.mutedForeground}
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Require address</Text>
              <Text style={styles.sublabel}>Customers must provide a job address</Text>
            </View>
            <Switch
              value={requireAddress}
              onValueChange={setRequireAddress}
              trackColor={{ false: colors.muted, true: colors.primary + '40' }}
              thumbColor={requireAddress ? colors.primary : colors.mutedForeground}
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
