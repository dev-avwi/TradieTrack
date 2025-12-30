import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

interface CommunicationItem {
  id: string;
  type: 'email' | 'sms';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  recipient: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  fullBody?: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
  entityNumber?: string;
  hasAttachment?: boolean;
  attachmentType?: string;
}

interface ActivityLog {
  id: string;
  type: string;
  title?: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

interface SmsConversation {
  id: string;
  clientName?: string;
  clientPhone?: string;
  jobId?: string;
  messages?: Array<{
    id: string;
    body: string;
    direction: 'inbound' | 'outbound';
    status?: string;
    createdAt?: string;
  }>;
}

type TabType = 'all' | 'email' | 'sms';
type StatusFilter = 'all' | 'sent' | 'delivered' | 'failed' | 'pending';

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
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  tabBadge: {
    backgroundColor: colors.mutedForeground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryForeground,
  },
  tabBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.muted,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemContent: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIcon: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  smsIcon: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  itemRecipient: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.foreground,
  },
  itemSubject: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 4,
  },
  itemBody: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  itemTime: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  attachmentText: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  entityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entityLinkText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.md,
  },
  detailSection: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
});

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'delivered':
      return { label: 'Delivered', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'sent':
      return { label: 'Sent', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'failed':
      return { label: 'Failed', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    case 'pending':
      return { label: 'Pending', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    default:
      return { label: status, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

export default function CommunicationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CommunicationItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  const fetchData = useCallback(async () => {
    try {
      const [activityRes, smsRes] = await Promise.all([
        api.get<ActivityLog[]>('/api/activity/recent/100'),
        api.get<SmsConversation[]>('/api/sms/conversations'),
      ]);
      
      const items: CommunicationItem[] = [];
      
      const activityLogs = activityRes.data || [];
      if (Array.isArray(activityLogs)) {
        activityLogs
          .filter(log => 
            log.type?.includes('sent') || 
            log.type?.includes('email') ||
            log.type === 'quote_sent' ||
            log.type === 'invoice_sent' ||
            log.type === 'receipt_sent'
          )
          .forEach(log => {
            const metadata = (log.metadata || {}) as Record<string, any>;
            
            let subject = '';
            let hasAttachment = false;
            let attachmentType = '';
            
            if (log.type === 'quote_sent') {
              subject = `Quote ${metadata.quoteNumber || ''} - ${metadata.quoteTitle || 'Quote'}`;
              hasAttachment = true;
              attachmentType = 'Quote';
            } else if (log.type === 'invoice_sent') {
              subject = `Invoice ${metadata.invoiceNumber || ''} - ${metadata.invoiceTitle || 'Invoice'}`;
              hasAttachment = true;
              attachmentType = 'Invoice';
            } else if (log.type === 'receipt_sent') {
              subject = `Receipt ${metadata.receiptNumber || ''} - Payment Confirmation`;
              hasAttachment = true;
              attachmentType = 'Receipt';
            } else {
              subject = log.title || `${log.type?.replace(/_/g, ' ')}`;
            }
            
            items.push({
              id: `email-${log.id}`,
              type: 'email',
              direction: 'outbound',
              status: 'sent',
              recipient: metadata.clientName || metadata.recipientName || 'Client',
              recipientEmail: metadata.recipientEmail || metadata.clientEmail,
              subject,
              body: log.description || '',
              fullBody: metadata.emailBody || metadata.messageBody || log.description || '',
              timestamp: new Date(log.createdAt || new Date()),
              entityType: log.entityType || undefined,
              entityId: log.entityId || undefined,
              entityNumber: metadata.quoteNumber || metadata.invoiceNumber || metadata.receiptNumber,
              hasAttachment,
              attachmentType,
            });
          });
      }
      
      const smsConversations = smsRes.data || [];
      if (Array.isArray(smsConversations)) {
        smsConversations.forEach((conv: SmsConversation) => {
          if (conv.messages && Array.isArray(conv.messages)) {
            conv.messages
              .filter((msg) => msg.direction === 'outbound')
              .forEach((msg) => {
                items.push({
                  id: `sms-${msg.id}`,
                  type: 'sms',
                  direction: 'outbound',
                  status: (msg.status as any) || 'sent',
                  recipient: conv.clientName || 'Client',
                  recipientPhone: conv.clientPhone,
                  body: msg.body || '',
                  fullBody: msg.body || '',
                  timestamp: new Date(msg.createdAt || new Date()),
                  entityType: conv.jobId ? 'job' : undefined,
                  entityId: conv.jobId || undefined,
                });
              });
          }
        });
      }
      
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setCommunications(items);
    } catch (error) {
      console.error('Failed to fetch communications:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  const filteredCommunications = useMemo(() => {
    return communications.filter(item => {
      if (activeTab !== 'all' && item.type !== activeTab) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.recipient.toLowerCase().includes(query) ||
          item.body.toLowerCase().includes(query) ||
          item.subject?.toLowerCase().includes(query) ||
          item.recipientEmail?.toLowerCase().includes(query) ||
          item.recipientPhone?.includes(query)
        );
      }
      return true;
    });
  }, [communications, activeTab, statusFilter, searchQuery]);
  
  const stats = useMemo(() => ({
    total: communications.length,
    emails: communications.filter(c => c.type === 'email').length,
    sms: communications.filter(c => c.type === 'sms').length,
    delivered: communications.filter(c => c.status === 'delivered' || c.status === 'sent').length,
  }), [communications]);
  
  const handleViewEntity = (type: string, id: string) => {
    setShowDetail(false);
    switch (type) {
      case 'quote':
        router.push(`/more/quote/${id}`);
        break;
      case 'invoice':
        router.push(`/more/invoice/${id}`);
        break;
      case 'job':
        router.push(`/job/${id}`);
        break;
      case 'receipt':
        router.push(`/more/receipt/${id}`);
        break;
    }
  };
  
  const renderItem = (item: CommunicationItem) => {
    const statusConfig = getStatusConfig(item.status);
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.itemCard}
        onPress={() => {
          setSelectedItem(item);
          setShowDetail(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <View style={[
            styles.itemIconContainer,
            item.type === 'email' ? styles.emailIcon : styles.smsIcon
          ]}>
            <Feather 
              name={item.type === 'email' ? 'mail' : 'message-square'} 
              size={iconSizes.md} 
              color={item.type === 'email' ? '#3b82f6' : '#22c55e'} 
            />
          </View>
          
          <View style={styles.itemDetails}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemRecipient} numberOfLines={1}>{item.recipient}</Text>
              {item.hasAttachment && (
                <View style={styles.attachmentBadge}>
                  <Feather name="paperclip" size={10} color={colors.mutedForeground} />
                  <Text style={styles.attachmentText}>PDF</Text>
                </View>
              )}
            </View>
            
            {item.subject && (
              <Text style={styles.itemSubject} numberOfLines={1}>{item.subject}</Text>
            )}
            
            <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
            
            <View style={styles.itemFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={styles.itemTime as any}>
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </Text>
              </View>
              
              {item.entityType && item.entityId && (
                <TouchableOpacity 
                  style={styles.entityLink}
                  onPress={() => handleViewEntity(item.entityType!, item.entityId!)}
                >
                  <Feather name="external-link" size={12} color={colors.primary} />
                  <Text style={styles.entityLinkText}>
                    View {item.entityType} {item.entityNumber ? `#${item.entityNumber}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <View style={styles.itemMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {item.type === 'email' ? 'Email' : 'SMS'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.headerCard}>
        <View style={styles.headerIconContainer}>
          <Feather name="send" size={iconSizes.lg} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Communications Hub</Text>
          <Text style={styles.headerSubtitle}>View all sent emails and SMS</Text>
        </View>
        <TouchableOpacity onPress={onRefresh}>
          <Feather name="refresh-cw" size={iconSizes.md} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.emails}</Text>
          <Text style={styles.statLabel}>Emails</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats.sms}</Text>
          <Text style={styles.statLabel}>SMS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
      </View>
      
      <View style={styles.tabsContainer}>
        {(['all', 'email', 'sms'] as TabType[]).map((tab) => {
          const count = tab === 'all' ? stats.total : tab === 'email' ? stats.emails : stats.sms;
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab === 'all' ? 'All' : tab === 'email' ? 'Email' : 'SMS'}
              </Text>
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      
      <View style={styles.searchContainer}>
        <Feather name="search" size={iconSizes.sm} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by recipient, content..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={iconSizes.sm} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredCommunications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyText}>No communications yet</Text>
          <Text style={styles.emptySubtext}>
            Sent emails and SMS messages will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
        >
          {filteredCommunications.map(renderItem)}
        </ScrollView>
      )}
      
      <Modal
        visible={showDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDetail(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.itemIconContainer,
                    selectedItem.type === 'email' ? styles.emailIcon : styles.smsIcon
                  ]}>
                    <Feather 
                      name={selectedItem.type === 'email' ? 'mail' : 'message-square'} 
                      size={iconSizes.md} 
                      color={selectedItem.type === 'email' ? '#3b82f6' : '#22c55e'} 
                    />
                  </View>
                  <Text style={styles.modalTitle}>
                    {selectedItem.type === 'email' ? 'Email' : 'SMS'} Details
                  </Text>
                  <TouchableOpacity onPress={() => setShowDetail(false)}>
                    <Feather name="x" size={iconSizes.lg} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Recipient</Text>
                    <Text style={styles.detailValue}>{selectedItem.recipient}</Text>
                    {selectedItem.recipientEmail && (
                      <Text style={[styles.detailValue, { color: colors.mutedForeground }]}>
                        {selectedItem.recipientEmail}
                      </Text>
                    )}
                    {selectedItem.recipientPhone && (
                      <Text style={[styles.detailValue, { color: colors.mutedForeground }]}>
                        {selectedItem.recipientPhone}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>{getStatusConfig(selectedItem.status).label}</Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: getStatusConfig(selectedItem.status).bgColor }
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: getStatusConfig(selectedItem.status).color }
                        ]}>
                          {getStatusConfig(selectedItem.status).label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm }}>
                        Sent at
                      </Text>
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>
                        {format(selectedItem.timestamp, 'h:mm:ss a')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm }}>
                        Provider
                      </Text>
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>
                        {selectedItem.type === 'email' ? 'SendGrid' : 'Twilio'}
                      </Text>
                    </View>
                  </View>
                  
                  {selectedItem.subject && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Subject</Text>
                      <Text style={styles.detailValue}>{selectedItem.subject}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Message</Text>
                    <Text style={styles.detailValue}>{selectedItem.fullBody || selectedItem.body}</Text>
                  </View>
                  
                  {selectedItem.entityType && selectedItem.entityId && (
                    <TouchableOpacity
                      style={[styles.detailSection, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      onPress={() => handleViewEntity(selectedItem.entityType!, selectedItem.entityId!)}
                    >
                      <View>
                        <Text style={styles.detailLabel}>Related Document</Text>
                        <Text style={styles.detailValue}>
                          {selectedItem.entityType} {selectedItem.entityNumber ? `#${selectedItem.entityNumber}` : ''}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={iconSizes.md} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
