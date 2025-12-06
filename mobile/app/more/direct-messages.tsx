import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  otherUser: User;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

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
    marginVertical: 12,
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
  listContainer: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  conversationName: {
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
  conversationLastMessage: {
    fontSize: 14,
    color: colors.mutedForeground,
    flex: 1,
  },
  memberEmail: {
    fontSize: 14,
    color: colors.mutedForeground,
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
  sectionDivider: {
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionDividerText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
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
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  chatHeaderEmail: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    marginBottom: 12,
  },
  messageBubbleWrapperLeft: {
    alignItems: 'flex-start',
  },
  messageBubbleWrapperRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.foreground,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
});

export default function DirectMessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { user: currentUser } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [conversationsRes, teamRes] = await Promise.all([
        api.get('/api/direct-messages/conversations'),
        api.get('/api/team/members')
      ]);
      setConversations(conversationsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      console.log('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown User';
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
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

  if (selectedUser) {
    return (
      <ChatView 
        selectedUser={selectedUser} 
        onBack={() => {
          setSelectedUser(null);
          fetchData();
        }}
        colors={colors}
        styles={styles}
        currentUser={currentUser}
      />
    );
  }

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getUserDisplayName(conv.otherUser).toLowerCase();
    const email = (conv.otherUser.email || '').toLowerCase();
    const term = searchQuery.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const existingIds = new Set(conversations.map(c => c.otherUser.id));
  const availableNewContacts = teamMembers.filter(m => {
    if (existingIds.has(m.id)) return false;
    if (!searchQuery) return true;
    const name = getUserDisplayName(m).toLowerCase();
    const email = (m.email || '').toLowerCase();
    const term = searchQuery.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Direct Messages' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-square" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Direct Messages</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search team members..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
          ) : filteredConversations.length === 0 && availableNewContacts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No team members</Text>
              <Text style={styles.emptySubtitle}>Add team members first to start messaging</Text>
            </View>
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <TouchableOpacity 
                  key={conversation.otherUser.id}
                  style={styles.conversationItem} 
                  onPress={() => setSelectedUser(conversation.otherUser)} 
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { width: 44, height: 44, borderRadius: 22 }]}>
                    <Text style={[styles.avatarText, { fontSize: 18 }]}>
                      {getInitials(conversation.otherUser)}
                    </Text>
                  </View>
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName} numberOfLines={1}>
                        {getUserDisplayName(conversation.otherUser)}
                      </Text>
                      {conversation.lastMessage && (
                        <Text style={styles.conversationTime}>
                          {formatTime(conversation.lastMessage.createdAt)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.conversationPreview}>
                      <Text style={styles.conversationLastMessage} numberOfLines={1}>
                        {conversation.lastMessage?.content || 'No messages yet'}
                      </Text>
                      {conversation.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              {availableNewContacts.length > 0 && (
                <>
                  <View style={styles.sectionDivider}>
                    <Text style={styles.sectionDividerText}>Start New Conversation</Text>
                  </View>
                  {availableNewContacts.map((member) => (
                    <TouchableOpacity 
                      key={member.id}
                      style={styles.conversationItem} 
                      onPress={() => setSelectedUser(member)} 
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatar, { width: 44, height: 44, borderRadius: 22 }]}>
                        <Text style={[styles.avatarText, { fontSize: 18 }]}>
                          {getInitials(member)}
                        </Text>
                      </View>
                      <View style={styles.conversationContent}>
                        <Text style={styles.conversationName} numberOfLines={1}>
                          {getUserDisplayName(member)}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {member.email}
                        </Text>
                      </View>
                      <Feather name="message-square" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function ChatView({ 
  selectedUser, 
  onBack,
  colors,
  styles,
  currentUser
}: { 
  selectedUser: User; 
  onBack: () => void;
  colors: any;
  styles: any;
  currentUser: any;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await api.get(`/api/direct-messages/${selectedUser.id}`);
      setMessages(response.data || []);
    } catch (error) {
      console.log('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser.id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => fetchMessages(), 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await api.post(`/api/direct-messages/${selectedUser.id}`, { content: text });
      await fetchMessages();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      setNewMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown User';
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20 }]}>
          <Text style={[styles.avatarText, { fontSize: 16 }]}>
            {getInitials(selectedUser)}
          </Text>
        </View>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{getUserDisplayName(selectedUser)}</Text>
          <Text style={styles.chatHeaderEmail} numberOfLines={1}>{selectedUser.email}</Text>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Feather name="message-square" size={48} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Start the conversation!</Text>
          </View>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId !== selectedUser.id;
            return (
              <View 
                key={message.id}
                style={[
                  styles.messageBubbleWrapper,
                  isOwn ? styles.messageBubbleWrapperRight : styles.messageBubbleWrapperLeft
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
                ]}>
                  <Text style={[
                    styles.messageText,
                    isOwn && styles.messageTextOwn
                  ]}>
                    {message.content}
                  </Text>
                  <Text style={[
                    styles.messageTime,
                    isOwn && styles.messageTimeOwn
                  ]}>
                    {formatTime(message.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          multiline
          maxLength={1000}
          editable={!isSending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!newMessage.trim() || isSending}
          style={[
            styles.sendButton,
            (!newMessage.trim() || isSending) && styles.sendButtonDisabled
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
