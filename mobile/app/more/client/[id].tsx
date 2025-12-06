import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore, useJobsStore, useQuotesStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../../src/lib/design-tokens';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClient, deleteClient } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { quotes, fetchQuotes } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const clientData = await getClient(id!);
    setClient(clientData);
    await Promise.all([fetchJobs(), fetchQuotes(), fetchInvoices()]);
    setIsLoading(false);
  };

  const clientJobs = jobs.filter(j => j.clientId === id);
  const clientQuotes = quotes.filter(q => q.clientId === id);
  const clientInvoices = invoices.filter(i => i.clientId === id);

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Client',
      'Are you sure you want to delete this client? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const success = await deleteClient(id!);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete client');
            }
          }
        }
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Client not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Client Details',
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
            </View>
            <Text style={styles.clientName}>{client.name}</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, !client.phone && styles.actionButtonDisabled]}
              onPress={handleCall}
              disabled={!client.phone}
            >
              <Feather name="phone" size={20} color={client.phone ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.actionButtonText, !client.phone && styles.actionButtonTextDisabled]}>
                Call
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, !client.email && styles.actionButtonDisabled]}
              onPress={handleEmail}
              disabled={!client.email}
            >
              <Feather name="mail" size={20} color={client.email ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.actionButtonText, !client.email && styles.actionButtonTextDisabled]}>
                Email
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <View style={styles.card}>
            {client.phone || client.email || client.address ? (
              <>
                {client.phone && (
                  <View style={styles.infoRow}>
                    <Feather name="phone" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.phone}</Text>
                  </View>
                )}
                {client.email && (
                  <View style={styles.infoRow}>
                    <Feather name="mail" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.email}</Text>
                  </View>
                )}
                {client.address && (
                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.address}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noInfoText}>No contact information</Text>
            )}
          </View>

          {/* Stats */}
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="briefcase" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{clientJobs.length}</Text>
              <Text style={styles.statLabel}>Jobs</Text>
            </View>
            <View style={styles.statItem}>
              <Feather name="file-text" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{clientQuotes.length}</Text>
              <Text style={styles.statLabel}>Quotes</Text>
            </View>
            <View style={styles.statItem}>
              <Feather name="file-text" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{clientInvoices.length}</Text>
              <Text style={styles.statLabel}>Invoices</Text>
            </View>
          </View>

          {/* Notes */}
          {client.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.card}>
                <Text style={styles.notesText}>{client.notes}</Text>
              </View>
            </>
          )}
        </View>
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
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  headerButton: {
    padding: spacing.sm,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientName: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  actionButtonDisabled: {
    backgroundColor: colors.muted,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  actionButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  noInfoText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statValue: {
    ...typography.largeTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  notesText: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 22,
  },
});
