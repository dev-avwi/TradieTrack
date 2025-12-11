import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

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

interface Job {
  id: string;
  title: string;
  status: string;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  messageBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  messageBadgeText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  participantsBanner: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.info + '20',
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  participantsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.info,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  participantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.info + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitials: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.info,
  },
  participantName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  participantRole: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  messagesContent: {
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.mutedForeground,
    opacity: 0.7,
  },
  messageRow: {
    marginBottom: spacing.md,
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignItems: 'flex-start',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.primaryForeground,
  },
  messageTextOther: {
    color: colors.foreground,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  messageTimeOwn: {
    color: colors.primaryForeground + '80',
    textAlign: 'right',
  },
  messageTimeOther: {
    color: colors.mutedForeground,
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginVertical: spacing.sm,
  },
  systemMessageText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
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

export default function JobChatScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<JobChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadJob(), loadMessages(), loadParticipants()]);
    setIsLoading(false);
  };

  const loadJob = async () => {
    try {
      const response = await api.get<Job>(`/api/jobs/${jobId}`);
      if (response.data) {
        setJob(response.data);
      }
    } catch (error) {
      console.error('Error loading job:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.get<JobChatMessage[]>(`/api/jobs/${jobId}/chat`);
      if (response.data) {
        setMessages(response.data);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const loadParticipants = async () => {
    try {
      const response = await api.get<{ participants: Participant[] }>(`/api/jobs/${jobId}/chat/participants`);
      if (response.data?.participants) {
        setParticipants(response.data.participants);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
      setParticipants([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      await api.post(`/api/jobs/${jobId}/chat`, {
        message: messageText.trim(),
        messageType: 'text',
      });
      setMessageText('');
      await loadMessages();
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' ' +
        date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (msg: JobChatMessage) => msg.userId === user?.id;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Job Chat' }} />
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: job?.title || 'Job Chat' }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Job Discussion</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{job?.title}</Text>
          </View>
          <View style={styles.messageBadge}>
            <Text style={styles.messageBadgeText}>
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </Text>
          </View>
        </View>

        {participants.length > 0 && (
          <View style={styles.participantsBanner}>
            <View style={styles.participantsHeader}>
              <Feather name="eye" size={14} color={colors.info} />
              <Text style={styles.participantsTitle}>Who can see these messages:</Text>
            </View>
            <View style={styles.participantsList}>
              {participants.map((p) => (
                <View key={p.id} style={styles.participantChip}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantInitials}>{getInitials(p.name)}</Text>
                  </View>
                  <Text style={styles.participantName}>{p.name.split(' ')[0]}</Text>
                  <Text style={styles.participantRole}>({p.role})</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color={colors.mutedForeground} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation about this job</Text>
            </View>
          ) : (
            messages.map((msg) => {
              if (msg.isSystemMessage) {
                return (
                  <View key={msg.id} style={styles.systemMessage}>
                    <Text style={styles.systemMessageText}>{msg.message}</Text>
                  </View>
                );
              }

              const own = isOwnMessage(msg);
              return (
                <View key={msg.id} style={[styles.messageRow, own ? styles.messageRowOwn : styles.messageRowOther]}>
                  {!own && <Text style={styles.messageSender}>{msg.senderName}</Text>}
                  <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
                    <Text style={[styles.messageText, own ? styles.messageTextOwn : styles.messageTextOther]}>
                      {msg.message}
                    </Text>
                    <Text style={[styles.messageTime, own ? styles.messageTimeOwn : styles.messageTimeOther]}>
                      {formatTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composerContainer}>
          <TextInput
            style={styles.composerInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim() || isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size={16} color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={18} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
