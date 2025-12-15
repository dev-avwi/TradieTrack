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
  RefreshControl,
  Alert
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface TeamChatMessage {
  id: string;
  businessOwnerId: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
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
  pinnedFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  pinnedFilterActive: {
    backgroundColor: colors.warning,
  },
  pinnedFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  pinnedFilterTextActive: {
    color: colors.primaryForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageBubbleContainerRight: {
    flexDirection: 'row-reverse',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageBubblePinned: {
    borderColor: colors.warning,
    borderWidth: 1,
  },
  messageBubbleAnnouncement: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.warning,
  },
  messageText: {
    fontSize: 15,
    color: colors.foreground,
    lineHeight: 20,
  },
  messageTextUser: {
    color: colors.primaryForeground,
  },
  messageTime: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeUser: {
    color: 'rgba(255,255,255,0.7)',
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
  headerButton: {
    padding: 8,
    marginRight: -8,
  },
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsMenu: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 8,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 15,
    color: colors.foreground,
  },
});

export default function TeamChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchMessages = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const response = await api.get('/api/team-chat');
      setMessages(response.data || []);
    } catch (error) {
      console.log('Failed to fetch team chat:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => fetchMessages(false), 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMessages(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    const text = messageText.trim();
    setMessageText('');

    try {
      await api.post('/api/team-chat', {
        message: text,
        messageType: 'text',
      });
      await fetchMessages(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handlePinMessage = async (messageId: string, pinned: boolean) => {
    try {
      await api.patch(`/api/team-chat/${messageId}/pin`, { pinned });
      await fetchMessages(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.delete(`/api/team-chat/${messageId}`);
      await fetchMessages(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message.');
    }
  };

  const pinnedMessages = messages.filter(m => m.isPinned);
  const displayMessages = showPinnedOnly ? pinnedMessages : messages;
  const isBusinessOwner = user && messages.length > 0 
    ? messages[0]?.businessOwnerId === user.id 
    : true;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Team Chat',
          headerRight: () => (
            <TouchableOpacity onPress={() => fetchMessages(false)} style={styles.headerButton}>
              <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          )
        }} 
      />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="users" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Team Chat</Text>
            <Text style={styles.headerSubtitle}>
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </Text>
          </View>
          {pinnedMessages.length > 0 && (
            <TouchableOpacity
              style={[
                styles.pinnedFilter,
                showPinnedOnly && styles.pinnedFilterActive
              ]}
              onPress={() => setShowPinnedOnly(!showPinnedOnly)}
            >
              <Feather name="bookmark" size={14} color={showPinnedOnly ? colors.primaryForeground : colors.warning} />
              <Text style={[
                styles.pinnedFilterText,
                showPinnedOnly && styles.pinnedFilterTextActive
              ]}>
                {pinnedMessages.length}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : displayMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {showPinnedOnly ? 'No pinned messages' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {showPinnedOnly 
                  ? 'Pin important messages to see them here' 
                  : 'Start chatting with your team'}
              </Text>
            </View>
          ) : (
            displayMessages.map((msg) => {
              const isCurrentUser = user ? msg.senderId === user.id : false;
              return (
                <View 
                  key={msg.id}
                  style={[
                    styles.messageBubbleContainer,
                    isCurrentUser && styles.messageBubbleContainerRight
                  ]}
                >
                  {!isCurrentUser && (
                    <View style={styles.avatarSmall}>
                      <Text style={styles.avatarSmallText}>{getInitials(msg.senderName)}</Text>
                    </View>
                  )}
                  
                  <View style={[
                    styles.messageBubble,
                    isCurrentUser ? styles.messageBubbleUser : styles.messageBubbleOther,
                    msg.isPinned && styles.messageBubblePinned,
                    msg.isAnnouncement && styles.messageBubbleAnnouncement
                  ]}>
                    {!isCurrentUser && (
                      <Text style={styles.senderName}>{msg.senderName}</Text>
                    )}
                    
                    {msg.isPinned && (
                      <View style={styles.pinnedBadge}>
                        <Feather name="bookmark" size={10} color={colors.warning} />
                        <Text style={styles.pinnedBadgeText}>Pinned</Text>
                      </View>
                    )}
                    
                    <Text style={[
                      styles.messageText,
                      isCurrentUser && styles.messageTextUser
                    ]}>
                      {msg.message}
                    </Text>
                    
                    <Text style={[
                      styles.messageTime,
                      isCurrentUser && styles.messageTimeUser
                    ]}>
                      {formatTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Message your team..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            multiline
            maxLength={1000}
            editable={!isSending}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSending}
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={20} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
