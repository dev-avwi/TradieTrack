import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAuthStore } from '../lib/store';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToItem?: (type: string, id: string) => void;
}

export function NotificationsPanel({ visible, onClose, onNavigateToItem }: NotificationsPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      fetchNotifications();
    } else if (isModalVisible) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsModalVisible(false);
      });
    }
  }, [visible]);

  const fetchNotifications = async () => {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://tradietrack.com';
      const response = await fetch(`${baseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://tradietrack.com';
      await fetch(`${baseUrl}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://tradietrack.com';
      await fetch(`${baseUrl}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://tradietrack.com';
      await fetch(`${baseUrl}/api/notifications/${id}/dismiss`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.relatedType && notification.relatedId && onNavigateToItem) {
      onClose();
      onNavigateToItem(notification.relatedType, notification.relatedId);
    }
  };

  const getNotificationIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'job_reminder':
      case 'job_scheduled':
        return 'calendar';
      case 'overdue_invoice':
      case 'invoice_sent':
      case 'invoice_paid':
        return 'dollar-sign';
      case 'payment_received':
      case 'payment_failed':
        return 'check-circle';
      case 'quote_accepted':
      case 'quote_rejected':
      case 'quote_sent':
      case 'quote_created':
        return 'file-text';
      case 'client_created':
        return 'users';
      case 'subscription_created':
      case 'subscription_canceled':
        return 'briefcase';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment_received':
      case 'quote_accepted':
      case 'invoice_paid':
        return { bg: colors.successLight || `${colors.success}15`, icon: colors.success };
      case 'overdue_invoice':
      case 'payment_failed':
      case 'quote_rejected':
        return { bg: colors.destructiveLight || `${colors.destructive}15`, icon: colors.destructive };
      case 'job_reminder':
      case 'job_scheduled':
        return { bg: colors.infoLight || `${colors.info}15`, icon: colors.info };
      case 'quote_sent':
      case 'quote_created':
      case 'invoice_sent':
        return { bg: colors.primaryLight, icon: colors.primary };
      default:
        return { bg: colors.muted, icon: colors.mutedForeground };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const activeNotifications = notifications.filter(n => !n.dismissed);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isModalVisible) return null;

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.panel,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Feather name="bell" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity 
                  onPress={markAllAsRead}
                  style={styles.markAllButton}
                >
                  <Feather name="check-circle" size={16} color={colors.primary} />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : activeNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="bell-off" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptyText}>
                  You have no new notifications. We'll let you know when something happens.
                </Text>
              </View>
            ) : (
              activeNotifications.map((notification) => {
                const iconName = getNotificationIcon(notification.type);
                const notificationColors = getNotificationColor(notification.type);
                
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.notificationUnread,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.notificationIcon, { backgroundColor: notificationColors.bg }]}>
                      <Feather name={iconName} size={18} color={notificationColors.icon} />
                    </View>
                    
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationHeader}>
                        <Text 
                          style={[
                            styles.notificationTitle,
                            !notification.read && styles.notificationTitleUnread
                          ]}
                          numberOfLines={1}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatTimeAgo(notification.createdAt)}
                      </Text>
                      
                      <View style={styles.notificationActions}>
                        {!notification.read && (
                          <TouchableOpacity 
                            style={styles.actionButton}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              markAsRead(notification.id);
                            }}
                          >
                            <Feather name="check" size={14} color={colors.foreground} />
                            <Text style={styles.actionButtonText}>Mark read</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.dismissButton]}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            dismissNotification(notification.id);
                          }}
                        >
                          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.actionButtonText, styles.dismissText]}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {notification.relatedType && (
                      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface NotificationBellProps {
  onPress: () => void;
}

export function NotificationBell({ onPress }: NotificationBellProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBellStyles(colors), [colors]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://tradietrack.com';
      const response = await fetch(`${baseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        const count = data.filter((n: Notification) => !n.read).length;
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Feather name="bell" size={22} color={colors.foreground} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  notificationUnread: {
    backgroundColor: `${colors.primary}08`,
  },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notificationMessage: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
    opacity: 0.7,
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  dismissButton: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  dismissText: {
    color: colors.mutedForeground,
  },
});

const createBellStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.destructiveForeground,
  },
});
