import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
}

export default function PhoneNumbersPage() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings, fetchBusinessSettings } = useAuthStore();

  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [locality, setLocality] = useState('');

  const currentNumber = businessSettings?.dedicatedPhoneNumber;

  const searchNumbers = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (areaCode.trim()) params.set('areaCode', areaCode.trim());
      if (locality.trim()) params.set('locality', locality.trim());
      params.set('limit', '15');
      params.set('smsEnabled', 'true');

      const response = await api.get<{ numbers: AvailableNumber[] }>(`/api/sms/available-numbers?${params.toString()}`);
      if (response.data?.numbers) {
        const smsNumbers = response.data.numbers.filter(n => n.capabilities?.sms !== false);
        setNumbers(smsNumbers);
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to search for numbers');
    } finally {
      setLoading(false);
    }
  }, [areaCode, locality]);

  const handleRelease = () => {
    Alert.alert(
      'Release Number',
      `Are you sure you want to release ${formatPhone(currentNumber || '')}?\n\nYou will no longer be able to send or receive SMS from this number. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release Number',
          style: 'destructive',
          onPress: async () => {
            setReleasing(true);
            try {
              const response = await api.post('/api/sms/release-number', {});
              if (response.error) {
                Alert.alert('Error', response.error);
              } else {
                await fetchBusinessSettings();
                Alert.alert('Number Released', 'Your business number has been released. You can now select a new number.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to release number');
            } finally {
              setReleasing(false);
            }
          },
        },
      ]
    );
  };

  const handlePurchase = (number: AvailableNumber) => {
    if (currentNumber) {
      Alert.alert(
        'Already Have a Number',
        `Your business already has ${formatPhone(currentNumber)}.\n\nTo get a different number, you need to release your current one first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Release Current Number', style: 'destructive', onPress: handleRelease },
        ]
      );
      return;
    }

    const hasSms = number.capabilities?.sms;
    const hasVoice = number.capabilities?.voice;
    let capabilityNote = '';
    if (hasSms && hasVoice) capabilityNote = 'SMS + Voice';
    else if (hasSms) capabilityNote = 'SMS only';
    else if (hasVoice) capabilityNote = 'Voice only (no SMS)';

    Alert.alert(
      'Get This Number',
      `Set up ${formatPhone(number.phoneNumber)} as your business number?\n\nCapabilities: ${capabilityNote}${number.locality ? `\nLocation: ${number.locality}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get Number',
          onPress: async () => {
            setPurchasing(number.phoneNumber);
            try {
              const response = await api.post('/api/sms/purchase-number', {
                phoneNumber: number.phoneNumber,
              });
              if (response.error) {
                if (response.error.includes('address') || response.error.includes('Address')) {
                  Alert.alert(
                    'Business Address Required',
                    'Australian phone numbers require a registered business address. Please add your full address (including street, suburb, state, and postcode) in Settings first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Go to Settings', onPress: () => router.push('/more/settings') },
                    ]
                  );
                } else if (response.error.includes('already has')) {
                  Alert.alert('Already Have a Number', response.error);
                  await fetchBusinessSettings();
                } else {
                  Alert.alert('Error', response.error);
                }
              } else {
                await fetchBusinessSettings();
                Alert.alert(
                  'Number Activated!',
                  `${formatPhone(number.phoneNumber)} is now your business number. You can send and receive SMS from the Chat Hub.`,
                  [{ text: 'Go to Chat Hub', onPress: () => router.replace('/more/chat-hub') }]
                );
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to set up number. Please try again.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!currentNumber) searchNumbers();
  }, []);

  const formatPhone = (phone: string) => {
    if (phone.startsWith('+61')) {
      const local = phone.replace('+61', '0');
      return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    return phone;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Phone Numbers</Text>
        <Text style={styles.pageSubtitle}>
          Your dedicated Australian phone number for two-way SMS with clients and AI Receptionist calls.
        </Text>

        {currentNumber ? (
          <View style={styles.currentNumberCard}>
            <View style={styles.currentNumberHeader}>
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <Text style={styles.activeLabel}>Active</Text>
              </View>
            </View>
            <View style={styles.currentNumberRow}>
              <View style={styles.currentNumberIcon}>
                <Feather name="phone" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentNumberText}>{formatPhone(currentNumber)}</Text>
                <Text style={styles.currentNumberDesc}>Your business SMS & calling number</Text>
              </View>
            </View>
            <View style={styles.currentNumberActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/more/chat-hub')}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={14} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>Open Chat Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.releaseButton]}
                onPress={handleRelease}
                disabled={releasing}
                activeOpacity={0.7}
              >
                {releasing ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Feather name="x-circle" size={14} color={colors.destructive} />
                )}
                <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                  {releasing ? 'Releasing...' : 'Release Number'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.searchCard}>
              <Text style={styles.searchLabel}>Filter by area (optional)</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="Area code (e.g. 07)"
                  placeholderTextColor={colors.mutedForeground}
                  value={areaCode}
                  onChangeText={setAreaCode}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <TextInput
                  style={[styles.searchInput, { flex: 1.5 }]}
                  placeholder="City (e.g. Brisbane)"
                  placeholderTextColor={colors.mutedForeground}
                  value={locality}
                  onChangeText={setLocality}
                />
              </View>
              <TouchableOpacity
                style={[styles.searchButton, loading && { opacity: 0.6 }]}
                onPress={searchNumbers}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="search" size={16} color={colors.primaryForeground} />
                )}
                <Text style={styles.searchButtonText}>{loading ? 'Searching...' : 'Search Numbers'}</Text>
              </TouchableOpacity>
            </View>

            {loading && !searched ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Finding available numbers...</Text>
              </View>
            ) : numbers.length > 0 ? (
              <View style={styles.resultsSection}>
                <Text style={styles.resultsTitle}>Available Numbers</Text>
                <Text style={styles.resultsSubtitle}>{numbers.length} numbers found. Tap to select.</Text>
                {numbers.map((num) => (
                  <TouchableOpacity
                    key={num.phoneNumber}
                    style={styles.numberCard}
                    onPress={() => handlePurchase(num)}
                    disabled={purchasing === num.phoneNumber}
                    activeOpacity={0.7}
                  >
                    <View style={styles.numberIcon}>
                      {purchasing === num.phoneNumber ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="phone" size={18} color={colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.numberText}>{formatPhone(num.phoneNumber)}</Text>
                      {num.locality && (
                        <Text style={styles.numberLocation}>
                          <Feather name="map-pin" size={11} color={colors.mutedForeground} /> {num.locality}{num.region ? `, ${num.region}` : ''}
                        </Text>
                      )}
                      <View style={styles.capsRow}>
                        {num.capabilities?.sms && (
                          <View style={[styles.capBadge, { backgroundColor: `${colors.success}15` }]}>
                            <Feather name="message-square" size={10} color={colors.success} />
                            <Text style={[styles.capText, { color: colors.success }]}>SMS</Text>
                          </View>
                        )}
                        {num.capabilities?.voice && (
                          <View style={[styles.capBadge, { backgroundColor: `${colors.primary}15` }]}>
                            <Feather name="phone-call" size={10} color={colors.primary} />
                            <Text style={[styles.capText, { color: colors.primary }]}>Voice</Text>
                          </View>
                        )}
                        {num.capabilities?.mms && (
                          <View style={[styles.capBadge, { backgroundColor: `${colors.warning}15` }]}>
                            <Feather name="image" size={10} color={colors.warning} />
                            <Text style={[styles.capText, { color: colors.warning }]}>MMS</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.selectButton}>
                      <Text style={styles.selectButtonText}>Select</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : searched && !loading ? (
              <View style={styles.emptyContainer}>
                <Feather name="phone-off" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No SMS Numbers Found</Text>
                <Text style={styles.emptyDesc}>
                  Try searching without filters, or with a different area code or city. Australian mobile numbers typically support SMS.
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => { setAreaCode(''); setLocality(''); setTimeout(searchNumbers, 100); }}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>Search All Numbers</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  currentNumberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  currentNumberHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.md,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.success}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  currentNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  currentNumberIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.success}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentNumberText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  currentNumberDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  currentNumberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
  },
  releaseButton: {
    backgroundColor: `${colors.destructive}10`,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  resultsSection: {
    marginBottom: spacing.md,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  numberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  numberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: 0.5,
  },
  numberLocation: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  capsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  capBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  capText: {
    fontSize: 11,
    fontWeight: '500',
  },
  selectButton: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
    marginTop: spacing.sm,
  },
});
