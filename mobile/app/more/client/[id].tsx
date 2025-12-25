import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Image
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore, useJobsStore, useQuotesStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../../src/lib/design-tokens';
import api from '../../../src/lib/api';

interface ActivityItem {
  id: string;
  type: 'job' | 'quote' | 'invoice';
  title: string;
  date: Date;
  status?: string;
  amount?: number;
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClient, deleteClient } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { quotes, fetchQuotes } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedSignature, setSavedSignature] = useState<{ signatureData: string | null; signatureDate: string | null } | null>(null);
  const [isLoadingSignature, setIsLoadingSignature] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    loadData();
    fetchSavedSignature();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const clientData = await getClient(id!);
    setClient(clientData);
    await Promise.all([fetchJobs(), fetchQuotes(), fetchInvoices()]);
    setIsLoading(false);
  };

  const fetchSavedSignature = async () => {
    if (!id) return;
    setIsLoadingSignature(true);
    try {
      const response = await api.get<{ signatureData: string | null; signatureDate: string | null }>(`/api/clients/${id}/saved-signature`);
      if (response.data) {
        setSavedSignature(response.data);
      }
    } catch (error) {
      console.error('Error fetching saved signature:', error);
    } finally {
      setIsLoadingSignature(false);
    }
  };

  const handleClearSignature = () => {
    Alert.alert(
      'Clear Signature',
      'Are you sure you want to clear the saved signature for this client?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/api/clients/${id}/saved-signature`);
              if (response.data) {
                setSavedSignature(null);
                Alert.alert('Success', 'Signature cleared successfully');
              } else {
                Alert.alert('Error', 'Failed to clear signature');
              }
            } catch (error) {
              console.error('Error clearing signature:', error);
              Alert.alert('Error', 'An error occurred while clearing the signature');
            }
          }
        }
      ]
    );
  };

  const clientJobs = jobs.filter(j => j.clientId === id);
  const clientQuotes = quotes.filter(q => q.clientId === id);
  const clientInvoices = invoices.filter(i => i.clientId === id);

  const activityTimeline = useMemo(() => {
    const activities: ActivityItem[] = [];
    
    clientJobs.forEach(job => {
      activities.push({
        id: `job-${job.id}`,
        type: 'job',
        title: job.title,
        date: new Date(job.scheduledAt || job.createdAt || Date.now()),
        status: job.status,
      });
    });
    
    clientQuotes.forEach(quote => {
      activities.push({
        id: `quote-${quote.id}`,
        type: 'quote',
        title: `Quote #${quote.quoteNumber || quote.id.slice(0,6)}`,
        date: new Date(quote.createdAt || Date.now()),
        amount: quote.total,
      });
    });
    
    clientInvoices.forEach(invoice => {
      activities.push({
        id: `invoice-${invoice.id}`,
        type: 'invoice',
        title: `Invoice #${invoice.invoiceNumber || invoice.id.slice(0,6)}`,
        date: new Date(invoice.createdAt || Date.now()),
        amount: invoice.total,
      });
    });
    
    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [clientJobs, clientQuotes, clientInvoices]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getTimelineIcon = (type: 'job' | 'quote' | 'invoice') => {
    switch (type) {
      case 'job':
        return { name: 'briefcase' as const, color: colors.primary };
      case 'quote':
        return { name: 'file-text' as const, color: colors.info };
      case 'invoice':
        return { name: 'credit-card' as const, color: colors.success };
    }
  };

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
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity onPress={() => router.push(`/more/client/new?clientId=${id}`)} style={styles.headerButton}>
                <Feather name="edit-2" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Feather name="trash-2" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
            </View>
            <Text style={styles.clientName}>{client.name}</Text>
            {(client.email || client.phone) && (
              <Text style={styles.clientSubtitle}>
                {client.email || client.phone}
              </Text>
            )}
            
            {/* Quick Actions inside profile card */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, !client.phone && styles.actionButtonDisabled]}
                onPress={handleCall}
                disabled={!client.phone}
              >
                <Feather name="phone" size={18} color={client.phone ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client.phone && styles.actionButtonTextDisabled]}>
                  Call
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, !client.email && styles.actionButtonDisabled]}
                onPress={handleEmail}
                disabled={!client.email}
              >
                <Feather name="mail" size={18} color={client.email ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client.email && styles.actionButtonTextDisabled]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={() => router.push(`/more/quote/new?clientId=${id}`)}
              >
                <Feather name="file-text" size={18} color={colors.primary} />
                <Text style={styles.actionButtonSecondaryText}>Quote</Text>
              </TouchableOpacity>
            </View>
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

          {/* Saved Signature */}
          <Text style={styles.sectionTitle}>Saved Signature</Text>
          <View style={styles.card}>
            {isLoadingSignature ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
            ) : savedSignature?.signatureData ? (
              <View style={styles.signatureContainer}>
                <Image 
                  source={{ uri: savedSignature.signatureData }} 
                  style={styles.signatureImage} 
                  resizeMode="contain"
                />
                <View style={styles.signatureFooter}>
                  <Text style={styles.signatureDate}>
                    Saved on {new Date(savedSignature.signatureDate!).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                  <TouchableOpacity 
                    style={styles.clearSignatureButton}
                    onPress={handleClearSignature}
                  >
                    <Feather name="x-circle" size={16} color={colors.destructive} />
                    <Text style={styles.clearSignatureText}>Clear Signature</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.noInfoText}>No saved signature - signatures can be saved during job sign-off</Text>
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

          {/* Activity Timeline */}
          {activityTimeline.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <View style={styles.timelineCard}>
                {activityTimeline.map((activity, index) => {
                  const icon = getTimelineIcon(activity.type);
                  return (
                    <View 
                      key={activity.id} 
                      style={[
                        styles.timelineItem,
                        index === activityTimeline.length - 1 && { borderBottomWidth: 0 }
                      ]}
                    >
                      <View style={[styles.timelineIcon, { backgroundColor: icon.color + '20' }]}>
                        <Feather name={icon.name} size={16} color={icon.color} />
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>{activity.title}</Text>
                        <Text style={styles.timelineDate}>
                          {activity.date.toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      {activity.status && (
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status, colors).bg }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(activity.status, colors).text }]}>
                            {activity.status.replace('_', ' ')}
                          </Text>
                        </View>
                      )}
                      {activity.amount !== undefined && (
                        <Text style={styles.timelineAmount}>{formatCurrency(activity.amount)}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Past Jobs - Clickable List */}
          {clientJobs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Past Jobs</Text>
              {clientJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => router.push(`/job/${job.id}`)}
                  data-testid={`card-job-${job.id}`}
                >
                  <View style={styles.jobCardContent}>
                    <View style={styles.jobCardHeader}>
                      <View style={styles.jobIconContainer}>
                        <Feather name="briefcase" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                        {job.scheduledAt && (
                          <Text style={styles.jobDate}>
                            {new Date(job.scheduledAt).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status, colors).bg }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(job.status, colors).text }]}>
                        {job.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Photos Section */}
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photosSection}>
            {clientJobs.some(job => job.attachments && job.attachments.length > 0) ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {clientJobs.flatMap(job => 
                  (job.attachments || []).map((attachment: any, index: number) => {
                    const imageUrl = typeof attachment === 'string' ? attachment : attachment?.url;
                    if (!imageUrl) return null;
                    return (
                      <Image
                        key={`${job.id}-${index}`}
                        source={{ uri: imageUrl }}
                        style={styles.photoThumbnail}
                        resizeMode="cover"
                      />
                    );
                  }).filter(Boolean)
                )}
              </ScrollView>
            ) : (
              <View style={styles.card}>
                <Text style={styles.noPhotosText}>No photos from jobs yet</Text>
              </View>
            )}
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

const getStatusColor = (status: string, colors: ThemeColors) => {
  switch (status) {
    case 'pending':
      return { bg: colors.warningLight, text: colors.warning };
    case 'scheduled':
      return { bg: colors.infoLight, text: colors.info };
    case 'in_progress':
      return { bg: colors.primaryLight, text: colors.primary };
    case 'done':
      return { bg: colors.successLight, text: colors.success };
    case 'invoiced':
      return { bg: colors.successLight, text: colors.success };
    default:
      return { bg: colors.muted, text: colors.mutedForeground };
  }
};

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
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
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
    textAlign: 'center',
  },
  clientSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  actionButtonDisabled: {
    backgroundColor: colors.muted,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  actionButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  actionButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
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
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  jobCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  jobIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  jobCardInfo: {
    flex: 1,
  },
  jobTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  photosSection: {
    marginBottom: spacing.xl,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  noPhotosText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  signatureContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signatureFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.xs,
  },
  signatureDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearSignatureText: {
    ...typography.caption,
    color: colors.destructive,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineIcon: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  timelineDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timelineAmount: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
});
