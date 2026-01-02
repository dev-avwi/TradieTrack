import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import { SignaturePad } from '../../src/components/SignaturePad';

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
    defaultSignature: (businessSettings as any)?.defaultSignature || '',
    signatureName: (businessSettings as any)?.signatureName || '',
    includeSignatureOnQuotes: (businessSettings as any)?.includeSignatureOnQuotes || false,
    includeSignatureOnInvoices: (businessSettings as any)?.includeSignatureOnInvoices || false,
  });
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    if (businessSettings) {
      setForm({
        businessName: businessSettings.businessName || '',
        abn: businessSettings.abn || '',
        phone: businessSettings.phone || '',
        email: businessSettings.email || '',
        address: businessSettings.address || '',
        defaultSignature: (businessSettings as any)?.defaultSignature || '',
        signatureName: (businessSettings as any)?.signatureName || '',
        includeSignatureOnQuotes: (businessSettings as any)?.includeSignatureOnQuotes || false,
        includeSignatureOnInvoices: (businessSettings as any)?.includeSignatureOnInvoices || false,
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

          <Text style={styles.sectionTitle}>Digital Signature</Text>
          <Text style={styles.sectionDescription}>
            Add your signature to quotes and invoices for a professional touch
          </Text>

          {form.defaultSignature && !showSignaturePad ? (
            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }]}>
              <View style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md }}>
                <Image 
                  source={{ uri: form.defaultSignature }} 
                  style={{ width: '100%', height: 80, resizeMode: 'contain' }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }]}
                  onPress={() => setShowSignaturePad(true)}
                >
                  <Feather name="edit-2" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '500' }}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }]}
                  onPress={() => setForm({ ...form, defaultSignature: '' })}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontWeight: '500' }}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <SignaturePad
                onSave={(signature) => {
                  setForm({ ...form, defaultSignature: signature });
                  setShowSignaturePad(false);
                }}
                onClear={() => setForm({ ...form, defaultSignature: '' })}
                label="Draw your signature"
                showControls={true}
                existingSignature={showSignaturePad ? form.defaultSignature : undefined}
              />
              {showSignaturePad && (
                <TouchableOpacity
                  style={[styles.input, { marginTop: spacing.sm, alignItems: 'center' }]}
                  onPress={() => setShowSignaturePad(false)}
                >
                  <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Name Under Signature</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.signatureName}
              onChangeText={(text) => setForm({ ...form, signatureName: text })}
              placeholder="e.g., John Smith, Director"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.inputHint}>
              This name will appear below your signature on documents
            </Text>
          </View>

          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelText}>Include on Quotes</Text>
                <Text style={[styles.inputHint, { marginTop: 2 }]}>Add your signature to all quotes</Text>
              </View>
              <Switch
                value={form.includeSignatureOnQuotes}
                onValueChange={(value) => setForm({ ...form, includeSignatureOnQuotes: value })}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={form.includeSignatureOnQuotes ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelText}>Include on Invoices</Text>
                <Text style={[styles.inputHint, { marginTop: 2 }]}>Add your signature to all invoices</Text>
              </View>
              <Switch
                value={form.includeSignatureOnInvoices}
                onValueChange={(value) => setForm({ ...form, includeSignatureOnInvoices: value })}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={form.includeSignatureOnInvoices ? colors.primary : colors.mutedForeground}
              />
            </View>
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
