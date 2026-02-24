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
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles } from '../../src/lib/design-tokens';
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

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  createdAt: string;
  fromNumber?: string;
  toNumber?: string;
}

interface SmsConversation {
  id: string;
  clientId: string | null;
  clientPhone: string;
  clientName: string | null;
  jobId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  messages?: SmsMessage[];
}

interface UnreadCounts {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  sms: number;
  total: number;
}

interface TwilioStatus {
  enabled: boolean;
  phoneNumber: string | null;
}

interface DirectMessageConversation {
  otherUser: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  };
  lastMessage?: {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    createdAt: string;
  };
  unreadCount: number;
}

interface TeamMember {
  id: string;
  userId: string;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string | null;
  role: string;
  profileImageUrl?: string | null;
  status?: string;
  inviteStatus?: string;
}

interface ConversationItem {
  id: string;
  type: 'job' | 'team' | 'client' | 'sms' | 'direct' | 'member';
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

type FilterType = 'jobs' | 'enquiries' | 'team';

const JOB_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'invoiced', label: 'Invoiced' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.sm,
    minHeight: sizes.quickActionBtn,
  },
  quickActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  quickActionButtonSecondary: {
    backgroundColor: colors.muted,
  },
  quickActionButtonSuccess: {
    backgroundColor: colors.success || '#22c55e',
  },
  quickActionText: {
    ...typography.button,
  },
  quickActionTextPrimary: {
    color: colors.primaryForeground,
  },
  quickActionTextSecondary: {
    color: colors.foreground,
  },
  quickActionTextSuccess: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius['2xl'],
    height: sizes.searchBarHeight,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  searchTextInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    minHeight: sizes.filterChipHeight,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  filterButtonTextActive: {
    color: colors.primaryForeground,
  },
  filterBadge: {
    backgroundColor: colors.destructive || '#ef4444',
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: 0,
    marginBottom: 0,
    gap: spacing.sm,
  },
  subFilterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  subFilterButtonActive: {
    backgroundColor: colors.muted,
  },
  subFilterText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  subFilterTextActive: {
    color: colors.foreground,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: pageShell.paddingHorizontal,
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  conversationsList: {
    flex: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: pageShell.paddingHorizontal,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  conversationAvatarDirect: {
    backgroundColor: '#E9D5FF',
  },
  conversationAvatarMember: {
    backgroundColor: colors.muted,
  },
  conversationAvatarText: {
    ...typography.button,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: spacing.sm,
  },
  conversationTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
  },
  conversationTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  conversationSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  conversationLastMessage: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  conversationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.badge,
    textTransform: 'uppercase',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    ...typography.badge,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  contactActionText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  chevronIcon: {
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyStateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  twilioSetupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    marginHorizontal: pageShell.paddingHorizontal,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    gap: spacing.sm,
    ...shadows.sm,
    marginTop: spacing.sm,
  },
  twilioSetupIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twilioSetupContent: {
    flex: 1,
  },
  twilioSetupTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  twilioSetupDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  twilioSetupButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
  },
  twilioSetupButtonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  twilioConnectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    marginHorizontal: pageShell.paddingHorizontal,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    gap: spacing.sm,
    ...shadows.sm,
  },
  twilioConnectedIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twilioConnectedText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.success,
    flex: 1,
  },
  smsConversationAvatar: {
    backgroundColor: colors.successLight,
  },
  smsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.successLight,
  },
  smsBadgeText: {
    ...typography.badge,
    color: colors.success,
  },
});

export default function ChatHubScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('jobs');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [smsConversations, setSmsConversations] = useState<SmsConversation[]>([]);
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts | null>(null);
  const [dmConversations, setDmConversations] = useState<DirectMessageConversation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, clientsRes, smsRes, twilioRes, unreadRes, dmRes, teamRes] = await Promise.all([
        api.get<Job[]>('/api/jobs'),
        api.get<Client[]>('/api/clients'),
        api.get<SmsConversation[]>('/api/sms/conversations').catch(() => ({ data: [] })),
        api.get<TwilioStatus>('/api/sms/status').catch(() => ({ data: null })),
        api.get<UnreadCounts>('/api/chat/unread-counts').catch(() => ({ data: null })),
        api.get<DirectMessageConversation[]>('/api/direct-messages/conversations').catch(() => ({ data: [] })),
        api.get<TeamMember[]>('/api/team/members').catch(() => ({ data: [] })),
      ]);
      setJobs(jobsRes.data || []);
      setClients(clientsRes.data || []);
      setSmsConversations(smsRes.data || []);
      setTwilioStatus(twilioRes.data || null);
      setUnreadCounts(unreadRes.data || null);
      setDmConversations(dmRes.data || []);
      setTeamMembers(teamRes.data || []);
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

  const getUserDisplayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null; name?: string }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    if (user.name) return user.name;
    return user.email || 'Unknown';
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const twilioConnected = twilioStatus?.enabled === true && !!twilioStatus?.phoneNumber;

  const jobSmsMap = useMemo(() => {
    const byJobId = new Map<string, SmsConversation>();
    const byClientId = new Map<string, SmsConversation>();
    smsConversations.forEach(sms => {
      if (sms.jobId) byJobId.set(sms.jobId, sms);
      if (sms.clientId) byClientId.set(sms.clientId, sms);
    });
    return { byJobId, byClientId };
  }, [smsConversations]);

  const getSmsForJob = (job: Job) => {
    return jobSmsMap.byJobId.get(job.id) || (job.clientId ? jobSmsMap.byClientId.get(job.clientId) : undefined) || null;
  };

  const clientsWithJobs = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(job => { if (job.clientId) set.add(job.clientId); });
    return set;
  }, [jobs]);

  const jobIdsWithSms = useMemo(() => {
    const set = new Set<string>();
    smsConversations.forEach(sms => { if (sms.jobId) set.add(sms.jobId); });
    return set;
  }, [smsConversations]);

  const enquiriesUnreadCount = useMemo(() => {
    return smsConversations
      .filter(sms => {
        const hasJob = sms.jobId || (sms.clientId && clientsWithJobs.has(sms.clientId));
        return !hasJob;
      })
      .reduce((sum, sms) => sum + (sms.unreadCount || 0), 0);
  }, [smsConversations, clientsWithJobs]);

  const isAcceptedMember = (m: TeamMember) => m.inviteStatus === 'accepted' || m.status === 'accepted';

  const conversations: ConversationItem[] = useMemo(() => {
    const items: ConversationItem[] = [];
    
    if (activeFilter === 'jobs') {
      let filteredJobs = jobs;
      if (jobStatusFilter !== 'all') {
        filteredJobs = jobs.filter(job => job.status === jobStatusFilter);
      }
      
      filteredJobs.forEach(job => {
        const clientName = getClientName(job.clientId);
        const linkedSms = getSmsForJob(job);
        const smsUnread = linkedSms?.unreadCount || 0;

        let lastMessage = 'No messages yet';
        if (linkedSms?.messages && linkedSms.messages.length > 0) {
          const lastMsg = linkedSms.messages[linkedSms.messages.length - 1];
          lastMessage = (lastMsg.direction === 'outbound' ? 'You: ' : '') + lastMsg.body;
        } else if (clientName) {
          lastMessage = `${clientName} - ${(job.status || 'pending').replace('_', ' ')}`;
        }

        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: clientName || job.address || 'No client assigned',
          avatarFallback: job.title.substring(0, 2).toUpperCase(),
          lastMessage,
          lastMessageTime: linkedSms?.lastMessageAt || undefined,
          unreadCount: smsUnread,
          status: job.status,
          data: { ...job, linkedSms },
        });
      });
    }
    
    if (activeFilter === 'enquiries') {
      const unassignedSms = smsConversations.filter(sms => {
        const hasJob = sms.jobId || (sms.clientId && clientsWithJobs.has(sms.clientId));
        return !hasJob;
      });
      unassignedSms.forEach(sms => {
        const displayName = sms.clientName || sms.clientPhone;
        const lastMsg = sms.messages && sms.messages.length > 0
          ? sms.messages[sms.messages.length - 1]
          : null;
        const lastMessageText = lastMsg
          ? (lastMsg.direction === 'outbound' ? 'You: ' : '') + lastMsg.body
          : 'No messages yet';
        items.push({
          id: `sms-${sms.id}`,
          type: 'sms',
          title: displayName,
          subtitle: 'New enquiry',
          avatarFallback: displayName.substring(0, 2).toUpperCase(),
          lastMessage: lastMessageText,
          lastMessageTime: lastMsg?.createdAt || sms.lastMessageAt || undefined,
          unreadCount: sms.unreadCount || 0,
          phone: sms.clientPhone,
          data: sms,
        });
      });
    }
    
    if (activeFilter === 'team') {
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: 'General team discussion',
        avatarFallback: 'TC',
        lastMessage: 'Tap to join team chat',
        unreadCount: (unreadCounts?.teamChat || 0),
        data: null,
      });

      dmConversations.forEach(dm => {
        const name = getUserDisplayName(dm.otherUser);
        items.push({
          id: `dm-${dm.otherUser.id}`,
          type: 'direct',
          title: name,
          subtitle: dm.otherUser.email || undefined,
          avatarFallback: getInitials(name),
          lastMessage: dm.lastMessage?.content || 'No messages yet',
          lastMessageTime: dm.lastMessage?.createdAt || undefined,
          unreadCount: dm.unreadCount || 0,
          data: dm,
        });
      });

      const existingDmUserIds = new Set(dmConversations.map(dm => dm.otherUser.id));
      teamMembers.filter(isAcceptedMember).forEach(member => {
        const memberUserId = member.userId || member.memberId || member.id;
        if (existingDmUserIds.has(memberUserId)) return;
        if (existingDmUserIds.has(member.id)) return;

        const name = getUserDisplayName(member);
        items.push({
          id: `member-${member.id}`,
          type: 'member',
          title: name,
          subtitle: member.email || member.role || undefined,
          avatarFallback: getInitials(name),
          lastMessage: 'Tap to start a conversation',
          unreadCount: 0,
          data: member,
        });
      });
    }

    items.sort((a, b) => {
      if ((a.type as string) === 'team') return -1;
      if ((b.type as string) === 'team') return 1;

      if ((a.type as string) === 'direct' && (b.type as string) !== 'direct' && (b.type as string) !== 'team') return -1;
      if ((b.type as string) === 'direct' && (a.type as string) !== 'direct' && (a.type as string) !== 'team') return 1;

      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;

      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [jobs, clients, smsConversations, dmConversations, teamMembers, activeFilter, searchQuery, unreadCounts, jobStatusFilter]);

  const handleConversationPress = (item: ConversationItem) => {
    if (item.type === 'team') {
      router.push('/more/team-chat');
    } else if (item.type === 'job') {
      router.push(`/job/chat?jobId=${item.data.id}` as any);
    } else if (item.type === 'sms') {
      router.push(`/more/sms-conversation?id=${item.data.id}&phone=${encodeURIComponent(item.phone || '')}&name=${encodeURIComponent(item.title)}` as any);
    } else if (item.type === 'direct') {
      router.push(`/more/direct-messages?userId=${item.data.otherUser.id}` as any);
    } else if (item.type === 'member') {
      const memberUserId = item.data.userId || item.data.memberId || item.data.id;
      router.push(`/more/direct-messages?userId=${memberUserId}` as any);
    }
  };

  const handleSendSmsToClient = async (phone: string, clientName?: string, clientId?: string) => {
    const message = `Hi${clientName ? ` ${clientName}` : ''}, just reaching out regarding your service.`;
    try {
      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message,
        clientId,
      });
      if (response.error) {
        Alert.alert(
          'Send via SMS App?',
          'Could not send directly. Would you like to open your messaging app instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open SMS App',
              onPress: () => {
                Linking.openURL(`sms:${phone}`).catch(() => Alert.alert('Error', 'Could not open SMS app'));
              },
            },
          ]
        );
      } else {
        Alert.alert('SMS Sent', `Message sent to ${clientName || phone}`);
      }
    } catch {
      Alert.alert(
        'Send via SMS App?',
        'Could not send directly. Would you like to open your messaging app instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open SMS App',
            onPress: () => {
              Linking.openURL(`sms:${phone}`).catch(() => Alert.alert('Error', 'Could not open SMS app'));
            },
          },
        ]
      );
    }
  };

  const handleContactClient = (client: Client) => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    
    if (client.phone) {
      options.push({ text: 'Call', onPress: () => Linking.openURL(`tel:${client.phone}`) });
      options.push({ text: 'SMS', onPress: () => handleSendSmsToClient(client.phone!, client.firstName, client.id) });
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

  const getFilterUnreadCount = (filter: FilterType): number => {
    switch (filter) {
      case 'jobs':
        return unreadCounts?.jobChats || 0;
      case 'team':
        return (unreadCounts?.teamChat || 0) + (unreadCounts?.directMessages || 0);
      case 'enquiries':
        return enquiriesUnreadCount;
      default:
        return 0;
    }
  };

  const renderConversation = (item: ConversationItem) => {
    const statusColor = item.status ? getStatusColor(item.status) : null;
    const client = item.type === 'job' && item.data?.clientId ? getClient(item.data.clientId) : null;
    const linkedSms = item.type === 'job' ? item.data?.linkedSms : null;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.conversationAvatar,
          item.type === 'job' && styles.conversationAvatarJob,
          item.type === 'team' && styles.conversationAvatarTeam,
          item.type === 'client' && styles.conversationAvatarClient,
          item.type === 'sms' && styles.smsConversationAvatar,
          item.type === 'direct' && styles.conversationAvatarDirect,
          item.type === 'member' && styles.conversationAvatarMember,
        ]}>
          {item.type === 'job' ? (
            <Feather name="briefcase" size={20} color={colors.primary} />
          ) : item.type === 'team' ? (
            <Feather name="users" size={20} color={colors.info} />
          ) : item.type === 'sms' ? (
            <Feather name="smartphone" size={20} color={colors.success} />
          ) : item.type === 'direct' ? (
            <Feather name="message-square" size={20} color="#7C3AED" />
          ) : item.type === 'member' ? (
            <Feather name="user-plus" size={20} color={colors.mutedForeground} />
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

          {item.lastMessage && (
            <Text style={styles.conversationLastMessage} numberOfLines={1}>
              {item.lastMessage}
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
            {linkedSms && (
              <View style={styles.smsBadge}>
                <Feather name="smartphone" size={10} color={colors.success} />
                <Text style={styles.smsBadgeText}>SMS</Text>
              </View>
            )}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          
        </View>
        
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.chevronIcon} />
      </TouchableOpacity>
    );
  };

  const renderTwilioBanner = () => {
    if (twilioStatus === null) return null;

    if (twilioConnected) {
      return (
        <View style={styles.twilioConnectedBanner}>
          <View style={styles.twilioConnectedIcon}>
            <Feather name="check" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.twilioConnectedText}>
            SMS connected: {twilioStatus.phoneNumber}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.twilioSetupBanner}>
        <View style={styles.twilioSetupIcon}>
          <Feather name="alert-triangle" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.twilioSetupContent}>
          <Text style={styles.twilioSetupTitle}>SMS Not Connected</Text>
          <Text style={styles.twilioSetupDescription}>
            Set up Twilio to send and receive SMS messages
          </Text>
        </View>
        <TouchableOpacity
          style={styles.twilioSetupButton}
          onPress={() => router.push('/more/settings' as any)}
        >
          <Text style={styles.twilioSetupButtonText}>Set Up</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getEmptyStateMessage = () => {
    switch (activeFilter) {
      case 'enquiries':
        return {
          title: 'No enquiries yet',
          text: 'New SMS conversations that aren\'t linked to a job will appear here.',
        };
      case 'team':
        return {
          title: 'No team conversations',
          text: 'Use Team Chat to coordinate with your crew, or start a direct message.',
        };
      case 'jobs':
      default:
        return {
          title: 'No job conversations yet',
          text: 'Create jobs to start job discussions and communicate with clients.',
        };
    }
  };

  const getSectionTitle = () => {
    switch (activeFilter) {
      case 'jobs': return 'JOB CONVERSATIONS';
      case 'enquiries': return 'SMS ENQUIRIES';
      case 'team': return 'TEAM & DIRECT MESSAGES';
      default: return 'CONVERSATIONS';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Chat Hub</Text>
          <Text style={styles.headerSubtitle}>Messages, SMS & team chat for your jobs</Text>
        </View>

        {renderTwilioBanner()}
        
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionButtonPrimary]}
            onPress={() => router.push('/more/team-chat')}
          >
            <Feather name="users" size={18} color={colors.primaryForeground} />
            <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>Team Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionButtonSuccess]}
            onPress={() => router.push('/more/new-sms-conversation' as any)}
          >
            <Feather name="edit-3" size={18} color="#FFFFFF" />
            <Text style={[styles.quickActionText, styles.quickActionTextSuccess]}>New SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionButtonSecondary]}
            onPress={() => router.push('/more/clients')}
          >
            <Feather name="user" size={18} color={colors.foreground} />
            <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Clients</Text>
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
            />
          </View>
        </View>
        
        <View style={styles.filterContainer}>
          {(['jobs', 'team', 'enquiries'] as FilterType[]).map((filter) => {
            const count = getFilterUnreadCount(filter);
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterButton, isActive && styles.filterButtonActive]}
                onPress={() => {
                  setActiveFilter(filter);
                  if (filter !== 'jobs') setJobStatusFilter('all');
                }}
              >
                <Text style={[
                  styles.filterButtonText,
                  isActive && styles.filterButtonTextActive
                ]}>
                  {filter === 'jobs' ? 'Jobs' : filter === 'team' ? 'Team' : 'Enquiries'}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={styles.filterBadgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeFilter === 'jobs' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subFilterContainer}
            contentContainerStyle={{ gap: spacing.xs }}
          >
            {JOB_STATUS_FILTERS.map(sf => (
              <TouchableOpacity
                key={sf.key}
                style={[
                  styles.subFilterButton,
                  jobStatusFilter === sf.key && styles.subFilterButtonActive,
                ]}
                onPress={() => setJobStatusFilter(sf.key)}
              >
                <Text style={[
                  styles.subFilterText,
                  jobStatusFilter === sf.key && styles.subFilterTextActive,
                ]}>
                  {sf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        
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
                <Feather name="message-circle" size={16} color={colors.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>
                {getEmptyStateMessage().title}
              </Text>
              <Text style={styles.emptyStateText}>
                {getEmptyStateMessage().text}
              </Text>
            </View>
          ) : (
            <>
              {conversations.map(renderConversation)}
              <View style={{ height: 100, paddingBottom: 100 }} />
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
