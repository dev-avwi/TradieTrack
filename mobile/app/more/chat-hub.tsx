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

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
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
  clientId?: string;
}

interface ConversationItem {
  id: string;
  type: 'team' | 'client' | 'job';
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

type FilterType = 'all' | 'team' | 'clients' | 'jobs';

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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  infoBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 16,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
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
  filterWrapper: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.muted,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: {
    backgroundColor: colors.primaryForeground,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterBadgeTextActive: {
    color: colors.primary,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '600',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  contactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.muted,
    gap: 4,
  },
  contactActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
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
    paddingHorizontal: 32,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [teamRes, clientsRes, jobsRes, membersRes] = await Promise.all([
        api.get('/api/team-chat').catch(() => ({ data: [] })),
        api.get('/api/clients').catch(() => ({ data: [] })),
        api.get('/api/jobs').catch(() => ({ data: [] })),
        api.get('/api/team/members').catch(() => ({ data: [] }))
      ]);
      
      setTeamMessages(Array.isArray(teamRes.data) ? teamRes.data : []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
      setTeamMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const openSMS = (phone: string, clientName: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', `${clientName} doesn't have a phone number on file.`);
      return;
    }
    Linking.openURL(`sms:${phone}`);
  };

  const openCall = (phone: string, clientName: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', `${clientName} doesn't have a phone number on file.`);
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const openEmail = (email: string, clientName: string) => {
    if (!email) {
      Alert.alert('No Email', `${clientName} doesn't have an email on file.`);
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  const getIcon = (type: 'team' | 'client' | 'job') => {
    switch (type) {
      case 'team':
        return <Feather name="users" size={20} color={colors.info} />;
      case 'client':
        return <Feather name="user" size={20} color={colors.success} />;
      case 'job':
        return <Feather name="briefcase" size={20} color={colors.warning} />;
    }
  };

  const getIconBg = (type: 'team' | 'client' | 'job') => {
    switch (type) {
      case 'team':
        return colors.infoLight;
      case 'client':
        return colors.successLight;
      case 'job':
        return colors.warningLight;
    }
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
        subtitle: `${activeMembers.length + 1} team members`,
        avatarFallback: 'TC',
        lastMessage: lastTeamMsg?.message || 'In-app team discussion',
        lastMessageTime: lastTeamMsg?.createdAt,
        unreadCount: 0,
        data: null,
      });
    }

    if (filter === 'all' || filter === 'clients') {
      const recentClients = clients.slice(0, 10);
      recentClients.forEach(client => {
        items.push({
          id: `client-${client.id}`,
          type: 'client',
          title: `${client.firstName} ${client.lastName}`,
          subtitle: client.phone || client.email || 'No contact info',
          avatarFallback: `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase(),
          phone: client.phone,
          email: client.email,
          unreadCount: 0,
          data: client,
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
          subtitle: job.address?.split(',')[0] || 'Job discussion',
          avatarFallback: job.title[0]?.toUpperCase() || 'J',
          status: job.status,
          unreadCount: 0,
          data: job,
        });
      });
    }

    return items;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } else if (diffHours < 168) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const handleConversationPress = (item: ConversationItem) => {
    if (item.type === 'team') {
      router.push('/more/team-chat');
    } else if (item.type === 'job') {
      router.push(`/job/${item.data.id}`);
    } else if (item.type === 'client') {
      router.push(`/client/${item.data.id}` as any);
    }
  };

  const conversationList = buildConversationList();
  const totalUnread = conversationList.reduce((sum, c) => sum + c.unreadCount, 0);

  const filteredList = conversationList.filter(item => {
    if (!searchTerm) return true;
    return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           item.subtitle?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Communications' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={22} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Communications Hub</Text>
            <Text style={styles.headerSubtitle}>Contact clients & team members</Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Feather name="info" size={14} color="#fff" />
          </View>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>How client messaging works</Text>
            <Text style={styles.infoBannerText}>
              Tap a client to view their details. Use the Call, SMS or Email buttons to contact them using your phone's built-in apps.
            </Text>
          </View>
        </View>

        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={[styles.quickActionButton, styles.quickActionButtonPrimary]}
            onPress={() => router.push('/more/clients')}
          >
            <Feather name="users" size={18} color={colors.primaryForeground} />
            <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>All Clients</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickActionButton, styles.quickActionButtonSecondary]}
            onPress={() => router.push('/more/team-chat')}
          >
            <Feather name="message-square" size={18} color={colors.foreground} />
            <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Team Chat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients, team, jobs..."
            placeholderTextColor={colors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterWrapper}>
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
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter('clients')}
              style={[styles.filterChip, filter === 'clients' && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Feather name="user" size={14} color={filter === 'clients' ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.filterChipText, filter === 'clients' && styles.filterChipTextActive]}>
                Clients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter('team')}
              style={[styles.filterChip, filter === 'team' && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Feather name="users" size={14} color={filter === 'team' ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.filterChipText, filter === 'team' && styles.filterChipTextActive]}>
                Team
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter('jobs')}
              style={[styles.filterChip, filter === 'jobs' && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Feather name="briefcase" size={14} color={filter === 'jobs' ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.filterChipText, filter === 'jobs' && styles.filterChipTextActive]}>
                Jobs
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

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
          ) : filteredList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm ? 'Try a different search term' : 'Add clients to start communicating'}
              </Text>
            </View>
          ) : (
            filteredList.map((item) => (
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
                      {item.lastMessage || item.subtitle || ''}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>

                  {item.type === 'client' && (item.phone || item.email) && (
                    <View style={styles.contactActions}>
                      {item.phone && (
                        <>
                          <TouchableOpacity 
                            style={styles.contactActionBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              openCall(item.phone!, item.title);
                            }}
                          >
                            <Feather name="phone" size={12} color={colors.success} />
                            <Text style={styles.contactActionText}>Call</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.contactActionBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              openSMS(item.phone!, item.title);
                            }}
                          >
                            <Feather name="message-square" size={12} color={colors.primary} />
                            <Text style={styles.contactActionText}>SMS</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {item.email && (
                        <TouchableOpacity 
                          style={styles.contactActionBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            openEmail(item.email!, item.title);
                          }}
                        >
                          <Feather name="mail" size={12} color={colors.info} />
                          <Text style={styles.contactActionText}>Email</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
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
