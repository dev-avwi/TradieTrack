import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';

type EmptyStateType = 
  | 'jobs'
  | 'clients'
  | 'invoices'
  | 'quotes'
  | 'messages'
  | 'notifications'
  | 'search'
  | 'expenses'
  | 'documents';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: keyof typeof Feather.glyphMap;
  defaultTitle: string;
  defaultSubtitle: string;
  gradientColors: [string, string];
}> = {
  jobs: {
    icon: 'briefcase',
    defaultTitle: 'No jobs yet',
    defaultSubtitle: 'Create your first job to start tracking work and getting paid.',
    gradientColors: ['#4F46E5', '#818CF8'],
  },
  clients: {
    icon: 'users',
    defaultTitle: 'No clients yet',
    defaultSubtitle: 'Add your first client to start building your customer base.',
    gradientColors: ['#0EA5E9', '#38BDF8'],
  },
  invoices: {
    icon: 'file-text',
    defaultTitle: 'No invoices yet',
    defaultSubtitle: 'Create an invoice to start getting paid for your work.',
    gradientColors: ['#10B981', '#34D399'],
  },
  quotes: {
    icon: 'file',
    defaultTitle: 'No quotes yet',
    defaultSubtitle: 'Send quotes to win more jobs and grow your business.',
    gradientColors: ['#F59E0B', '#FBBF24'],
  },
  messages: {
    icon: 'message-circle',
    defaultTitle: 'No messages yet',
    defaultSubtitle: 'Start a conversation with your team or clients.',
    gradientColors: ['#8B5CF6', '#A78BFA'],
  },
  notifications: {
    icon: 'bell',
    defaultTitle: 'All caught up!',
    defaultSubtitle: 'You have no new notifications. Check back later.',
    gradientColors: ['#EC4899', '#F472B6'],
  },
  search: {
    icon: 'search',
    defaultTitle: 'No results found',
    defaultSubtitle: 'Try adjusting your search or filters to find what you\'re looking for.',
    gradientColors: ['#6B7280', '#9CA3AF'],
  },
  expenses: {
    icon: 'credit-card',
    defaultTitle: 'No expenses recorded',
    defaultSubtitle: 'Track your business expenses to stay on top of your finances.',
    gradientColors: ['#EF4444', '#F87171'],
  },
  documents: {
    icon: 'folder',
    defaultTitle: 'No documents yet',
    defaultSubtitle: 'Upload documents to keep everything organised in one place.',
    gradientColors: ['#14B8A6', '#2DD4BF'],
  },
};

export function EmptyState({ 
  type, 
  title, 
  subtitle, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const config = EMPTY_STATE_CONFIG[type];
  
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${config.gradientColors[0]}15` }]}>
        <View style={[styles.iconInner, { backgroundColor: `${config.gradientColors[0]}25` }]}>
          <Feather 
            name={config.icon} 
            size={40} 
            color={config.gradientColors[0]} 
          />
        </View>
      </View>
      
      <Text style={styles.title}>{title || config.defaultTitle}</Text>
      <Text style={styles.subtitle}>{subtitle || config.defaultSubtitle}</Text>
      
      {actionLabel && onAction && (
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: config.gradientColors[0] }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
