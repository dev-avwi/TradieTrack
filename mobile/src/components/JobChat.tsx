import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { format, isToday, isYesterday } from 'date-fns';

interface JobChatMessage {
  id: string;
  jobId: string;
  userId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isSystemMessage?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
}

interface JobChatParticipants {
  participants: Participant[];
  jobTitle: string;
  participantCount: number;
}

interface JobChatProps {
  jobId: string;
  currentUserId: string;
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday ' + format(date, 'h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function JobChat({ jobId, currentUserId }: JobChatProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [messages, setMessages] = useState<JobChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [jobId]);

  const loadData = async () => {
    await Promise.all([loadMessages(), loadParticipants()]);
  };

  const loadMessages = async () => {
    try {
      setError(null);
      const response = await api.get(`/api/jobs/${jobId}/chat`);
      setMessages(response.data || []);
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
      if (!isRefreshing && isLoading) {
        setError('Failed to load messages');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const response = await api.get(`/api/jobs/${jobId}/chat/participants`);
      setParticipants(response.data?.participants || []);
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    
    const optimisticMessage: JobChatMessage = {
      id: `temp-${Date.now()}`,
      jobId,
      userId: currentUserId,
      message: messageText,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      senderName: 'You',
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      setIsSending(true);
      await api.post(`/api/jobs/${jobId}/chat`, {
        message: messageText,
        messageType: 'text',
      });
      await loadMessages();
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageText);
      Alert.alert('Send Failed', 'Unable to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/jobs/${jobId}/chat/${messageId}`);
              setMessages(prev => prev.filter(m => m.id !== messageId));
              Alert.alert('Deleted', 'Message deleted successfully');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.subtitle,
      color: colors.foreground,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    participantsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: `${colors.muted}50`,
    },
    participantsLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginRight: spacing.sm,
    },
    participantAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    participantAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -6,
      borderWidth: 2,
      borderColor: colors.card,
    },
    participantAvatarFirst: {
      marginLeft: 0,
    },
    participantAvatarText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    moreParticipants: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginLeft: spacing.sm,
    },
    messageBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    messageBadgeText: {
      ...typography.caption,
      color: colors.primary,
    },
    content: {
      maxHeight: 300,
    },
    messagesList: {
      padding: spacing.sm,
    },
    messageContainer: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    ownMessage: {
      flexDirection: 'row-reverse',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '600',
    },
    messageBubble: {
      flex: 1,
      maxWidth: '80%',
      backgroundColor: colors.muted,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderTopLeftRadius: 4,
    },
    ownBubble: {
      backgroundColor: colors.primary,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: 4,
    },
    senderName: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 2,
    },
    ownSenderName: {
      color: colors.primaryForeground,
    },
    messageText: {
      ...typography.body,
      color: colors.foreground,
    },
    ownMessageText: {
      color: colors.primaryForeground,
    },
    messageTime: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
      fontSize: 10,
    },
    ownMessageTime: {
      color: `${colors.primaryForeground}80`,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
    },
    emptySubtext: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    errorContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    errorText: {
      ...typography.body,
      color: colors.destructive,
      marginTop: spacing.sm,
    },
    retryButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    retryButtonText: {
      ...typography.body,
      color: colors.primaryForeground,
      fontWeight: '600',
    },
    composerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: colors.foreground,
      maxHeight: 100,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.muted,
    },
  });

  const renderMessage = ({ item }: { item: JobChatMessage }) => {
    const isOwn = item.userId === currentUserId;
    const isTemp = item.id.startsWith('temp-');
    
    return (
      <TouchableOpacity 
        style={[styles.messageContainer, isOwn && styles.ownMessage]}
        onLongPress={() => isOwn && !isTemp && deleteMessage(item.id)}
        delayLongPress={500}
      >
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.senderName)}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwn && styles.ownBubble, isTemp && { opacity: 0.6 }]}>
          {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {isTemp ? 'Sending...' : formatMessageTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderParticipants = () => {
    if (participants.length === 0) return null;
    
    const displayParticipants = participants.slice(0, 4);
    const remaining = participants.length - 4;
    
    return (
      <View style={styles.participantsRow}>
        <Feather name="users" size={14} color={colors.mutedForeground} />
        <Text style={[styles.participantsLabel, { marginLeft: spacing.xs }]}>
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'}:
        </Text>
        <View style={styles.participantAvatars}>
          {displayParticipants.map((p, idx) => (
            <View 
              key={p.id} 
              style={[styles.participantAvatar, idx === 0 && styles.participantAvatarFirst]}
            >
              <Text style={styles.participantAvatarText}>{getInitials(p.name)}</Text>
            </View>
          ))}
        </View>
        {remaining > 0 && (
          <Text style={styles.moreParticipants}>+{remaining} more</Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="message-circle" size={18} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Job Discussion</Text>
          </View>
        </View>
        <View style={[styles.content, { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="message-circle" size={18} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Job Discussion</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.messageBadge}>
              <Text style={styles.messageBadgeText}>
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </Text>
            </View>
          </View>
        </View>

        {renderParticipants()}

        <View style={styles.content}>
          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={32} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={32} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start a discussion with your team about this job
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              }
            />
          )}
        </View>

        <View style={styles.composerContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Feather name="send" size={18} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
