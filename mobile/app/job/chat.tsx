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
  Modal,
  Linking,
  Image,
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
  clientId?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

interface JobPhoto {
  id: string;
  url: string;
  caption?: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  total: number;
  status: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
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
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  messageBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  internalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  internalBannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  internalBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.info,
    fontWeight: '500',
  },
  contactClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 4,
  },
  contactClientText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  participantsBanner: {
    backgroundColor: colors.card,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  participantsTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  participantAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitials: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  participantName: {
    fontSize: 11,
    color: colors.foreground,
  },
  participantRole: {
    fontSize: 10,
    color: colors.mutedForeground,
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
  systemMessage: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  messageRow: {
    marginBottom: spacing.sm,
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
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.muted,
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
  attachmentPreview: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: radius.md,
  },
  attachmentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: 6,
  },
  attachmentDocText: {
    fontSize: 12,
    fontWeight: '500',
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
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  attachmentOption: {
    width: '30%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  attachmentOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  attachmentOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
    textAlign: 'center',
  },
  documentsList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  documentMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

export default function JobChatScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<JobChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documentType, setDocumentType] = useState<'photos' | 'quotes' | 'invoices' | null>(null);
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>([]);
  const [jobQuotes, setJobQuotes] = useState<Quote[]>([]);
  const [jobInvoices, setJobInvoices] = useState<Invoice[]>([]);

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
        if (response.data.clientId) {
          loadClient(response.data.clientId);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
    }
  };

  const loadClient = async (clientId: string) => {
    try {
      const response = await api.get<Client>(`/api/clients/${clientId}`);
      if (response.data) {
        setClient(response.data);
      }
    } catch (error) {
      console.error('Error loading client:', error);
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

  const loadJobDocuments = async (type: 'photos' | 'quotes' | 'invoices') => {
    try {
      if (type === 'photos') {
        const response = await api.get<JobPhoto[]>(`/api/jobs/${jobId}/photos`);
        setJobPhotos(response.data || []);
      } else if (type === 'quotes') {
        const response = await api.get<Quote[]>(`/api/quotes?jobId=${jobId}`);
        setJobQuotes(response.data || []);
      } else if (type === 'invoices') {
        const response = await api.get<Invoice[]>(`/api/invoices?jobId=${jobId}`);
        setJobInvoices(response.data || []);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
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

  const handleAttachPhoto = async () => {
    setShowAttachModal(false);
    Alert.alert(
      'Add Photo',
      'To share photos in this discussion, please add them to the job\'s photo gallery first, then share from "Job Photos".',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Job Photos', 
          onPress: () => router.push(`/job/${jobId}` as any) 
        }
      ]
    );
  };

  const handleTakePhoto = async () => {
    setShowAttachModal(false);
    Alert.alert(
      'Take Photo',
      'To share photos in this discussion, please add them to the job\'s photo gallery first, then share from "Job Photos".',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Job', 
          onPress: () => router.push(`/job/${jobId}` as any) 
        }
      ]
    );
  };

  const handleShareDocument = async (type: 'photos' | 'quotes' | 'invoices') => {
    setShowAttachModal(false);
    setDocumentType(type);
    await loadJobDocuments(type);
    setShowDocumentsModal(true);
  };

  const handleSelectDocument = async (docType: string, docId: string, docName: string) => {
    setShowDocumentsModal(false);
    setIsSending(true);
    try {
      await api.post(`/api/jobs/${jobId}/chat`, {
        message: `Shared ${docType}: ${docName}`,
        messageType: docType.toLowerCase(),
        attachmentName: docName,
        attachmentUrl: docId,
      });
      await loadMessages();
      Alert.alert('Shared', `${docType} "${docName}" shared. Team members can tap to view.`);
    } catch (error) {
      Alert.alert('Error', `Failed to share ${docType}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentTap = (msg: JobChatMessage) => {
    const docType = msg.messageType;
    const docId = msg.attachmentUrl;
    
    if (docType === 'quote' && docId) {
      router.push(`/more/quote/${docId}` as any);
    } else if (docType === 'invoice' && docId) {
      router.push(`/more/invoice/${docId}` as any);
    } else if (docType === 'photo' && docId) {
      router.push(`/job/${jobId}` as any);
    } else {
      router.push(`/job/${jobId}` as any);
    }
  };

  const handleContactClient = () => {
    if (!client) {
      Alert.alert('No Client', 'This job does not have an assigned client');
      return;
    }

    Alert.alert(
      `Contact ${client.firstName}`,
      'How would you like to contact the client?',
      [
        { text: 'Cancel', style: 'cancel' },
        client.phone ? { text: 'Call', onPress: () => Linking.openURL(`tel:${client.phone}`) } : null,
        client.phone ? { text: 'SMS', onPress: () => Linking.openURL(`sms:${client.phone}`) } : null,
        client.email ? { text: 'Email', onPress: () => Linking.openURL(`mailto:${client.email}`) } : null,
      ].filter(Boolean) as any[]
    );
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

  const renderAttachment = (msg: JobChatMessage) => {
    if (!msg.attachmentName && !msg.attachmentUrl) return null;
    
    const isOwn = isOwnMessage(msg);
    const docName = msg.attachmentName || 'Document';
    const docType = msg.messageType || 'document';
    const hasLink = msg.attachmentUrl;
    
    return (
      <TouchableOpacity 
        style={styles.attachmentDoc}
        onPress={() => handleAttachmentTap(msg)}
        disabled={!hasLink}
        activeOpacity={0.7}
      >
        <Feather 
          name={docType === 'quote' ? 'file-text' : docType === 'invoice' ? 'dollar-sign' : docType === 'photo' ? 'image' : 'file'} 
          size={14} 
          color={isOwn ? colors.primaryForeground : colors.foreground} 
        />
        <Text style={[styles.attachmentDocText, { color: isOwn ? colors.primaryForeground : colors.foreground }]}>
          {docName}
        </Text>
        {hasLink && (
          <Feather 
            name="external-link" 
            size={12} 
            color={isOwn ? colors.primaryForeground : colors.mutedForeground} 
          />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Job Discussion' }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Team Discussion</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{job?.title}</Text>
          </View>
          <View style={styles.messageBadge}>
            <Text style={styles.messageBadgeText}>
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </Text>
          </View>
        </View>

        <View style={styles.internalBanner}>
          <View style={styles.internalBannerIcon}>
            <Feather name="users" size={12} color="#fff" />
          </View>
          <Text style={styles.internalBannerText}>
            This is an internal team discussion. Messages are not sent to the client.
          </Text>
          {client && (
            <TouchableOpacity style={styles.contactClientBtn} onPress={handleContactClient}>
              <Feather name="phone" size={12} color={colors.primaryForeground} />
              <Text style={styles.contactClientText}>Contact Client</Text>
            </TouchableOpacity>
          )}
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
              <Text style={styles.emptySubtext}>Start the internal discussion about this job</Text>
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
                    {renderAttachment(msg)}
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
          <TouchableOpacity 
            style={styles.attachButton} 
            onPress={() => setShowAttachModal(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
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

      <Modal
        visible={showAttachModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAttachModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAttachModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <View style={styles.attachmentGrid}>
              <TouchableOpacity style={styles.attachmentOption} onPress={handleTakePhoto}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="camera" size={24} color={colors.primary} />
                </View>
                <Text style={styles.attachmentOptionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={handleAttachPhoto}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="image" size={24} color={colors.success} />
                </View>
                <Text style={styles.attachmentOptionText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => handleShareDocument('photos')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="folder" size={24} color={colors.warning} />
                </View>
                <Text style={styles.attachmentOptionText}>Job Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => handleShareDocument('quotes')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="file-text" size={24} color={colors.info} />
                </View>
                <Text style={styles.attachmentOptionText}>Quotes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => handleShareDocument('invoices')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.destructiveLight }]}>
                  <Feather name="dollar-sign" size={24} color={colors.destructive} />
                </View>
                <Text style={styles.attachmentOptionText}>Invoices</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.attachmentOption} 
                onPress={() => {
                  setShowAttachModal(false);
                  router.push(`/job/${jobId}` as any);
                }}
              >
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="briefcase" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={styles.attachmentOptionText}>Job Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDocumentsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocumentsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDocumentsModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {documentType === 'photos' ? 'Job Photos' : 
                 documentType === 'quotes' ? 'Quotes' : 'Invoices'}
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocumentsModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.documentsList}>
              {documentType === 'photos' && jobPhotos.map((photo) => (
                <TouchableOpacity 
                  key={photo.id} 
                  style={styles.documentItem}
                  onPress={() => handleSelectDocument('Photo', photo.id, photo.caption || 'Job Photo')}
                >
                  <Image source={{ uri: photo.url }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>{photo.caption || 'Job Photo'}</Text>
                  </View>
                  <Feather name="send" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
              {documentType === 'quotes' && jobQuotes.map((quote) => (
                <TouchableOpacity 
                  key={quote.id} 
                  style={styles.documentItem}
                  onPress={() => handleSelectDocument('Quote', quote.id, quote.quoteNumber)}
                >
                  <View style={[styles.documentIcon, { backgroundColor: colors.infoLight }]}>
                    <Feather name="file-text" size={20} color={colors.info} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>{quote.quoteNumber}</Text>
                    <Text style={styles.documentMeta}>${(quote.total / 100).toFixed(2)} - {quote.status}</Text>
                  </View>
                  <Feather name="send" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
              {documentType === 'invoices' && jobInvoices.map((invoice) => (
                <TouchableOpacity 
                  key={invoice.id} 
                  style={styles.documentItem}
                  onPress={() => handleSelectDocument('Invoice', invoice.id, invoice.invoiceNumber)}
                >
                  <View style={[styles.documentIcon, { backgroundColor: colors.warningLight }]}>
                    <Feather name="dollar-sign" size={20} color={colors.warning} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>{invoice.invoiceNumber}</Text>
                    <Text style={styles.documentMeta}>${(invoice.total / 100).toFixed(2)} - {invoice.status}</Text>
                  </View>
                  <Feather name="send" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
              {((documentType === 'photos' && jobPhotos.length === 0) ||
                (documentType === 'quotes' && jobQuotes.length === 0) ||
                (documentType === 'invoices' && jobInvoices.length === 0)) && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No {documentType} found</Text>
                  <Text style={styles.emptySubtext}>Add {documentType} to the job first</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
