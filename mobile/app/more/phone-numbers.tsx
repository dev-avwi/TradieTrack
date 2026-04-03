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

  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState('');
  const [locality, setLocality] = useState('');

  const searchNumbers = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (areaCode.trim()) params.set('areaCode', areaCode.trim());
      if (locality.trim()) params.set('locality', locality.trim());
      params.set('limit', '10');

      const response = await api.get<{ numbers: AvailableNumber[] }>(`/api/sms/available-numbers?${params.toString()}`);
      if (response.data?.numbers) {
        setNumbers(response.data.numbers);
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to search for numbers');
    } finally {
      setLoading(false);
    }
  }, [areaCode, locality]);

  const handlePurchase = (number: AvailableNumber) => {
    Alert.alert(
      'Get This Number',
      `Set up ${number.friendlyName || number.phoneNumber} as your business SMS and calling number?\n\n${number.locality ? `Location: ${number.locality}` : ''}`,
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
                if (response.error.includes('address')) {
                  Alert.alert(
                    'Business Address Required',
                    'Australian phone numbers require a registered business address. Please add your full address (including street, suburb, state, and postcode) in Business Settings first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Go to Settings', onPress: () => router.push('/more/business-settings') },
                    ]
                  );
                } else {
                  Alert.alert('Error', response.error);
                }
              } else {
                Alert.alert(
                  'Number Activated!',
                  `${number.friendlyName || number.phoneNumber} is now your business number. You can send and receive SMS from the Chat Hub.`,
                  [{ text: 'OK', onPress: () => router.back() }]
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
    searchNumbers();
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
        <Text style={styles.pageTitle}>Get a Phone Number</Text>
        <Text style={styles.pageSubtitle}>
          Choose a dedicated Australian phone number for two-way SMS with clients and AI Receptionist calls.
        </Text>

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
                      <View style={styles.capBadge}>
                        <Feather name="message-square" size={10} color={colors.success} />
                        <Text style={[styles.capText, { color: colors.success }]}>SMS</Text>
                      </View>
                    )}
                    {num.capabilities?.voice && (
                      <View style={styles.capBadge}>
                        <Feather name="phone-call" size={10} color={colors.primary} />
                        <Text style={[styles.capText, { color: colors.primary }]}>Voice</Text>
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
            <Text style={styles.emptyTitle}>No Numbers Found</Text>
            <Text style={styles.emptyDesc}>
              Try searching without filters, or with a different area code or city.
            </Text>
          </View>
        ) : null}

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
  },
});
