import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface MessageTemplate {
  id: string;
  title: string;
  message: string;
  icon: string;
  category: string;
}

interface Client {
  id: string;
  name: string;
  businessName?: string;
  phone?: string;
}

interface Job {
  id: string;
  title: string;
  clientId: string;
  address?: string;
}

const ETA_OPTIONS = ['5', '10', '15', '20', '30', '45', '60'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  featuredCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  featuredIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primaryForeground,
    marginBottom: spacing.xs,
  },
  featuredSubtitle: {
    fontSize: 14,
    color: `${colors.primaryForeground}cc`,
    marginBottom: spacing.lg,
  },
  featuredButton: {
    backgroundColor: colors.primaryForeground,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  featuredButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  templatesGrid: {
    gap: spacing.md,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  templateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateMessage: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalContent: {
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  recipientPhone: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
  },
  changeButtonText: {
    fontSize: 13,
    color: colors.foreground,
  },
  etaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  etaButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  etaButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  etaButtonText: {
    fontSize: 14,
    color: colors.foreground,
  },
  etaButtonTextActive: {
    color: colors.primaryForeground,
  },
  messageInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  previewSection: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  previewText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  altSendButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  altSendButtonText: {
    fontSize: 14,
    color: colors.foreground,
  },
  clientList: {
    maxHeight: 400,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  clientItemActive: {
    backgroundColor: colors.primaryLight,
  },
  clientItemContent: {
    flex: 1,
  },
  clientItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  clientItemPhone: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clientItemNoPhone: {
    fontSize: 13,
    color: colors.destructive,
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyClients: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  jobContext: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  jobContextText: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
});

export default function QuickMessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEta, setSelectedEta] = useState('15');
  const [customMessage, setCustomMessage] = useState('');
  const [contextJob, setContextJob] = useState<Job | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [templatesRes, clientsRes] = await Promise.all([
        api.get<MessageTemplate[]>('/api/sms/templates'),
        api.get<Client[]>('/api/clients')
      ]);
      
      if (templatesRes.data) {
        setTemplates(templatesRes.data);
      }
      if (clientsRes.data) {
        setClients(clientsRes.data.filter(c => c.phone));
      }
      
      // If opened from a job, pre-select the client
      if (params.jobId && params.clientId) {
        const client = clientsRes.data?.find(c => c.id === params.clientId);
        if (client) {
          setSelectedClient(client);
        }
        // Fetch job details for context
        const jobRes = await api.get<Job>(`/api/jobs/${params.jobId}`);
        if (jobRes.data) {
          setContextJob(jobRes.data);
        }
      }
    } catch (error) {
      console.error('[QuickMessages] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params.jobId, params.clientId]);

  useEffect(() => {
    fetchData();
  }, []);

  const processMessage = (message: string) => {
    return message.replace('{eta}', selectedEta);
  };

  const openComposeWithTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setCustomMessage(processMessage(template.message));
    setShowComposeModal(true);
  };

  const openOnMyWay = () => {
    const onMyWayTemplate = templates.find(t => t.id === 'on-my-way');
    if (onMyWayTemplate) {
      openComposeWithTemplate(onMyWayTemplate);
    } else {
      setCustomMessage(`G'day! Just letting you know I'm on my way now. Should be there in about 15 minutes.`);
      setShowComposeModal(true);
    }
  };

  const handleSendSMS = async () => {
    if (!selectedClient?.phone) {
      Alert.alert('Error', 'Please select a client with a phone number.');
      return;
    }
    if (!customMessage.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }
    
    setIsSending(true);
    try {
      const response = await api.post('/api/sms/send', {
        to: selectedClient.phone,
        message: customMessage,
        clientId: selectedClient.id,
        jobId: contextJob?.id
      });
      
      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }
      
      Alert.alert(
        'Message Sent',
        response.data?.simulated 
          ? 'SMS simulated (Twilio not configured yet)'
          : `Message sent to ${selectedClient.name}!`,
        [{ text: 'OK', onPress: () => setShowComposeModal(false) }]
      );
      
      // Reset state
      setCustomMessage('');
      setSelectedTemplate(null);
    } catch (error) {
      console.error('[QuickMessages] Failed to send:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenNativeSMS = () => {
    if (!selectedClient?.phone) return;
    
    const smsUrl = `sms:${selectedClient.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(customMessage)}`;
    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Could not open SMS app.');
    });
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientModal(false);
  };

  useEffect(() => {
    if (selectedTemplate && selectedEta) {
      setCustomMessage(processMessage(selectedTemplate.message));
    }
  }, [selectedEta]);

  const filteredClients = clients.filter(c => c.phone);
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Quick Messages</Text>
              <Text style={styles.pageSubtitle}>Send pre-filled SMS to clients</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.featuredCard}
            onPress={openOnMyWay}
            activeOpacity={0.8}
          >
            <View style={styles.featuredIcon}>
              <Feather name="navigation" size={28} color={colors.primaryForeground} />
            </View>
            <Text style={styles.featuredTitle}>I'm On My Way</Text>
            <Text style={styles.featuredSubtitle}>
              Let your client know you're heading to the job site with your ETA
            </Text>
            <View style={styles.featuredButton}>
              <Text style={styles.featuredButtonText}>Send Now</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Message Templates</Text>
          <View style={styles.templatesGrid}>
            {templates.map(template => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => openComposeWithTemplate(template)}
                activeOpacity={0.7}
              >
                <View style={styles.templateHeader}>
                  <View style={styles.templateIconContainer}>
                    <Feather name={template.icon as any} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                </View>
                <Text style={styles.templateMessage} numberOfLines={2}>
                  {template.message.replace('{eta}', '15')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={showComposeModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowComposeModal(false)}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedTemplate?.title || 'Compose Message'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {contextJob && (
              <View style={styles.jobContext}>
                <Feather name="briefcase" size={20} color={colors.primary} />
                <Text style={styles.jobContextText}>
                  Sending for: {contextJob.title}
                </Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Recipient</Text>
              {selectedClient ? (
                <View style={styles.recipientCard}>
                  <View style={styles.recipientInfo}>
                    <Text style={styles.recipientName}>
                      {selectedClient.businessName || selectedClient.name}
                    </Text>
                    <Text style={styles.recipientPhone}>{selectedClient.phone}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.changeButton}
                    onPress={() => setShowClientModal(true)}
                  >
                    <Text style={styles.changeButtonText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.recipientCard}
                  onPress={() => setShowClientModal(true)}
                >
                  <Text style={[styles.recipientName, { color: colors.mutedForeground }]}>
                    Select a client
                  </Text>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            
            {selectedTemplate?.message.includes('{eta}') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ETA (minutes)</Text>
                <View style={styles.etaGrid}>
                  {ETA_OPTIONS.map(eta => (
                    <TouchableOpacity
                      key={eta}
                      style={[
                        styles.etaButton,
                        selectedEta === eta && styles.etaButtonActive
                      ]}
                      onPress={() => setSelectedEta(eta)}
                    >
                      <Text style={[
                        styles.etaButtonText,
                        selectedEta === eta && styles.etaButtonTextActive
                      ]}>
                        {eta}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Message</Text>
              <TextInput
                style={styles.messageInput}
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={6}
                placeholder="Type your message..."
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.charCount}>{customMessage.length} characters</Text>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!selectedClient?.phone || !customMessage.trim() || isSending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendSMS}
              disabled={!selectedClient?.phone || !customMessage.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="send" size={18} color={colors.primaryForeground} />
                  <Text style={styles.sendButtonText}>Send SMS</Text>
                </>
              )}
            </TouchableOpacity>
            
            {selectedClient?.phone && (
              <TouchableOpacity 
                style={styles.altSendButton}
                onPress={handleOpenNativeSMS}
              >
                <Feather name="message-square" size={18} color={colors.foreground} />
                <Text style={styles.altSendButtonText}>Open in Messages App</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowClientModal(false)}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Client</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.clientList}>
            {filteredClients.length === 0 ? (
              <View style={styles.emptyClients}>
                <Text style={styles.emptyText}>
                  No clients with phone numbers found.{'\n'}
                  Add phone numbers to your clients first.
                </Text>
              </View>
            ) : (
              filteredClients.map(client => (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.clientItem,
                    selectedClient?.id === client.id && styles.clientItemActive
                  ]}
                  onPress={() => selectClient(client)}
                >
                  <Feather 
                    name={selectedClient?.id === client.id ? 'check-circle' : 'circle'} 
                    size={20} 
                    color={selectedClient?.id === client.id ? colors.primary : colors.mutedForeground} 
                  />
                  <View style={styles.clientItemContent}>
                    <Text style={styles.clientItemName}>
                      {client.businessName || client.name}
                    </Text>
                    <Text style={styles.clientItemPhone}>{client.phone}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
