import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

type EmptyStateType = 
  | 'jobs' 
  | 'clients' 
  | 'quotes' 
  | 'invoices' 
  | 'receipts' 
  | 'team' 
  | 'messages' 
  | 'notifications'
  | 'search'
  | 'documents'
  | 'time'
  | 'payments'
  | 'general';

interface EmptyStateConfig {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  iconColor: string;
  bgColor: string;
}

const getEmptyStateConfig = (type: EmptyStateType): EmptyStateConfig => {
  switch (type) {
    case 'jobs':
      return {
        icon: 'briefcase',
        title: 'No jobs yet',
        description: 'Create your first job to start tracking your work',
        actionLabel: 'Create Job',
        iconColor: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.1)',
      };
    case 'clients':
      return {
        icon: 'users',
        title: 'No clients yet',
        description: 'Add your first client to get started',
        actionLabel: 'Add Client',
        iconColor: '#8b5cf6',
        bgColor: 'rgba(139,92,246,0.1)',
      };
    case 'quotes':
      return {
        icon: 'file-text',
        title: 'No quotes yet',
        description: 'Create a quote to send to your clients',
        actionLabel: 'Create Quote',
        iconColor: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.1)',
      };
    case 'invoices':
      return {
        icon: 'file',
        title: 'No invoices yet',
        description: 'Create an invoice when you complete a job',
        actionLabel: 'Create Invoice',
        iconColor: '#10b981',
        bgColor: 'rgba(16,185,129,0.1)',
      };
    case 'receipts':
      return {
        icon: 'check-circle',
        title: 'No receipts yet',
        description: 'Receipts are created when invoices are paid',
        iconColor: '#22c55e',
        bgColor: 'rgba(34,197,94,0.1)',
      };
    case 'team':
      return {
        icon: 'user-plus',
        title: 'No team members',
        description: 'Invite team members to collaborate on jobs',
        actionLabel: 'Invite Member',
        iconColor: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.1)',
      };
    case 'messages':
      return {
        icon: 'message-circle',
        title: 'No messages yet',
        description: 'Start a conversation with your team or clients',
        iconColor: '#a855f7',
        bgColor: 'rgba(168,85,247,0.1)',
      };
    case 'notifications':
      return {
        icon: 'bell',
        title: 'All caught up!',
        description: 'You have no new notifications',
        iconColor: '#6b7280',
        bgColor: 'rgba(107,114,128,0.1)',
      };
    case 'search':
      return {
        icon: 'search',
        title: 'No results found',
        description: 'Try adjusting your search or filters',
        iconColor: '#6b7280',
        bgColor: 'rgba(107,114,128,0.1)',
      };
    case 'documents':
      return {
        icon: 'folder',
        title: 'No documents yet',
        description: 'Your quotes, invoices, and receipts will appear here',
        iconColor: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.1)',
      };
    case 'time':
      return {
        icon: 'clock',
        title: 'No time entries',
        description: 'Start tracking time on your jobs',
        actionLabel: 'Start Timer',
        iconColor: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.1)',
      };
    case 'payments':
      return {
        icon: 'credit-card',
        title: 'No payments yet',
        description: 'Payment transactions will appear here',
        iconColor: '#10b981',
        bgColor: 'rgba(16,185,129,0.1)',
      };
    default:
      return {
        icon: 'inbox',
        title: 'Nothing here yet',
        description: 'Content will appear here once available',
        iconColor: '#6b7280',
        bgColor: 'rgba(107,114,128,0.1)',
      };
  }
};

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ 
  type, 
  title, 
  description, 
  actionLabel, 
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const config = getEmptyStateConfig(type);
  
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;
  
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[
        styles.iconContainer, 
        compact && styles.iconContainerCompact,
        { backgroundColor: config.bgColor }
      ]}>
        <Feather 
          name={config.icon} 
          size={compact ? 28 : 40} 
          color={config.iconColor} 
        />
      </View>
      
      <Text style={[
        styles.title, 
        compact && styles.titleCompact,
        { color: colors.foreground }
      ]}>
        {displayTitle}
      </Text>
      
      <Text style={[
        styles.description, 
        compact && styles.descriptionCompact,
        { color: colors.mutedForeground }
      ]}>
        {displayDescription}
      </Text>
      
      {displayActionLabel && onAction && (
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            {displayActionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  containerCompact: {
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconContainerCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  titleCompact: {
    fontSize: typography.sizes.lg,
  },
  description: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  descriptionCompact: {
    fontSize: typography.sizes.sm,
    maxWidth: 240,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  actionText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
});
