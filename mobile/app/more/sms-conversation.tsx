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
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successLight,
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
    paddingVertical: 60,
  },
  emptyIcon: {
    opacity: 0.3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
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
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
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
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextOutbound: {
    color: colors.primaryForeground,
  },
  messageTextInbound: {
    color: colors.foreground,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  messageTimeOutbound: {
    color: colors.primaryForeground + '80',
    textAlign: 'right',
  },
  messageTimeInbound: {
    color: colors.mutedForeground,
  },
  messageStatus: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'right',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
    minHeight: 40,
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
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function SmsConversationScreen() {
  const { id, phone, name } = useLocalSearchParams<{ id: string; phone: string; name: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

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
              <Feather name="message-circle" size={48} color={colors.mutedForeground} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send an SMS to start the conversation</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              return (
                <View
                  key={msg.id}
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
              );
            })
          )}
        </ScrollView>

        <View style={styles.composerContainer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Type an SMS..."
            placeholderTextColor={colors.mutedForeground}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            returnKeyType="default"
          />
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
      </KeyboardAvoidingView>
    </>
  );
}
