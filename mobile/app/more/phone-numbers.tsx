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
  Linking,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getLastNumberKey(businessId?: string | number) {
  const id = businessId || 'default';
  return `@jobrunner_last_dedicated_number:${id}`;
}

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
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseConfirmText, setReleaseConfirmText] = useState('');
  const [lastOwnedNumber, setLastOwnedNumber] = useState<string | null>(null);
  const [reacquiring, setReacquiring] = useState(false);

  const currentNumber = businessSettings?.dedicatedPhoneNumber;
  const storageKey = getLastNumberKey(businessSettings?.id);

  useEffect(() => {
    if (!businessSettings?.id) return;
    AsyncStorage.getItem(storageKey).then(val => {
      if (val) setLastOwnedNumber(val);
    });
  }, [storageKey, businessSettings?.id]);

  useEffect(() => {
    if (currentNumber && businessSettings?.id) {
      AsyncStorage.setItem(storageKey, currentNumber);
      setLastOwnedNumber(currentNumber);
    }
  }, [currentNumber, storageKey, businessSettings?.id]);

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
    setReleaseConfirmText('');
    setShowReleaseModal(true);
  };

  const executeRelease = async () => {
    setReleasing(true);
    setShowReleaseModal(false);
    try {
      const response = await api.post('/api/sms/release-number', {});
      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        await fetchBusinessSettings();
        Alert.alert(
          'Reverted to Shared', 
          'Your dedicated number has been released. You can re-acquire it from this screen if it\'s still available.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to release number');
    } finally {
      setReleasing(false);
    }
  };

  const handleReacquireLastNumber = async () => {
    if (!lastOwnedNumber) return;
    Alert.alert(
      'Re-acquire Number',
      `Get ${formatPhone(lastOwnedNumber)} back as your dedicated business number?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get It Back',
          onPress: async () => {
            setReacquiring(true);
            try {
              const response = await api.post('/api/sms/purchase-number', { phoneNumber: lastOwnedNumber });
              if (response.error) {
                if (response.error.includes('not available') || response.error.includes('not found')) {
                  Alert.alert(
                    'Number Unavailable',
                    `${formatPhone(lastOwnedNumber)} is no longer available. You can search for a new number instead.`
                  );
                  AsyncStorage.removeItem(storageKey);
                  setLastOwnedNumber(null);
                } else if (response.error.includes('address') || response.error.includes('Address')) {
                  Alert.alert(
                    'Business Address Required',
                    'Australian phone numbers require a registered business address. Please add your full address in Settings first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Go to Settings', onPress: () => router.push('/more/settings') },
                    ]
                  );
                } else {
                  Alert.alert('Error', response.error);
                }
              } else if (response.data && (response.data as any).requiresPayment) {
                const checkoutUrl = (response.data as any).checkoutUrl;
                if (checkoutUrl) {
                  Alert.alert(
                    'Payment Required',
                    'Dedicated phone numbers are $10/month. You\'ll be taken to checkout to complete your purchase.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Continue to Payment', onPress: () => {
                        const Linking = require('react-native').Linking;
                        Linking.openURL(checkoutUrl);
                      }},
                    ]
                  );
                } else {
                  Alert.alert('Payment Required', 'Dedicated phone numbers are $10/month. Please contact admin@avwebinnovation.com for assistance.');
                }
              } else {
                await fetchBusinessSettings();
                Alert.alert('Number Reactivated!', `${formatPhone(lastOwnedNumber)} is your dedicated number again.`);
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to re-acquire number');
            } finally {
              setReacquiring(false);
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
    const hasMms = number.capabilities?.mms;
    const hasVoice = number.capabilities?.voice;
    let capabilityNote = '';
    const caps: string[] = [];
    if (hasVoice) caps.push('Voice');
    if (hasSms) caps.push('SMS');
    if (hasMms) caps.push('MMS');
    capabilityNote = caps.length > 0 ? caps.join(' + ') : 'Standard';

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
              } else if (response.data && (response.data as any).requiresPayment) {
                const checkoutUrl = (response.data as any).checkoutUrl;
                if (checkoutUrl) {
                  Alert.alert(
                    'Payment Required',
                    'Dedicated phone numbers are $10/month. You\'ll be taken to checkout to complete your purchase.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Continue to Payment', onPress: () => {
                        const Linking = require('react-native').Linking;
                        Linking.openURL(checkoutUrl);
                      }},
                    ]
                  );
                } else {
                  Alert.alert(
                    'Payment Required',
                    'Dedicated phone numbers are available as a $10/month add-on. Please contact admin@avwebinnovation.com for assistance.',
                    [{ text: 'OK' }]
                  );
                }
              } else {
                await fetchBusinessSettings();
                Alert.alert(
                  'Number Activated!',
                  `${formatPhone(number.phoneNumber)} is now your dedicated business number.\n\nYou've upgraded from the shared JobRunner number (0485 013 993). Your clients will now see your own number when you send SMS.\n\nYou can also set up an AI Receptionist on this number.`,
                  [
                    { text: 'Set Up AI Receptionist', onPress: () => router.replace('/more/ai-receptionist') },
                    { text: 'Go to Chat Hub', onPress: () => router.replace('/more/chat-hub') },
                  ]
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

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.info}10`, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: `${colors.info}30` }}>
          <Feather name="info" size={14} color={colors.info} />
          <Text style={{ fontSize: 12, color: colors.info, flex: 1, lineHeight: 17 }}>
            Beta access — phone number setup is currently free during the beta period. Standard pricing ($10/mo) applies after launch.
          </Text>
        </View>

        {currentNumber ? (
          <>
            <View style={styles.currentNumberCard}>
              <View style={styles.currentNumberHeader}>
                <View style={styles.activeIndicator}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeLabel}>Active — Your Dedicated Number</Text>
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

              <View style={{ backgroundColor: `${colors.muted}50`, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
                  Clients see this number when you send SMS. Replies come straight to your Chat Hub. You've upgraded from the shared JobRunner number (0485 013 993).
                </Text>
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
                    {releasing ? 'Releasing...' : 'Revert to Shared'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground, marginTop: spacing.lg, marginBottom: spacing.sm }}>Next Steps</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md }}
              onPress={() => router.push('/more/ai-receptionist')}
              activeOpacity={0.7}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="cpu" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>Set Up AI Receptionist</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>Let AI answer calls and take messages on this number</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mutedForeground }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.mutedForeground }}>
                  Using Shared Number
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>0485 013 993</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
                You're on the shared JobRunner platform number. Get a dedicated number below so clients see your own business number.
              </Text>
            </View>

            {lastOwnedNumber && !currentNumber && (
              <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: `${colors.primary}25`, marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Feather name="rotate-ccw" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Previously Owned Number</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs }}>
                  {formatPhone(lastOwnedNumber)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.md }}>
                  Want this number back? Tap below to re-acquire it if it's still available.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }}
                  onPress={handleReacquireLastNumber}
                  disabled={reacquiring}
                  activeOpacity={0.7}
                >
                  {reacquiring ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="phone" size={14} color={colors.primaryForeground} />
                  )}
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryForeground }}>
                    {reacquiring ? 'Re-acquiring...' : 'Get This Number Back'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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

      <Modal
        visible={showReleaseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReleaseModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>Release Number</Text>
            <TouchableOpacity onPress={() => setShowReleaseModal(false)} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: `${colors.destructive}10`, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Feather name="alert-triangle" size={18} color={colors.destructive} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.destructive }}>This action can't be undone</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 20 }}>
              Releasing {formatPhone(currentNumber || '')} means:{'\n'}
              {'\n'}{'\u2022'} You'll go back to the shared JobRunner number (0485 013 993)
              {'\n'}{'\u2022'} Your AI Receptionist will be deactivated if active
              {'\n'}{'\u2022'} Existing SMS conversations will be kept
              {'\n'}{'\u2022'} The number may not be available to re-acquire later
            </Text>
          </View>

          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: '600', marginBottom: spacing.sm }}>
            Type RELEASE to confirm
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: releaseConfirmText === 'RELEASE' ? colors.destructive : colors.border,
              padding: spacing.md,
              fontSize: 16,
              fontWeight: '600',
              color: colors.foreground,
              letterSpacing: 2,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}
            placeholder="RELEASE"
            placeholderTextColor={colors.mutedForeground + '60'}
            value={releaseConfirmText}
            onChangeText={setReleaseConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={{
              backgroundColor: releaseConfirmText === 'RELEASE' ? colors.destructive : colors.muted,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: releaseConfirmText === 'RELEASE' ? 1 : 0.5,
            }}
            onPress={executeRelease}
            disabled={releaseConfirmText !== 'RELEASE' || releasing}
            activeOpacity={0.7}
          >
            {releasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: releaseConfirmText === 'RELEASE' ? '#fff' : colors.mutedForeground }}>
                Release Number
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
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
