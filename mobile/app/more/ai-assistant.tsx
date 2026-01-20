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
  Alert,
  Animated
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';

const DISMISSED_NOTIFICATIONS_KEY = 'tradietrack_dismissed_notifications';

interface RichContentItem {
  type: 'job_link' | 'quote_link' | 'invoice_link' | 'client_link' | 'action_button';
  id: string;
  label: string;
  url?: string;
  status?: string;
  amount?: number;
}

interface AIAction {
  type: string;
  data?: any;
  confirmationRequired?: boolean;
  message?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  richContent?: RichContentItem[];
  action?: AIAction;
  suggestedFollowups?: string[];
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

function ThinkingDots({ colors }: { colors: ThemeColors }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = animateDot(dot1, 0);
    const animation2 = animateDot(dot2, 150);
    const animation3 = animateDot(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, []);

  const dotStyle = (animValue: Animated.Value) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: 3,
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [{
      scale: animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1.2],
      }),
    }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

function EntityLink({ 
  item, 
  colors 
}: { 
  item: RichContentItem;
  colors: ThemeColors;
}) {
  const getIcon = (): keyof typeof Feather.glyphMap => {
    switch (item.type) {
      case 'job_link': return 'briefcase';
      case 'quote_link': return 'file-text';
      case 'invoice_link': return 'file';
      case 'client_link': return 'user';
      default: return 'external-link';
    }
  };

  const getPath = () => {
    switch (item.type) {
      case 'job_link': return `/job/${item.id}`;
      case 'quote_link': return `/more/quote/${item.id}`;
      case 'invoice_link': return `/more/invoice/${item.id}`;
      case 'client_link': return `/more/client/${item.id}`;
      default: return null;
    }
  };

  const getStatusColor = () => {
    if (!item.status) return colors.muted;
    const status = item.status.toLowerCase();
    if (status === 'overdue' || status === 'cancelled') return colors.destructive;
    if (status === 'paid' || status === 'completed' || status === 'accepted' || status === 'done') return colors.success;
    if (status === 'sent' || status === 'pending' || status === 'in_progress') return colors.warning;
    return colors.muted;
  };

  const handlePress = () => {
    const path = getPath();
    if (path) {
      router.push(path as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderWidth: 1,
        borderColor: `${colors.primary}30`,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Feather name={getIcon()} size={14} color={colors.primary} style={{ marginRight: 6 }} />
      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
        {item.label}
      </Text>
      {item.status && (
        <View style={{
          backgroundColor: `${getStatusColor()}20`,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          marginLeft: 6,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: getStatusColor() }}>
            {item.status}
          </Text>
        </View>
      )}
      {item.amount !== undefined && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginLeft: 6 }}>
          ${(item.amount / 100).toFixed(2)}
        </Text>
      )}
      <Feather name="chevron-right" size={14} color={colors.primary} style={{ marginLeft: 4, opacity: 0.6 }} />
    </TouchableOpacity>
  );
}

function ActionConfirmation({
  action,
  onConfirm,
  onCancel,
  isPending,
  colors,
}: {
  action: AIAction;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={{
      backgroundColor: colors.successLight,
      borderWidth: 2,
      borderColor: `${colors.success}50`,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.success, marginBottom: 10 }}>
        {action.message || 'Confirm this action?'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={onConfirm}
          disabled={isPending}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.success,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.successForeground} style={{ marginRight: 6 }} />
          ) : (
            <Feather name="check" size={14} color={colors.successForeground} style={{ marginRight: 6 }} />
          )}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.successForeground }}>
            Yes, do it
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          disabled={isPending}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.muted,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
            opacity: isPending ? 0.7 : 1,
          }}
        >
          <Feather name="x" size={14} color={colors.foreground} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SuggestedFollowups({
  followups,
  onPress,
  colors,
}: {
  followups: string[];
  onPress: (text: string) => void;
  colors: ThemeColors;
}) {
  if (!followups || followups.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
      {followups.map((followup, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onPress(followup)}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginRight: 8,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.foreground }}>{followup}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

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

function ChatBubble({ 
  message,
  pendingAction,
  isExecutingAction,
  onConfirmAction,
  onCancelAction,
  onFollowupPress,
}: { 
  message: ChatMessage;
  pendingAction: AIAction | null;
  isExecutingAction: boolean;
  onConfirmAction: () => void;
  onCancelAction: () => void;
  onFollowupPress: (text: string) => void;
}) {
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
      
      {message.richContent && message.richContent.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {message.richContent.map((item, idx) => (
            <EntityLink key={idx} item={item} colors={colors} />
          ))}
        </View>
      )}

      {message.action?.confirmationRequired && pendingAction && (
        <ActionConfirmation
          action={message.action}
          onConfirm={onConfirmAction}
          onCancel={onCancelAction}
          isPending={isExecutingAction}
          colors={colors}
        />
      )}

      {message.suggestedFollowups && message.suggestedFollowups.length > 0 && !pendingAction && (
        <SuggestedFollowups
          followups={message.suggestedFollowups}
          onPress={onFollowupPress}
          colors={colors}
        />
      )}
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
      case 'suggestion': return 'zap';
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
  const { user } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const userName = user?.name?.split(' ')[0] || user?.username || '';

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
          router.push(`/more/quote/${notification.entityId}`);
          break;
        case 'invoice':
          router.push(`/more/invoice/${notification.entityId}`);
          break;
        case 'client':
          router.push(`/more/client/${notification.entityId}`);
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
      const data = response.data;
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data?.response || 'Sorry, I could not process that request.',
        richContent: data?.richContent,
        action: data?.action,
        suggestedFollowups: data?.suggestedFollowups,
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      
      if (data?.action?.confirmationRequired) {
        setPendingAction(data.action);
      }
      
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

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    
    setIsExecutingAction(true);
    try {
      const response = await api.post('/api/ai/execute-action', { action: pendingAction });
      const data = response.data;
      
      setPendingAction(null);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: data?.response || 'Done! Action completed successfully.' 
      }]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      setPendingAction(null);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, something went wrong. Please try again or do it manually.' 
      }]);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      content: 'No worries, cancelled that. Anything else I can help with?' 
    }]);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
          onPress: () => {
            setChatHistory([]);
            setPendingAction(null);
          }
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
              <Text style={styles.headerTitle}>
                {userName ? `Hi ${userName}!` : 'AI Assistant'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {userName ? 'How can I help you today?' : 'Get help with your business tasks'}
              </Text>
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
                  <ChatBubble 
                    key={index} 
                    message={message}
                    pendingAction={pendingAction}
                    isExecutingAction={isExecutingAction}
                    onConfirmAction={handleConfirmAction}
                    onCancelAction={handleCancelAction}
                    onFollowupPress={handleSuggestionPress}
                  />
                ))}
                
                {isSending && (
                  <View style={[styles.chatBubble, styles.assistantBubble, styles.thinkingBubble]}>
                    <Text style={styles.chatBubbleLabel}>TradieTrack AI</Text>
                    <ThinkingDots colors={colors} />
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
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconContainer: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  suggestionsGrid: {
    gap: 8,
  },
  suggestionCard: {
    backgroundColor: colors.muted,
    borderRadius: 12,
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
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyState: {
    padding: 16,
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
    gap: 12,
  },
  chatBubble: {
    borderRadius: 12,
    padding: 12,
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
    marginBottom: 4,
  },
  chatBubbleText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  thinkingBubble: {
    minWidth: 100,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
  notificationsContainer: {
    gap: 10,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
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
    borderRadius: 8,
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
    padding: 4,
  },
  notificationBadge: {
    marginLeft: 8,
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
