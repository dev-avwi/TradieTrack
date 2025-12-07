import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  headerButton: {
    padding: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  brandingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandingLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  brandingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingLinkText: {
    flex: 1,
  },
  brandingLinkTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  brandingLinkSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputLabelText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings, updateBusinessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: businessSettings?.businessName || '',
    abn: businessSettings?.abn || '',
    phone: businessSettings?.phone || '',
    email: businessSettings?.email || '',
    address: businessSettings?.address || '',
  });

  useEffect(() => {
    if (businessSettings) {
      setForm({
        businessName: businessSettings.businessName || '',
        abn: businessSettings.abn || '',
        phone: businessSettings.phone || '',
        email: businessSettings.email || '',
        address: businessSettings.address || '',
      });
    }
  }, [businessSettings]);

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return;
    }

    setIsLoading(true);
    const success = await updateBusinessSettings(form);
    setIsLoading(false);

    if (success) {
      Alert.alert('Success', 'Business settings saved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } else {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Business Settings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              style={styles.headerButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="save" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Branding</Text>
          <TouchableOpacity 
            style={styles.brandingLink}
            onPress={() => router.push('/more/branding')}
          >
            <View style={styles.brandingLinkContent}>
              <View style={styles.brandingIconContainer}>
                <Feather name="edit-3" size={22} color={colors.primary} />
              </View>
              <View style={styles.brandingLinkText}>
                <Text style={styles.brandingLinkTitle}>Logo & Brand Color</Text>
                <Text style={styles.brandingLinkSubtitle}>
                  Customise your business appearance
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Business Details</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="briefcase" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Business Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.businessName}
              onChangeText={(text) => setForm({ ...form, businessName: text })}
              placeholder="Enter your business name"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="hash" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>ABN</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.abn}
              onChangeText={(text) => setForm({ ...form, abn: text })}
              placeholder="12 345 678 901"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <Text style={styles.inputHint}>
              Australian Business Number (optional)
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="phone" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Phone</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
              placeholder="04XX XXX XXX"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="mail" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Email</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              placeholder="contact@business.com.au"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Business Address</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
              placeholder="Enter your business address"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="save" size={20} color={colors.primaryForeground} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
