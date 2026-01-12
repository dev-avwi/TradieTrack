import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  address?: string;
  clientId?: string;
  client?: Client;
}

interface SmsConversation {
  id: string;
  clientId: string | null;
  clientPhone: string;
  clientName: string | null;
  jobId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface TwilioStatus {
  enabled: boolean;
  phoneNumber: string | null;
}

interface ConversationItem {
  id: string;
  type: 'job' | 'team' | 'client' | 'sms';
  title: string;
  subtitle?: string;
  avatarFallback: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  status?: string;
  phone?: string;
  email?: string;
  data: any;
}

type FilterType = 'all' | 'jobs' | 'customers' | 'team';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    minHeight: 44,
  },
  quickActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  quickActionButtonSecondary: {
    backgroundColor: colors.muted,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionTextPrimary: {
    color: colors.primaryForeground,
  },
  quickActionTextSecondary: {
    color: colors.foreground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    height: 40,
    gap: spacing.sm,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  filterButtonTextActive: {
    color: colors.primaryForeground,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conversationsList: {
    flex: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  conversationAvatarJob: {
    backgroundColor: colors.primaryLight,
  },
  conversationAvatarTeam: {
    backgroundColor: colors.infoLight,
  },
  conversationAvatarClient: {
    backgroundColor: colors.successLight,
  },
  conversationAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  conversationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginLeft: spacing.sm,
  },
  conversationSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  conversationLastMessage: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  conversationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  contactActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    gap: 4,
  },
  contactActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  chevronIcon: {
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  twilioSetupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    gap: spacing.sm,
  },
  twilioSetupIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twilioSetupContent: {
    flex: 1,
  },
  twilioSetupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  twilioSetupDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  twilioSetupButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warning,
    borderRadius: radius.md,
  },
  twilioSetupButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  twilioConnectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.success,
    gap: spacing.sm,
  },
  twilioConnectedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.success,
  },
  smsConversationAvatar: {
    backgroundColor: colors.successLight,
  },
});

export default function ChatHubScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [smsConversations, setSmsConversations] = useState<SmsConversation[]>([]);
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, clientsRes, smsRes, twilioRes] = await Promise.all([
        api.get<Job[]>('/api/jobs'),
        api.get<Client[]>('/api/clients'),
        api.get<SmsConversation[]>('/api/sms/conversations').catch(() => ({ data: [] })),
        api.get<TwilioStatus>('/api/sms/status').catch(() => ({ data: null })),
      ]);
      setJobs(jobsRes.data || []);
      setClients(clientsRes.data || []);
      setSmsConversations(smsRes.data || []);
      setTwilioStatus(twilioRes.data || null);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || null;
  };

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId) || null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: colors.muted, text: colors.mutedForeground };
      case 'scheduled': return { bg: colors.infoLight, text: colors.info };
      case 'in_progress': return { bg: colors.warningLight, text: colors.warning };
      case 'done': return { bg: colors.successLight, text: colors.success };
      case 'invoiced': return { bg: colors.primaryLight, text: colors.primary };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const twilioConnected = twilioStatus?.enabled === true && !!twilioStatus?.phoneNumber;

  const conversations: ConversationItem[] = useMemo(() => {
    const items: ConversationItem[] = [];
    
    if (activeFilter === 'all' || activeFilter === 'jobs') {
      jobs.forEach(job => {
        const clientName = getClientName(job.clientId);
        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: clientName || job.address || 'No client assigned',
          avatarFallback: job.title.substring(0, 2).toUpperCase(),
          lastMessage: 'Tap to view job discussion',
          unreadCount: 0,
          status: job.status,
          data: job,
        });
      });
    }
    
    if (activeFilter === 'all' || activeFilter === 'customers') {
      smsConversations.forEach(sms => {
        const displayName = sms.clientName || sms.clientPhone;
        items.push({
          id: `sms-${sms.id}`,
          type: 'sms',
          title: displayName,
          subtitle: sms.jobId ? 'Linked to job' : 'SMS conversation',
          avatarFallback: displayName.substring(0, 2).toUpperCase(),
          lastMessage: 'Tap to view SMS history',
          lastMessageTime: sms.lastMessageAt || undefined,
          unreadCount: sms.unreadCount || 0,
          phone: sms.clientPhone,
          data: sms,
        });
      });
    }
    
    if (activeFilter === 'all' || activeFilter === 'team') {
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: 'General team discussion',
        avatarFallback: 'TC',
        lastMessage: 'Tap to join team chat',
        unreadCount: 0,
        data: null,
      });
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [jobs, clients, smsConversations, activeFilter, searchQuery]);

  const handleConversationPress = (item: ConversationItem) => {
    if (item.type === 'team') {
      router.push('/more/team-chat');
    } else if (item.type === 'job') {
      router.push(`/job/chat?jobId=${item.data.id}` as any);
    } else if (item.type === 'sms') {
      Alert.alert(
        'SMS Conversations',
        'View this conversation on the web app for full SMS messaging features.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTwilioSetup = () => {
    Alert.alert(
      'Set Up SMS Messaging',
      'To send and receive SMS messages with your clients, you need to connect Twilio.\n\n1. Go to Settings > Integrations on the web app\n2. Click "Connect Twilio"\n3. Follow the setup wizard\n\nTwilio allows you to send text message updates to clients about their jobs.',
      [{ text: 'Got it' }]
    );
  };

  const handleContactClient = (client: Client) => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    
    if (client.phone) {
      options.push({ text: 'Call', onPress: () => Linking.openURL(`tel:${client.phone}`) });
      options.push({ text: 'SMS', onPress: () => Linking.openURL(`sms:${client.phone}`) });
    }
    if (client.email) {
      options.push({ text: 'Email', onPress: () => Linking.openURL(`mailto:${client.email}`) });
    }
    
    Alert.alert(
      `Contact ${client.firstName || 'Client'}`,
      'Choose how to contact:',
      options as any
    );
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const renderConversation = (item: ConversationItem) => {
    const statusColor = item.status ? getStatusColor(item.status) : null;
    const client = item.type === 'job' && item.data?.clientId ? getClient(item.data.clientId) : null;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
        data-testid={`conversation-${item.id}`}
      >
        <View style={[
          styles.conversationAvatar,
          item.type === 'job' && styles.conversationAvatarJob,
          item.type === 'team' && styles.conversationAvatarTeam,
          item.type === 'client' && styles.conversationAvatarClient,
          item.type === 'sms' && styles.smsConversationAvatar,
        ]}>
          {item.type === 'job' ? (
            <Feather name="briefcase" size={20} color={colors.primary} />
          ) : item.type === 'team' ? (
            <Feather name="users" size={20} color={colors.info} />
          ) : item.type === 'sms' ? (
            <Feather name="smartphone" size={20} color={colors.success} />
          ) : (
            <Text style={[styles.conversationAvatarText, { color: colors.success }]}>
              {item.avatarFallback}
            </Text>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.lastMessageTime && (
              <Text style={styles.conversationTime}>{formatTime(item.lastMessageTime)}</Text>
            )}
          </View>
          
          {item.subtitle && (
            <Text style={styles.conversationSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
          
          <View style={styles.conversationBadges}>
            {statusColor && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                  {item.status?.replace('_', ' ')}
                </Text>
              </View>
            )}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          
          {client && (client.phone || client.email) && (
            <View style={styles.contactActionsRow}>
              {client.phone && (
                <>
                  <TouchableOpacity 
                    style={styles.contactAction}
                    onPress={() => Linking.openURL(`tel:${client.phone}`)}
                    data-testid={`button-call-${item.id}`}
                  >
                    <Feather name="phone" size={14} color={colors.success} />
                    <Text style={styles.contactActionText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.contactAction}
                    onPress={() => Linking.openURL(`sms:${client.phone}`)}
                    data-testid={`button-sms-${item.id}`}
                  >
                    <Feather name="message-square" size={14} color={colors.info} />
                    <Text style={styles.contactActionText}>SMS</Text>
                  </TouchableOpacity>
                </>
              )}
              {client.email && (
                <TouchableOpacity 
                  style={styles.contactAction}
                  onPress={() => Linking.openURL(`mailto:${client.email}`)}
                  data-testid={`button-email-${item.id}`}
                >
                  <Feather name="mail" size={14} color={colors.primary} />
                  <Text style={styles.contactActionText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.chevronIcon} />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={22} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Job Communications</Text>
            <Text style={styles.headerSubtitle}>Messages, SMS & team chat for your jobs</Text>
          </View>
        </View>
        
        {!twilioConnected && activeFilter === 'customers' && (
          <TouchableOpacity 
            style={styles.twilioSetupBanner}
            onPress={handleTwilioSetup}
            activeOpacity={0.8}
            data-testid="banner-twilio-setup"
          >
            <View style={styles.twilioSetupIcon}>
              <Feather name="smartphone" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.twilioSetupContent}>
              <Text style={styles.twilioSetupTitle}>Set Up SMS Messaging</Text>
              <Text style={styles.twilioSetupDescription}>
                Connect Twilio to send job updates via text
              </Text>
            </View>
            <View style={styles.twilioSetupButton}>
              <Text style={styles.twilioSetupButtonText}>Learn How</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {twilioConnected && activeFilter === 'customers' && (
          <View style={styles.twilioConnectedBanner}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={styles.twilioConnectedText}>
              SMS connected - Send texts directly to clients
            </Text>
          </View>
        )}
        
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionButtonPrimary]}
            onPress={() => router.push('/more/team-chat')}
            data-testid="button-team-chat"
          >
            <Feather name="users" size={18} color={colors.primaryForeground} />
            <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>Team Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionButtonSecondary]}
            onPress={() => router.push('/more/clients')}
            data-testid="button-view-clients"
          >
            <Feather name="user" size={18} color={colors.foreground} />
            <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>View Clients</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInput}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              data-testid="input-search"
            />
          </View>
        </View>
        
        <View style={styles.filterContainer}>
          {(['all', 'jobs', 'customers', 'team'] as FilterType[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, activeFilter === filter && styles.filterButtonActive]}
              onPress={() => setActiveFilter(filter)}
              data-testid={`filter-${filter}`}
            >
              <Text style={[
                styles.filterButtonText,
                activeFilter === filter && styles.filterButtonTextActive
              ]}>
                {filter === 'all' ? 'All' : filter === 'jobs' ? 'Jobs' : filter === 'customers' ? 'Customers' : 'Team'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <ScrollView
          style={styles.conversationsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Feather name="message-circle" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyStateTitle}>
                {activeFilter === 'customers' ? 'No customer conversations' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptyStateText}>
                {activeFilter === 'customers' 
                  ? twilioConnected 
                    ? 'Start messaging clients by sending them job updates via SMS.'
                    : 'Set up Twilio to send SMS messages to your clients about their jobs.'
                  : 'Create jobs to start job discussions, or use Team Chat to coordinate with your crew.'
                }
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {activeFilter === 'all' ? 'All Conversations' : 
                   activeFilter === 'jobs' ? 'Job Discussions' : 
                   activeFilter === 'customers' ? 'Customer SMS' : 'Team'}
                </Text>
              </View>
              {conversations.map(renderConversation)}
              <View style={{ height: 100 }} />
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
