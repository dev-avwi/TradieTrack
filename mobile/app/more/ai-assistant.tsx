import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  Alert
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

const DISMISSED_NOTIFICATIONS_KEY = 'tradietrack_dismissed_notifications';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AINotification {
  id: string;
  type: 'reminder' | 'alert' | 'suggestion' | 'update';
  title: string;
  message: string;
  entityType?: 'job' | 'quote' | 'invoice' | 'client';
  entityId?: string;
  priority: 'high' | 'medium' | 'low';
}

const SUGGESTED_PROMPTS = [
  "How can I follow up with overdue invoices?",
  "Generate a weekly performance summary",
  "What jobs need my attention today?",
  "Draft a quote for a bathroom renovation",
  "Tips for improving my cash flow",
  "How do I track expenses efficiently?"
];

function SuggestionCard({ 
  text, 
  onPress,
  isAISuggestion = false
}: { 
  text: string; 
  onPress: () => void;
  isAISuggestion?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.suggestionCard,
        isAISuggestion && styles.aiSuggestionCard
      ]}
    >
      <Text style={styles.suggestionText}>{text}</Text>
    </TouchableOpacity>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.role === 'user';
  
  return (
    <View style={[
      styles.chatBubble,
      isUser ? styles.userBubble : styles.assistantBubble
    ]}>
      <Text style={styles.chatBubbleLabel}>
        {isUser ? 'You' : 'TradieTrack AI'}
      </Text>
      <Text style={styles.chatBubbleText}>{message.content}</Text>
    </View>
  );
}

function NotificationCard({ 
  notification, 
  onPress,
  onDismiss
}: { 
  notification: AINotification; 
  onPress: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const getIcon = () => {
    switch (notification.type) {
      case 'alert': return 'alert-circle';
      case 'reminder': return 'clock';
      case 'suggestion': return 'lightbulb';
      default: return 'bell';
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'high': return colors.destructive;
      case 'medium': return colors.warning || '#f59e0b';
      default: return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.notificationCard, { borderLeftColor: getPriorityColor() }]}
    >
      <View style={styles.notificationHeader}>
        <View style={[styles.notificationIconContainer, { backgroundColor: `${getPriorityColor()}20` }]}>
          <Feather name={getIcon() as any} size={16} color={getPriorityColor()} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function AIAssistantScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadDismissed = async () => {
      try {
        const stored = await AsyncStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
        if (stored) {
          setDismissedIds(JSON.parse(stored));
        }
      } catch (e) {
        console.log('Failed to load dismissed notifications:', e);
      }
    };
    loadDismissed();
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const response = await api.get('/api/ai/suggestions');
      setSuggestions(response.data?.suggestions || []);
    } catch (error) {
      console.log('Failed to fetch AI suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/api/ai/notifications');
      const data = response.data?.notifications ?? response.data ?? [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Failed to fetch AI notifications:', error);
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSuggestions, fetchNotifications]);

  const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  const handleDismissNotification = async (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    try {
      await AsyncStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(newDismissed));
    } catch (e) {
      console.log('Failed to save dismissed notifications:', e);
    }
  };

  const handleNotificationPress = (notification: AINotification) => {
    if (notification.entityType && notification.entityId) {
      handleDismissNotification(notification.id);
      
      switch (notification.entityType) {
        case 'job':
          router.push(`/job/${notification.entityId}`);
          break;
        case 'quote':
          router.push(`/quote/${notification.entityId}`);
          break;
        case 'invoice':
          router.push(`/invoice/${notification.entityId}`);
          break;
        case 'client':
          router.push(`/client/${notification.entityId}`);
          break;
        default:
          Alert.alert(notification.title, notification.message);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isSending) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setIsSending(true);

    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await api.post('/api/ai/chat', { message: userMessage });
      const assistantResponse = response.data?.response || 'Sorry, I could not process that request.';
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setChatMessage(suggestion);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear the conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => setChatHistory([])
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'AI Assistant',
          headerRight: () => chatHistory.length > 0 ? (
            <TouchableOpacity onPress={handleClearChat} style={styles.headerButton}>
              <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null
        }} 
      />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerIconContainer}>
              <Feather name="star" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <Text style={styles.headerSubtitle}>Get help with your business tasks</Text>
            </View>
          </View>

          {/* Proactive Notifications */}
          {activeNotifications.length > 0 && chatHistory.length === 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Feather name="bell" size={16} color={colors.destructive} />
                </View>
                <Text style={styles.sectionTitle}>Needs Attention</Text>
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{activeNotifications.length}</Text>
                </View>
              </View>
              
              <View style={styles.notificationsContainer}>
                {activeNotifications.slice(0, 5).map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onPress={() => handleNotificationPress(notification)}
                    onDismiss={() => handleDismissNotification(notification.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Suggested Prompts - Show when no chat history */}
          {chatHistory.length === 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Feather name="zap" size={16} color={colors.mutedForeground} />
                </View>
                <Text style={styles.sectionTitle}>Try asking:</Text>
              </View>
              
              <View style={styles.suggestionsGrid}>
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <SuggestionCard
                    key={index}
                    text={prompt}
                    onPress={() => handleSuggestionPress(prompt)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* AI-Generated Suggestions */}
          {chatHistory.length === 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Feather name="star" size={16} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Smart Suggestions:</Text>
              </View>
              
              {isLoadingSuggestions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Analyzing your business...</Text>
                </View>
              ) : suggestions.length > 0 ? (
                <View style={styles.suggestionsGrid}>
                  {suggestions.map((suggestion, index) => (
                    <SuggestionCard
                      key={index}
                      text={suggestion}
                      onPress={() => handleSuggestionPress(suggestion)}
                      isAISuggestion
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No suggestions available right now
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <View style={styles.chatSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Feather name="message-square" size={16} color={colors.mutedForeground} />
                </View>
                <Text style={styles.sectionTitle}>Conversation</Text>
              </View>

              <View style={styles.chatContainer}>
                {chatHistory.map((message, index) => (
                  <ChatBubble key={index} message={message} />
                ))}
                
                {isSending && (
                  <View style={[styles.chatBubble, styles.assistantBubble, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.typingText}>TradieTrack AI is typing...</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Chat Input */}
        <View style={styles.inputContainer}>
          <TextInput
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Ask anything..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            multiline
            maxLength={500}
            editable={!isSending}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!chatMessage.trim() || isSending}
            style={[
              styles.sendButton,
              (!chatMessage.trim() || isSending) && styles.sendButtonDisabled
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Feather name="send" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIconContainer: {
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  suggestionsGrid: {
    gap: spacing.sm,
  },
  suggestionCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 14,
  },
  aiSuggestionCard: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  chatSection: {
    flex: 1,
  },
  chatContainer: {
    gap: spacing.md,
  },
  chatBubble: {
    borderRadius: radius.md,
    padding: spacing.md,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: colors.muted,
    alignSelf: 'flex-end',
    marginLeft: 32,
  },
  assistantBubble: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
    alignSelf: 'flex-start',
    marginRight: 32,
  },
  chatBubbleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  chatBubbleText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typingText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
  headerButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  notificationsContainer: {
    gap: 10,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notificationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  notificationBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
});
