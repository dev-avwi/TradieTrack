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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
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

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  createdAt: string;
  clientPhone?: string;
  clientName?: string;
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

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.mutedForeground,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBadge: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  messageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  internalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.isDark ? colors.primary + '08' : colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  internalBannerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  internalBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.isDark ? colors.info : colors.mutedForeground,
  },
  contactClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 4,
  },
  contactClientText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dateSeparatorLine: {
    position: 'absolute',
    top: '50%',
    left: spacing.xl,
    right: spacing.xl,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dateSeparatorPill: {
    backgroundColor: colors.isDark ? colors.muted : colors.card,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing['2xl'],
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '0A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary + '15',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  emptyHintText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  systemMessage: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
  },
  systemMessagePill: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageRowGroupStart: {
    marginTop: spacing.md,
  },
  avatarContainer: {
    width: 32,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarSpacer: {
    width: 32,
    marginRight: 8,
  },
  messageBubbleWrapper: {
    maxWidth: '78%',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: colors.isDark ? colors.muted : colors.card,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  messageTextOwn: {
    color: colors.primaryForeground,
  },
  messageTextOther: {
    color: colors.foreground,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '400',
  },
  messageTimeOwn: {
    color: colors.primaryForeground + '70',
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
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    gap: 6,
    marginTop: 6,
  },
  attachmentDocText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  smsBubbleOwn: {
    backgroundColor: colors.success,
    borderBottomRightRadius: 6,
  },
  smsBubbleOther: {
    backgroundColor: colors.isDark ? colors.successLight : '#e8f5e9',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.isDark ? colors.success + '30' : '#c8e6c9',
  },
  smsTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  smsTypeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  composerContainer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  composerInputWrapper: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  composerInput: {
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 15,
    fontWeight: '400',
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
    marginBottom: 1,
  },
  sendButtonDisabled: {
    opacity: 0.3,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.cardTitle,
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
    borderRadius: radius.xl,
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
    ...typography.captionSmall,
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
    ...typography.caption,
    fontWeight: '500',
    color: colors.foreground,
  },
  documentMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

export default function JobChatScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
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
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [smsConversation, setSmsConversation] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadMessages();
      loadSmsMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadJob(), loadMessages(), loadParticipants(), loadSmsMessages()]);
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

  const loadSmsMessages = async () => {
    try {
      const convosResponse = await api.get<any[]>('/api/sms/conversations');
      if (convosResponse.data) {
        const matchingConvo = convosResponse.data.find((c: any) => String(c.jobId) === String(jobId));
        if (matchingConvo) {
          setSmsConversation(matchingConvo);
          const msgsResponse = await api.get<any[]>(`/api/sms/conversations/${matchingConvo.id}/messages`);
          if (msgsResponse.data) {
            setSmsMessages(msgsResponse.data);
          }
        } else {
          setSmsConversation(null);
          setSmsMessages([]);
        }
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error);
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
    await Promise.all([loadMessages(), loadSmsMessages()]);
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
        client.phone ? { text: 'SMS', onPress: async () => {
          const message = `Hi ${client.firstName}, just reaching out regarding your job.`;
          try {
            const response = await api.post('/api/sms/send', {
              clientPhone: client.phone,
              message,
              clientId: client.id,
            });
            if (response.error) {
              Alert.alert(
                'Send via SMS App?',
                'Could not send directly. Would you like to open your messaging app instead?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open SMS App',
                    onPress: () => {
                      const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
                    },
                  },
                ]
              );
            } else {
              Alert.alert('SMS Sent', `Message sent to ${client.firstName}`);
            }
          } catch {
            Alert.alert(
              'Send via SMS App?',
              'Could not send directly. Would you like to open your messaging app instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open SMS App',
                  onPress: () => {
                    const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
                    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
                  },
                },
              ]
            );
          }
        }} : null,
        client.email ? { text: 'Email', onPress: () => Linking.openURL(`mailto:${client.email}`) } : null,
      ].filter(Boolean) as any[]
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-AU', { weekday: 'long' });
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
  };

  const getDateKey = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (msg: JobChatMessage) => msg.userId === user?.id;

  const formatMessageText = (text: string): string => {
    return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        if (host.includes('.replit.dev') || host.includes('.repl.co')) {
          return '[tracking link]';
        }
        const short = host.replace(/^www\./, '');
        if (short.length > 30) return short.substring(0, 25) + '.../';
        return short + parsed.pathname.substring(0, 15) + (parsed.pathname.length > 15 ? '...' : '');
      } catch {
        return url.length > 40 ? url.substring(0, 35) + '...' : url;
      }
    });
  };

  const allMessages = useMemo(() => {
    const combined: Array<{
      id: string;
      type: 'chat' | 'sms';
      message: string;
      senderName: string;
      createdAt: string;
      isOwn: boolean;
      isSystem?: boolean;
      direction?: 'inbound' | 'outbound';
      attachmentName?: string | null;
      attachmentUrl?: string | null;
      messageType?: string;
      originalMessage: any;
    }> = [];

    messages.forEach(msg => {
      combined.push({
        id: msg.id,
        type: 'chat',
        message: msg.message,
        senderName: msg.senderName,
        createdAt: msg.createdAt,
        isOwn: msg.userId === user?.id,
        isSystem: msg.isSystemMessage,
        attachmentName: msg.attachmentName,
        attachmentUrl: msg.attachmentUrl,
        messageType: msg.messageType,
        originalMessage: msg,
      });
    });

    smsMessages.forEach(sms => {
      combined.push({
        id: `sms-${sms.id}`,
        type: 'sms',
        message: sms.body,
        senderName: sms.direction === 'inbound' ? (smsConversation?.clientName || smsConversation?.clientPhone || 'Client') : 'You (SMS)',
        createdAt: sms.createdAt,
        isOwn: sms.direction === 'outbound',
        direction: sms.direction,
        originalMessage: sms,
      });
    });

    return combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, smsMessages, user?.id, smsConversation]);

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

  const renderMessages = () => {
    if (allMessages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Feather name="message-circle" size={34} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation with your team about this job
          </Text>
          <View style={styles.emptyHint}>
            <Feather name="arrow-down" size={14} color={colors.mutedForeground} />
            <Text style={styles.emptyHintText}>Type below to get started</Text>
          </View>
        </View>
      );
    }

    const elements: JSX.Element[] = [];
    let lastDateKey = '';
    let lastSenderId = '';

    allMessages.forEach((msg, index) => {
      const currentDateKey = getDateKey(msg.createdAt);
      if (currentDateKey !== lastDateKey) {
        elements.push(
          <View key={`date-${currentDateKey}`} style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <View style={styles.dateSeparatorPill}>
              <Text style={styles.dateSeparatorText}>{formatDateSeparator(msg.createdAt)}</Text>
            </View>
          </View>
        );
        lastDateKey = currentDateKey;
        lastSenderId = '';
      }

      if (msg.isSystem) {
        elements.push(
          <View key={msg.id} style={styles.systemMessage}>
            <View style={styles.systemMessagePill}>
              <Text style={styles.systemMessageText}>{msg.message}</Text>
            </View>
          </View>
        );
        lastSenderId = '';
        return;
      }

      const own = msg.isOwn;
      const isSms = msg.type === 'sms';
      const senderId = own ? '__own__' : msg.senderName;
      const isGroupStart = senderId !== lastSenderId;
      const showAvatar = !own && isGroupStart;
      lastSenderId = senderId;

      const bubbleStyle = isSms
        ? (own ? styles.smsBubbleOwn : styles.smsBubbleOther)
        : (own ? styles.messageBubbleOwn : styles.messageBubbleOther);

      const smsTextColorOther = colors.isDark ? colors.foreground : '#2e7d32';

      elements.push(
        <View
          key={msg.id}
          style={[
            styles.messageRow,
            own ? styles.messageRowOwn : styles.messageRowOther,
            isGroupStart && styles.messageRowGroupStart,
          ]}
        >
          {!own && (
            showAvatar ? (
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(msg.senderName) }]}>
                  <Text style={styles.avatarText}>{getInitials(msg.senderName)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.avatarSpacer} />
            )
          )}
          <View style={styles.messageBubbleWrapper}>
            {!own && isGroupStart && (
              <Text style={styles.messageSender}>{msg.senderName}</Text>
            )}
            <View style={[styles.messageBubble, bubbleStyle]}>
              <Text style={[
                styles.messageText,
                own ? styles.messageTextOwn : styles.messageTextOther,
                isSms && !own && { color: smsTextColorOther },
              ]}>
                {isSms ? formatMessageText(msg.message) : msg.message}
              </Text>
              {msg.type === 'chat' && renderAttachment(msg.originalMessage)}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, own ? styles.messageTimeOwn : styles.messageTimeOther]}>
                  {formatTime(msg.createdAt)}
                </Text>
                {isSms && (
                  <View style={[styles.smsTypeBadge, own && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Feather
                      name="smartphone"
                      size={8}
                      color={own ? colors.primaryForeground + '90' : colors.mutedForeground}
                    />
                    <Text style={[
                      styles.smsTypeBadgeText,
                      { color: own ? colors.primaryForeground + '90' : colors.mutedForeground },
                    ]}>
                      SMS
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      );
    });

    return elements;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isIOS = Platform.OS === 'ios';

  return (
    <>
      <Stack.Screen options={{ headerShown: isIOS, headerBackTitle: 'Back' }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.headerCard}>
          {!isIOS && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <View style={styles.headerIconContainer}>
            <Feather name="message-circle" size={16} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>Job Chat</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{job?.title}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.messageBadge}>
              <Text style={styles.messageBadgeText}>
                {allMessages.length}
              </Text>
            </View>
            {client && (
              <TouchableOpacity style={styles.headerActionBtn} onPress={handleContactClient}>
                <Feather name="phone" size={15} color={colors.foreground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.internalBanner}>
          <View style={styles.internalBannerIcon}>
            <Feather name="lock" size={10} color={colors.white} />
          </View>
          <Text style={styles.internalBannerText}>
            Internal team chat{smsMessages.length > 0 ? ' \u00B7 SMS messages included' : ''}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onContentSizeChange={() => {
            if (allMessages.length > 5) {
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
        >
          {renderMessages()}
        </ScrollView>

        <View style={[styles.composerContainer, { paddingBottom: bottomNavHeight + spacing.xs }]}>
          <View style={styles.composerRow}>
            <TouchableOpacity 
              style={styles.attachButton} 
              onPress={() => setShowAttachModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={styles.composerInputWrapper}>
              <TextInput
                style={styles.composerInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={1000}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
              activeOpacity={0.8}
            >
              {isSending ? (
                <ActivityIndicator size={16} color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={16} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>
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
                    <Text style={styles.documentMeta}>${parseFloat(String(quote.total || 0)).toFixed(2)} - {quote.status}</Text>
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
                    <Text style={styles.documentMeta}>${parseFloat(String(invoice.total || 0)).toFixed(2)} - {invoice.status}</Text>
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
