import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, typography } from '../lib/design-tokens';
import { api } from '../lib/api';

interface AIEmailSuggestion {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullMessage: string;
}

interface EmailComposeModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'quote' | 'invoice' | 'receipt';
  documentId: string;
  clientName: string;
  clientEmail: string;
  documentNumber: string;
  documentTitle: string;
  total: string;
  businessName?: string;
  publicUrl?: string;
  onSend: (customSubject: string, customMessage: string) => Promise<void>;
}

type TabKey = 'compose' | 'ai' | 'preview';

export function EmailComposeModal({
  visible,
  onClose,
  type,
  documentId,
  clientName,
  clientEmail,
  documentNumber,
  documentTitle,
  total,
  businessName,
  publicUrl,
  onSend,
}: EmailComposeModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<TabKey>('compose');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AIEmailSuggestion | null>(null);
  // Track the document ID and type to detect when we need to reinitialize
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const clientFirstName = useMemo(() => clientName?.split(' ')[0] || 'there', [clientName]);

  // Create a unique key for this document to detect when we need to reinitialize
  const documentKey = `${type}-${documentId}-${documentNumber}`;

  useEffect(() => {
    if (visible && initializedFor !== documentKey) {
      // Initialize/reinitialize for this specific document
      let defaultSubject: string;
      let defaultMessage: string;

      if (type === 'quote') {
        defaultSubject = `Quote ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nPlease find attached your quote for ${documentTitle}.\n\nTotal: ${total}\n\nIf you have any questions, please don't hesitate to reach out.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (type === 'invoice') {
        defaultSubject = `Invoice ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nPlease find attached your invoice for ${documentTitle}.\n\nTotal: ${total}\n\nPayment is due within 14 days.\n\nThank you for your business.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else {
        // Receipt
        defaultSubject = `Payment Receipt ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nThank you for your payment!\n\nPlease find attached your receipt for ${total}.\n\nWe appreciate your business.\n\nKind regards,\n${businessName || 'Your Business'}`;
      }

      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setAiSuggestion(null);
      setActiveTab('compose');
      setIsSending(false);
      setIsGeneratingAI(false);
      setInitializedFor(documentKey);
    } else if (!visible) {
      // Reset all state when modal closes - important for clean reopen
      setInitializedFor(null);
      setSubject('');
      setMessage('');
      setAiSuggestion(null);
      setActiveTab('compose');
      setIsSending(false);
      setIsGeneratingAI(false);
    }
  }, [visible, documentKey, initializedFor, type, documentNumber, documentTitle, total, businessName, clientFirstName]);

  const generateAISuggestion = useCallback(async () => {
    setIsGeneratingAI(true);
    try {
      const response = await api.post<AIEmailSuggestion>('/api/ai/email-suggestion', {
        type,
        documentId,
        clientName,
        documentNumber,
        documentTitle,
        total,
        businessName,
      });

      if (response.data) {
        setAiSuggestion(response.data);
      }
    } catch (error) {
      console.error('AI suggestion error:', error);
      Alert.alert('Error', 'Failed to generate AI suggestion. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  }, [type, documentId, clientName, documentNumber, documentTitle, total, businessName]);

  const applyAISuggestion = () => {
    if (aiSuggestion) {
      setSubject(aiSuggestion.subject);
      setMessage(aiSuggestion.fullMessage);
      setActiveTab('compose');
    }
  };

  // Quick tone adjustments with Australian English (matches web app)
  const adjustTone = (tone: 'formal' | 'friendly' | 'brief') => {
    let toneMessage: string;
    
    if (type === 'quote') {
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nPlease find attached the quotation for "${documentTitle}" as requested.\n\nThe quoted amount is ${total}. This quote remains valid for 30 days from the date of issue.\n\nShould you have any queries or require clarification, please do not hesitate to contact us.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nGreat chatting with you - here's the quote we discussed for "${documentTitle}".\n\nIt comes to ${total} all up. Let me know if you've got any questions or want to tweak anything!\n\nCheers mate,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Quote for "${documentTitle}" - ${total}.\n\nAny questions, just ask.\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    } else if (type === 'invoice') {
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nPlease find attached your tax invoice for "${documentTitle}".\n\nThe total amount payable is ${total}. Payment is due within the terms specified on the invoice.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nJust popping this invoice through for "${documentTitle}".\n\nThe total is ${total}. You can pay online using the link below - super easy!\n\nThanks heaps for your custom - really appreciate it!\n\nCheers mate,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Invoice for "${documentTitle}" - ${total}.\n\nPayment link included.\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    } else {
      // Receipt
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nThank you for your recent payment.\n\nPlease find attached your official receipt for ${total}.\n\nWe appreciate your prompt payment and look forward to being of service again.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nThanks heaps for the payment!\n\nHere's your receipt for ${total} - all sorted!\n\nReally appreciate your business mate!\n\nCheers,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Receipt for ${total}.\n\nThanks for your payment!\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    }
    
    setMessage(toneMessage);
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Information', 'Please enter both subject and message.');
      return;
    }

    setIsSending(true);
    try {
      await onSend(subject, message);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to send email. Please try again.';
      Alert.alert('Send Failed', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'compose', label: 'Compose', icon: 'edit-3' },
    { key: 'ai', label: 'AI Assist', icon: 'zap' },
    { key: 'preview', label: 'Preview', icon: 'eye' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {type === 'quote' ? 'Send Quote' : type === 'invoice' ? 'Send Invoice' : 'Send Receipt'}
            </Text>
            <Text style={styles.headerSubtitle}>to {clientName}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={isSending}
            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="send" size={16} color={colors.primaryForeground} />
                <Text style={styles.sendButtonText}>Send</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Feather
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Compose Tab */}
          {activeTab === 'compose' && (
            <View style={styles.composeContent}>
              {/* Recipient Info */}
              <View style={styles.recipientCard}>
                <View style={styles.recipientRow}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} />
                  <Text style={styles.recipientLabel}>To:</Text>
                  <Text style={styles.recipientEmail}>{clientEmail}</Text>
                </View>
              </View>

              {/* Subject */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  style={styles.subjectInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Email subject..."
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Message */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Write your message..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => setActiveTab('ai')}
                >
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={styles.quickActionText}>AI</Text>
                </TouchableOpacity>
                
                {/* Tone adjustment buttons like web app */}
                <TouchableOpacity
                  style={styles.toneButton}
                  onPress={() => adjustTone('friendly')}
                >
                  <Text style={styles.toneButtonText}>Friendly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toneButton}
                  onPress={() => adjustTone('formal')}
                >
                  <Text style={styles.toneButtonText}>Formal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toneButton}
                  onPress={() => adjustTone('brief')}
                >
                  <Text style={styles.toneButtonText}>Brief</Text>
                </TouchableOpacity>
              </View>
              
              {/* Info about auto-attached content */}
              <View style={styles.autoIncludedInfo}>
                <Feather name="paperclip" size={14} color={colors.mutedForeground} />
                <Text style={styles.autoIncludedText}>
                  {type === 'receipt' ? 'PDF attached automatically' : 'PDF + payment link included automatically'}
                </Text>
              </View>
            </View>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <View style={styles.aiContent}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconContainer}>
                  <Feather name="zap" size={24} color={colors.primary} />
                </View>
                <Text style={styles.aiTitle}>AI Email Assistant</Text>
                <Text style={styles.aiDescription}>
                  Generate a professional email tailored to your {type} and client
                </Text>
              </View>

              {!aiSuggestion && !isGeneratingAI && (
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateAISuggestion}
                >
                  <Feather name="sparkles" size={18} color={colors.primaryForeground} />
                  <Text style={styles.generateButtonText}>Generate AI Suggestion</Text>
                </TouchableOpacity>
              )}

              {isGeneratingAI && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Generating professional email...</Text>
                </View>
              )}

              {aiSuggestion && !isGeneratingAI && (
                <View style={styles.suggestionContainer}>
                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionLabel}>Subject</Text>
                    <Text style={styles.suggestionText}>{aiSuggestion.subject}</Text>
                  </View>

                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionLabel}>Message</Text>
                    <Text style={styles.suggestionText}>{aiSuggestion.fullMessage}</Text>
                  </View>

                  <View style={styles.suggestionActions}>
                    <TouchableOpacity
                      style={styles.applyButton}
                      onPress={applyAISuggestion}
                    >
                      <Feather name="check" size={16} color={colors.primaryForeground} />
                      <Text style={styles.applyButtonText}>Use This Email</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.regenerateButton}
                      onPress={generateAISuggestion}
                    >
                      <Feather name="refresh-cw" size={16} color={colors.foreground} />
                      <Text style={styles.regenerateButtonText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <View style={styles.previewContent}>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>From</Text>
                  <Text style={styles.previewValue}>{businessName || 'Your Business'}</Text>
                </View>

                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>To</Text>
                  <Text style={styles.previewValue}>{clientEmail}</Text>
                </View>

                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>Subject</Text>
                  <Text style={styles.previewSubject}>{subject}</Text>
                </View>

                <View style={styles.previewDivider} />

                <Text style={styles.previewMessage}>{message}</Text>

                {publicUrl && (
                  <View style={styles.attachmentPreview}>
                    <Feather name="paperclip" size={16} color={colors.mutedForeground} />
                    <Text style={styles.attachmentText}>
                      {type === 'quote' ? 'Quote PDF' : type === 'invoice' ? 'Invoice PDF' : 'Receipt PDF'} will be attached
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing['2xl'],
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    closeButton: {
      padding: spacing.xs,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
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
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    sendButtonDisabled: {
      opacity: 0.6,
    },
    sendButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.xs,
      backgroundColor: colors.muted,
    },
    tabActive: {
      backgroundColor: colors.primaryLight,
    },
    tabLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    composeContent: {
      padding: spacing.lg,
    },
    recipientCard: {
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    recipientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    recipientLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    recipientEmail: {
      fontSize: 14,
      color: colors.foreground,
      fontWeight: '500',
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    subjectInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.foreground,
    },
    messageInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.foreground,
      minHeight: 200,
    },
    quickActions: {
      marginTop: spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    toneButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toneButtonText: {
      fontSize: 13,
      color: colors.foreground,
    },
    autoIncludedInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.cardHover,
      borderRadius: radius.md,
    },
    autoIncludedText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    aiContent: {
      padding: spacing.lg,
    },
    aiHeader: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    aiIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    aiTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    aiDescription: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: radius.xl,
      gap: spacing.sm,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: spacing['2xl'],
    },
    loadingText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: spacing.md,
    },
    suggestionContainer: {
      gap: spacing.md,
    },
    suggestionCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    suggestionText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 20,
    },
    suggestionActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    applyButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    applyButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    regenerateButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.muted,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    regenerateButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    previewContent: {
      padding: spacing.lg,
    },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeader: {
      marginBottom: spacing.md,
    },
    previewLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    previewValue: {
      fontSize: 14,
      color: colors.foreground,
    },
    previewSubject: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.lg,
    },
    previewMessage: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 22,
    },
    attachmentPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.muted,
      padding: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.lg,
    },
    attachmentText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
  });

export default EmailComposeModal;
