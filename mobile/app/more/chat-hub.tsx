import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface TeamChatMessage {
  id: string;
  message: string;
  createdAt: string;
  senderName: string;
}

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface Conversation {
  otherUser: User;
  lastMessage?: { content: string; createdAt: string };
  unreadCount: number;
}

interface Job {
  id: string;
  title: string;
  status: string;
  address?: string;
}

interface ConversationItem {
  id: string;
  type: 'team' | 'direct' | 'job';
  title: string;
  subtitle?: string;
  avatarFallback: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  status?: string;
  data: any;
}

type FilterType = 'all' | 'team' | 'direct' | 'jobs';

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 42,
    marginLeft: 10,
    fontSize: 15,
    color: colors.foreground,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: colors.muted,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    marginLeft: 8,
  },
  conversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationMessage: {
    fontSize: 14,
    color: colors.mutedForeground,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

export default function ChatHubScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([]);
  const [dmConversations, setDmConversations] = useState<Conversation[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [teamRes, dmRes, jobsRes, membersRes] = await Promise.all([
        api.get('/api/team-chat').catch(() => ({ data: [] })),
        api.get('/api/direct-messages/conversations').catch(() => ({ data: [] })),
        api.get('/api/jobs').catch(() => ({ data: [] })),
        api.get('/api/team/members').catch(() => ({ data: [] }))
      ]);
      
      setTeamMessages(teamRes.data || []);
      setDmConversations(dmRes.data || []);
      setJobs(jobsRes.data || []);
      setTeamMembers(membersRes.data || []);
    } catch (error) {
      console.log('Failed to fetch chat data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown';
  };

  const buildConversationList = (): ConversationItem[] => {
    const items: ConversationItem[] = [];
    const activeMembers = teamMembers.filter((m: any) => m.status === 'accepted');

    if (filter === 'all' || filter === 'team') {
      const lastTeamMsg = teamMessages[teamMessages.length - 1];
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: `${activeMembers.length + 1} members`,
        avatarFallback: 'TC',
        lastMessage: lastTeamMsg?.message,
        lastMessageTime: lastTeamMsg?.createdAt,
        unreadCount: 0,
        data: null,
      });
    }

    if (filter === 'all' || filter === 'direct') {
      dmConversations.forEach(convo => {
        items.push({
          id: `dm-${convo.otherUser.id}`,
          type: 'direct',
          title: getUserDisplayName(convo.otherUser),
          subtitle: convo.otherUser.email || undefined,
          avatarFallback: getUserDisplayName(convo.otherUser)[0]?.toUpperCase() || '?',
          lastMessage: convo.lastMessage?.content,
          lastMessageTime: convo.lastMessage?.createdAt,
          unreadCount: convo.unreadCount,
          data: convo.otherUser,
        });
      });
    }

    if (filter === 'all' || filter === 'jobs') {
      const activeJobs = jobs.filter(j => 
        j.status !== 'done' && j.status !== 'invoiced'
      ).slice(0, 5);
      
      activeJobs.forEach(job => {
        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: job.address?.split(',')[0],
          avatarFallback: job.title[0]?.toUpperCase() || 'J',
          status: job.status,
          unreadCount: 0,
          data: job,
        });
      });
    }

    items.sort((a, b) => {
      if (a.id === 'team-chat') return -1;
      if (b.id === 'team-chat') return 1;
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.subtitle?.toLowerCase().includes(term)
      );
    }

    return items;
  };

  const handleConversationPress = (item: ConversationItem) => {
    if (item.type === 'team') {
      router.push('/more/team-chat');
    } else if (item.type === 'direct') {
      router.push('/more/direct-messages');
    } else if (item.type === 'job') {
      router.push(`/job/chat?jobId=${item.data.id}`);
    }
  };

  const conversationList = buildConversationList();
  const totalUnread = dmConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'team':
        return <Feather name="users" size={20} color={colors.primary} />;
      case 'direct':
        return <Feather name="mail" size={20} color={colors.info} />;
      case 'job':
        return <Feather name="briefcase" size={20} color={colors.warning} />;
    }
    return null;
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'team':
        return colors.primaryLight;
      case 'direct':
        return colors.infoLight;
      case 'job':
        return colors.warningLight;
    }
    return colors.muted;
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Messages' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>Stay connected with your team</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
            {totalUnread > 0 && (
              <View style={[styles.filterBadge, filter === 'all' && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === 'all' && styles.filterBadgeTextActive]}>
                  {totalUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('team')}
            style={[styles.filterChip, filter === 'team' && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Feather name="users" size={14} color={filter === 'team' ? '#FFFFFF' : colors.foreground} />
            <Text style={[styles.filterChipText, filter === 'team' && styles.filterChipTextActive]}>
              Team
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('direct')}
            style={[styles.filterChip, filter === 'direct' && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Feather name="mail" size={14} color={filter === 'direct' ? '#FFFFFF' : colors.foreground} />
            <Text style={[styles.filterChipText, filter === 'direct' && styles.filterChipTextActive]}>
              Direct
            </Text>
            {totalUnread > 0 && (
              <View style={[styles.filterBadge, filter === 'direct' && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === 'direct' && styles.filterBadgeTextActive]}>
                  {totalUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('jobs')}
            style={[styles.filterChip, filter === 'jobs' && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Feather name="briefcase" size={14} color={filter === 'jobs' ? '#FFFFFF' : colors.foreground} />
            <Text style={[styles.filterChipText, filter === 'jobs' && styles.filterChipTextActive]}>
              Jobs
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView 
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : conversationList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No conversations</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm ? 'Try a different search term' : 'Start chatting with your team'}
              </Text>
            </View>
          ) : (
            conversationList.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={styles.conversationCard} 
                onPress={() => handleConversationPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.conversationAvatar, { backgroundColor: getIconBg(item.type) }]}>
                  {getIcon(item.type)}
                </View>
                
                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.lastMessageTime && (
                      <Text style={styles.conversationTime}>
                        {formatTime(item.lastMessageTime)}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.conversationPreview}>
                    <Text style={styles.conversationMessage} numberOfLines={1}>
                      {item.lastMessage || item.subtitle || 'No messages yet'}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}
