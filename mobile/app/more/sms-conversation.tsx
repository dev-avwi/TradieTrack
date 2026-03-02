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
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, sizes } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import api from '../../src/lib/api';

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

const QUICK_REPLY_TEMPLATES = [
  { id: 'omw', label: "On my way", icon: 'navigation' as const, message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
  { id: 'running-late', label: "Running late", icon: 'clock' as const, message: "Apologies, I'm running a bit behind schedule. Will be there as soon as I can - should only be another 15-20 minutes." },
  { id: 'job-done', label: "Job done", icon: 'check' as const, message: "All done! The job's been completed. Let me know if you have any questions or need anything else." },
  { id: 'quote-sent', label: "Quote sent", icon: 'file-text' as const, message: "I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead." },
  { id: 'confirm', label: "Confirm", icon: 'calendar' as const, message: "Just confirming our appointment. Please reply to let me know you're still available, or give us a bell if you need to reschedule." },
  { id: 'thanks', label: "Thanks", icon: 'heart' as const, message: "Thanks for your business mate! Really appreciate it. Don't hesitate to reach out if you need anything." },
];

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
    ...shadows.sm,
  },
  backButton: {
    width: sizes.inputHeightSm,
    height: sizes.inputHeightSm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerIconContainer: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  messageRow: {
    marginBottom: spacing.sm,
  },
  messageRowOutbound: {
    alignItems: 'flex-end',
  },
  messageRowInbound: {
    alignItems: 'flex-start',
  },
  messageLabel: {
    ...typography.badge,
    color: colors.mutedForeground,
    marginBottom: 2,
    marginLeft: spacing.xs,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
  },
  messageBubbleOutbound: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleInbound: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    fontSize: 14,
  },
  messageTextOutbound: {
    color: colors.primaryForeground,
  },
  messageTextInbound: {
    color: colors.foreground,
  },
  messageTime: {
    fontSize: 10,
    marginTop: spacing.xs,
  },
  messageTimeOutbound: {
    color: colors.primaryForeground + '80',
    textAlign: 'right',
  },
  messageTimeInbound: {
    color: colors.mutedForeground,
  },
  dateSeparator: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dateSeparatorText: {
    ...typography.badge,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  messageStatus: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'right',
  },
  composerContainer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  composerInputWrapper: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  composerInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    ...typography.body,
    color: colors.foreground,
    maxHeight: 100,
    minHeight: sizes.inputHeightSm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRepliesToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRepliesContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  quickRepliesScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    gap: 6,
  },
  quickReplyChipText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.foreground,
  },
});

export default function SmsConversationScreen() {
  const { id, phone, name } = useLocalSearchParams<{ id: string; phone: string; name: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const clientName = name ? decodeURIComponent(name) : 'Unknown';
  const clientPhone = phone ? decodeURIComponent(phone) : '';

  useEffect(() => {
    loadMessages();
    api.post(`/api/sms/conversations/${id}/read`).catch(() => {});
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const loadMessages = async () => {
    try {
      const response = await api.get<SmsMessage[]>(`/api/sms/conversations/${id}/messages`);
      if (response.data) {
        setMessages(response.data);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
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
      const response = await api.post('/api/sms/send', {
        clientPhone,
        message: messageText.trim(),
        conversationId: id,
      });
      if (response.error) {
        Alert.alert('Error', 'Failed to send SMS. Please try again.');
      } else {
        setMessageText('');
        await loadMessages();
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS. Please try again.');
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isIOS = Platform.OS === 'ios';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.headerCard}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.headerIconContainer}>
            <Feather name="smartphone" size={20} color={colors.success} />
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.headerSubtitle}>{clientPhone}</Text>
          </View>

          {clientPhone ? (
            <TouchableOpacity
              onPress={() => {
                const url = `tel:${clientPhone}`;
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }}
              style={{ padding: spacing.sm }}
            >
              <Feather name="phone" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={28} color={colors.success} />
              </View>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send an SMS to start the conversation</Text>
            </View>
          ) : (
            messages.map((msg, index) => {
              const isOutbound = msg.direction === 'outbound';
              const msgDate = new Date(msg.createdAt).toDateString();
              const prevDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
              const showDateSep = index === 0 || msgDate !== prevDate;
              
              return (
                <View key={msg.id}>
                  {showDateSep && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>
                        {new Date(msg.createdAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageRow,
                      isOutbound ? styles.messageRowOutbound : styles.messageRowInbound,
                    ]}
                  >
                    {!isOutbound && (
                      <Text style={styles.messageLabel}>{clientName}</Text>
                    )}
                    <View style={[
                      styles.messageBubble,
                      isOutbound ? styles.messageBubbleOutbound : styles.messageBubbleInbound,
                    ]}>
                      <Text style={[
                        styles.messageText,
                        isOutbound ? styles.messageTextOutbound : styles.messageTextInbound,
                      ]}>
                        {msg.body}
                      </Text>
                      <Text style={[
                        styles.messageTime,
                        isOutbound ? styles.messageTimeOutbound : styles.messageTimeInbound,
                      ]}>
                        {formatTime(msg.createdAt)}
                      </Text>
                    </View>
                    {isOutbound && msg.status && msg.status !== 'sent' && (
                      <Text style={styles.messageStatus}>{msg.status}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {showQuickReplies && (
          <View style={styles.quickRepliesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
              {QUICK_REPLY_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.quickReplyChip}
                  onPress={() => {
                    setMessageText(template.message);
                    setShowQuickReplies(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name={template.icon} size={14} color={colors.primary} />
                  <Text style={styles.quickReplyChipText}>{template.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.composerContainer, { paddingBottom: bottomNavHeight + spacing.xs }]}>
          <View style={styles.composerRow}>
            <TouchableOpacity
              style={styles.quickRepliesToggle}
              onPress={() => setShowQuickReplies(!showQuickReplies)}
            >
              <Feather name="zap" size={18} color={showQuickReplies ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
            <View style={styles.composerInputWrapper}>
              <TextInput
                style={styles.composerInput}
                placeholder="Type an SMS..."
                placeholderTextColor={colors.mutedForeground}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                returnKeyType="default"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={18} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
