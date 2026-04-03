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
  Linking,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, sizes } from '../../src/lib/design-tokens';

import api from '../../src/lib/api';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 2,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerPhone: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.success}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  dateSeparator: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dateSeparatorPill: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageRow: {
    marginBottom: 3,
  },
  messageRowOutbound: {
    alignItems: 'flex-end',
  },
  messageRowInbound: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleOutbound: {
    backgroundColor: colors.isDark ? `${colors.primary}80` : `${colors.primary}22`,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleInbound: {
    backgroundColor: colors.isDark ? colors.muted : `${colors.muted}`,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextOutbound: {
    color: colors.isDark ? colors.primaryForeground : colors.foreground,
  },
  bubbleTextInbound: {
    color: colors.foreground,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 3,
  },
  bubbleTimeOutbound: {
    color: colors.isDark ? `${colors.primaryForeground}80` : colors.mutedForeground,
    textAlign: 'right',
  },
  bubbleTimeInbound: {
    color: colors.mutedForeground,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  statusText: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  statusDelivered: {
    color: colors.success,
  },
  composerWrap: {
    backgroundColor: colors.background,
    paddingBottom: 4,
  },
  quickRepliesRow: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  quickRepliesScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.muted,
    gap: 5,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  zapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 20,
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
    minHeight: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: {
    backgroundColor: 'transparent',
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
  const insets = useSafeAreaInsets();

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
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderMessageBody = useCallback((body: string, isOutbound: boolean) => {
    const parts = body.split(URL_REGEX);
    if (parts.length === 1) return body;

    return parts.map((part, i) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0;
        let label = 'Open link';
        if (part.includes('/p/')) label = 'Track your job';
        else if (part.includes('/quote')) label = 'View quote';
        else if (part.includes('/invoice')) label = 'View invoice';
        else if (part.includes('jobrunner')) label = 'Open in JobRunner';

        return (
          <Text
            key={i}
            style={{
              textDecorationLine: 'underline',
              color: isOutbound ? colors.primaryForeground : colors.primary,
              fontWeight: '600',
            }}
            onPress={() => Linking.openURL(part)}
          >
            {'\n'}{label} {'→'}
          </Text>
        );
      }
      return part;
    });
  }, [colors]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Feather name="message-circle" size={18} color={colors.primary} />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.headerPhone}>{clientPhone}</Text>
          </View>

          {clientPhone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${clientPhone}`)}
              style={styles.callButton}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={16} color={colors.success} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Feather name="message-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Send an SMS to start the conversation</Text>
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
                      <Text style={styles.dateSeparatorPill}>
                        {new Date(msg.createdAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.messageRow, isOutbound ? styles.messageRowOutbound : styles.messageRowInbound]}>
                    <View style={[styles.bubble, isOutbound ? styles.bubbleOutbound : styles.bubbleInbound]}>
                      <Text style={[styles.bubbleText, isOutbound ? styles.bubbleTextOutbound : styles.bubbleTextInbound]}>
                        {renderMessageBody(decodeHtmlEntities(msg.body), isOutbound)}
                      </Text>
                      <Text style={[styles.bubbleTime, isOutbound ? styles.bubbleTimeOutbound : styles.bubbleTimeInbound]}>
                        {formatTime(msg.createdAt)}
                      </Text>
                    </View>
                    {isOutbound && msg.status && (
                      <View style={styles.statusRow}>
                        <Feather 
                          name={msg.status === 'delivered' ? 'check-circle' : msg.status === 'failed' ? 'alert-circle' : 'check'} 
                          size={10} 
                          color={msg.status === 'delivered' ? colors.success : msg.status === 'failed' ? colors.destructive : colors.mutedForeground} 
                        />
                        <Text style={[styles.statusText, msg.status === 'delivered' && styles.statusDelivered]}>
                          {msg.status === 'sent' ? 'Sent' : msg.status === 'delivered' ? 'Delivered' : msg.status === 'failed' ? 'Failed' : msg.status}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composerWrap}>
          {showQuickReplies && (
            <View style={styles.quickRepliesRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
                {QUICK_REPLY_TEMPLATES.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.quickChip}
                    onPress={() => {
                      setMessageText(template.message);
                      setShowQuickReplies(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name={template.icon} size={12} color={colors.primary} />
                    <Text style={styles.quickChipText}>{template.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.composerInner}>
            <TouchableOpacity
              style={styles.zapButton}
              onPress={() => setShowQuickReplies(!showQuickReplies)}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={18} color={showQuickReplies ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Type an SMS..."
                placeholderTextColor={colors.mutedForeground}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                returnKeyType="default"
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, (!messageText.trim() || isSending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={16} color={messageText.trim() ? colors.primaryForeground : colors.mutedForeground} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
