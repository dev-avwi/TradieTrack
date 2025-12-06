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
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

export default function AIAssistantScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

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
});
