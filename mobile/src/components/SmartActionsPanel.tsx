import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

export type ActionStatus = 'suggested' | 'queued' | 'running' | 'completed' | 'skipped' | 'pending';

export interface SmartAction {
  id: string;
  type: 'create_invoice' | 'send_email' | 'send_sms' | 'create_job' | 'schedule_reminder' | 'collect_payment' | 'send_confirmation';
  title: string;
  description: string;
  icon: 'invoice' | 'email' | 'sms' | 'job' | 'reminder' | 'payment' | 'calendar';
  status: ActionStatus;
  enabled: boolean;
  preview?: {
    subject?: string;
    message?: string;
    amount?: string;
    recipient?: string;
    scheduledFor?: string;
  };
  aiSuggestion?: string;
  requirements?: string[];
  missingRequirements?: string[];
}

interface SmartActionsPanelProps {
  title: string;
  subtitle?: string;
  actions: SmartAction[];
  onActionToggle: (actionId: string, enabled: boolean) => void;
  onActionExecute: (actionId: string) => void;
  onExecuteAll: () => void;
  onSkipAll: () => void;
  isExecuting?: boolean;
  entityType: 'job' | 'quote' | 'invoice';
}

const getActionIcon = (iconType: string): keyof typeof Feather.glyphMap => {
  switch (iconType) {
    case 'invoice': return 'file-text';
    case 'email': return 'mail';
    case 'sms': return 'message-square';
    case 'job': return 'briefcase';
    case 'reminder': return 'bell';
    case 'payment': return 'credit-card';
    case 'calendar': return 'calendar';
    default: return 'zap';
  }
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
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
  badge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  content: {
    padding: spacing.md,
  },
  actionItem: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionItemCompleted: {
    borderColor: colors.success + '40',
    backgroundColor: colors.success + '05',
  },
  actionItemRunning: {
    borderColor: colors.warning + '40',
    backgroundColor: colors.warning + '05',
  },
  actionItemDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCompleted: {
    backgroundColor: colors.success + '15',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  actionDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  missingRequirements: {
    backgroundColor: colors.warning + '15',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  missingText: {
    fontSize: 11,
    color: colors.warning,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
});

function SmartActionItem({
  action,
  onExecute,
  isExecuting,
  colors,
  styles,
}: {
  action: SmartAction;
  onExecute: () => void;
  isExecuting?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const hasMissingRequirements = action.missingRequirements && action.missingRequirements.length > 0;
  const isCompleted = action.status === 'completed';
  const isRunning = action.status === 'running';
  const isDisabled = isExecuting || isCompleted || isRunning || hasMissingRequirements;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.actionItem,
        isCompleted && styles.actionItemCompleted,
        isRunning && styles.actionItemRunning,
        (hasMissingRequirements && !isCompleted) && styles.actionItemDisabled,
      ]}
      onPress={() => {
        if (!isDisabled) onExecute();
      }}
      disabled={!!isDisabled}
    >
      <View style={[
        styles.actionIcon,
        isCompleted && styles.actionIconCompleted,
      ]}>
        {isRunning ? (
          <ActivityIndicator size={18} color={colors.warning} />
        ) : isCompleted ? (
          <Feather name="check" size={18} color={colors.success} />
        ) : (
          <Feather
            name={getActionIcon(action.icon)}
            size={18}
            color={hasMissingRequirements ? colors.mutedForeground : colors.primary}
          />
        )}
      </View>

      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, isCompleted && { color: colors.success }]}>
          {isCompleted ? `${action.title} ` : action.title}
          {isCompleted && <Feather name="check-circle" size={13} color={colors.success} />}
        </Text>
        <Text style={styles.actionDescription}>
          {isRunning ? 'Running...' : action.description}
        </Text>
        {hasMissingRequirements && !isCompleted && (
          <View style={styles.missingRequirements}>
            <Text style={styles.missingText}>
              Missing: {action.missingRequirements?.join(', ')}
            </Text>
          </View>
        )}
      </View>

      {!isCompleted && !isRunning && !hasMissingRequirements && (
        <View style={styles.chevron}>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SmartActionsPanel({
  title,
  subtitle,
  actions,
  onActionToggle,
  onActionExecute,
  onExecuteAll,
  onSkipAll,
  isExecuting,
  entityType,
}: SmartActionsPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const completedActions = actions.filter(a => a.status === 'completed');

  if (actions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="zap" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{title}</Text>
              {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Feather name="zap" size={32} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          <Text style={styles.emptyText}>No suggested actions for this {entityType}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="zap" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {completedActions.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {completedActions.length}/{actions.length} done
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {actions.map((action) => (
          <SmartActionItem
            key={action.id}
            action={action}
            onExecute={() => onActionExecute(action.id)}
            isExecuting={isExecuting}
            colors={colors}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

export function getJobSmartActions(job: any, client: any, linkedQuote?: any, linkedInvoice?: any): SmartAction[] {
  const actions: SmartAction[] = [];
  const clientEmail = client?.email;
  const clientPhone = client?.phone;
  const clientName = client?.name || 'Client';

  if (job.status === 'done' && !linkedInvoice) {
    actions.push({
      id: 'create_invoice',
      type: 'create_invoice',
      title: 'Create Invoice',
      description: `Generate invoice for ${job.title}`,
      icon: 'invoice',
      status: 'suggested',
      enabled: true,
      preview: {
        recipient: clientName,
        amount: linkedQuote?.total ? `$${parseFloat(linkedQuote.total).toFixed(2)}` : 'Based on job details',
      },
      aiSuggestion: linkedQuote ? 'Will use line items from the accepted quote' : 'Add line items based on work completed',
      requirements: ['Job must be completed'],
    });

    if (clientEmail) {
      actions.push({
        id: 'send_invoice_email',
        type: 'send_email',
        title: 'Email Invoice',
        description: `Send invoice to ${clientName}`,
        icon: 'email',
        status: 'suggested',
        enabled: true,
        preview: {
          recipient: clientEmail,
          subject: `Invoice for ${job.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your invoice for "${job.title}".\n\nCheers`,
        },
        aiSuggestion: 'Friendly Australian-style email with payment link included',
        requirements: ['Invoice created', 'Client email'],
      });
    } else {
      actions.push({
        id: 'send_invoice_email',
        type: 'send_email',
        title: 'Email Invoice',
        description: 'Send invoice via email',
        icon: 'email',
        status: 'suggested',
        enabled: false,
        missingRequirements: ['Client email address'],
        requirements: ['Invoice created', 'Client email'],
      });
    }

    if (clientPhone) {
      actions.push({
        id: 'send_invoice_sms',
        type: 'send_sms',
        title: 'SMS Payment Link',
        description: `Text payment link to ${clientPhone}`,
        icon: 'sms',
        status: 'suggested',
        enabled: false,
        preview: {
          recipient: clientPhone,
          message: `Hi ${clientName.split(' ')[0]}! Your invoice for ${job.title} is ready. Pay here: [link]`,
        },
        requirements: ['Invoice created', 'Client phone'],
      });
    }
  }

  if (linkedInvoice && linkedInvoice.status !== 'paid') {
    const invoiceTotal = linkedInvoice.total || 0;
    const amountPaid = linkedInvoice.amountPaid || linkedInvoice.paidAmount || 0;
    const amountDue = invoiceTotal - amountPaid;
    const invoiceNumber = linkedInvoice.invoiceNumber || linkedInvoice.number || 'Invoice';
    
    if (amountDue > 0) {
      actions.push({
        id: 'collect_payment',
        type: 'collect_payment',
        title: 'Collect Payment',
        description: `Take payment for ${invoiceNumber}`,
        icon: 'payment',
        status: 'suggested',
        enabled: true,
        preview: {
          amount: `$${(amountDue / 100).toFixed(2)}`,
          recipient: clientName,
        },
        aiSuggestion: 'Use Tap to Pay for quick contactless payment',
        requirements: ['Invoice created', 'Payment amount due'],
      });
    }
  }

  if (job.status === 'pending' || job.status === 'scheduled') {
    if (!linkedQuote) {
      actions.push({
        id: 'create_quote',
        type: 'create_invoice',
        title: 'Create Quote',
        description: `Generate quote for ${job.title}`,
        icon: 'invoice',
        status: 'suggested',
        enabled: true,
        preview: {
          recipient: clientName,
        },
        aiSuggestion: 'Create a professional quote based on job scope',
      });
    }
  }

  if (job.status === 'scheduled' && clientEmail) {
    actions.push({
      id: 'send_confirmation',
      type: 'send_confirmation',
      title: 'Send Confirmation',
      description: 'Confirm booking with client',
      icon: 'email',
      status: 'suggested',
      enabled: true,
      preview: {
        recipient: clientEmail,
        subject: `Booking Confirmed: ${job.title}`,
        message: `G'day! Just confirming we'll be there on ${job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'the scheduled date'}.`,
      },
    });
  }

  return actions;
}
