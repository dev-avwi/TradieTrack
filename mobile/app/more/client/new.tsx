import { useState, useMemo, useEffect } from 'react';
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
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientsStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { spacing, radius } from '../../../src/lib/design-tokens';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
    marginLeft: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputLabelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing['2xl'],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});

export default function NewClientScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { createClient, updateClient, getClient } = useClientsStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  
  const isEditMode = !!clientId;
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    if (!clientId) return;
    setIsLoadingClient(true);
    const client = await getClient(clientId);
    if (client) {
      setForm({
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || '',
      });
    }
    setIsLoadingClient(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Client name is required');
      return;
    }

    setIsLoading(true);
    
    if (isEditMode && clientId) {
      const success = await updateClient(clientId, form);
      setIsLoading(false);
      
      if (success) {
        Alert.alert('Success', 'Client updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to update client. Please try again.');
      }
    } else {
      const client = await createClient(form);
      setIsLoading(false);

      if (client) {
        Alert.alert('Success', 'Client created successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create client. Please try again.');
      }
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
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Client' : 'New Client'}</Text>
          <TouchableOpacity
            style={styles.saveHeaderButton}
            onPress={handleSave}
            disabled={isLoading || isLoadingClient}
          >
            {isLoading || isLoadingClient ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="check" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Client Information</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Name *</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Enter client name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>

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
              placeholder="client@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Address</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
              placeholder="Enter client address"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="file-text" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Notes</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              placeholder="Additional notes about this client"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Feather name="save" size={20} color={colors.white} />
                <Text style={styles.saveButtonText}>Create Client</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  );
}
