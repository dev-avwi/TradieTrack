import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  ScrollView,
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
  },
  actionItemEnabled: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '05',
  },
  actionItemDisabled: {
    opacity: 0.6,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconEnabled: {
    backgroundColor: colors.primary + '15',
  },
  actionContent: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  actionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statusSuggested: {
    backgroundColor: colors.muted,
  },
  statusRunning: {
    backgroundColor: colors.warning + '20',
  },
  statusCompleted: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  missingRequirements: {
    backgroundColor: colors.warning + '15',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  missingText: {
    fontSize: 11,
    color: colors.warning,
  },
  aiSuggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  aiText: {
    fontSize: 11,
    color: colors.primary,
    flex: 1,
  },
  previewSection: {
    backgroundColor: colors.muted,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  previewValue: {
    fontSize: 11,
    color: colors.foreground,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.sm,
  },
  previewAmount: {
    color: colors.primary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  footerText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  skipButtonText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  executeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  executeButtonDisabled: {
    backgroundColor: colors.muted,
  },
  executeButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: '600',
  },
  executeButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  note: {
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
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
  onToggle,
  onExecute,
  isExecuting,
  colors,
  styles,
}: {
  action: SmartAction;
  onToggle: (enabled: boolean) => void;
  onExecute: () => void;
  isExecuting?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMissingRequirements = action.missingRequirements && action.missingRequirements.length > 0;
  const isDisabled = isExecuting || action.status === 'completed' || action.status === 'running';

  const getStatusColor = () => {
    switch (action.status) {
      case 'running': return colors.warning;
      case 'completed': return colors.success;
      default: return colors.mutedForeground;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.actionItem,
        action.enabled && !hasMissingRequirements && styles.actionItemEnabled,
        hasMissingRequirements && styles.actionItemDisabled,
      ]}
      onPress={() => setIsExpanded(!isExpanded)}
    >
      <View style={styles.actionHeader}>
        <View style={[
          styles.actionIcon,
          action.enabled && !hasMissingRequirements && styles.actionIconEnabled,
        ]}>
          <Feather
            name={getActionIcon(action.icon)}
            size={18}
            color={action.enabled && !hasMissingRequirements ? colors.primary : colors.mutedForeground}
          />
        </View>

        <View style={styles.actionContent}>
          <View style={styles.actionTitleRow}>
            <View style={styles.actionTitleLeft}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              {action.status !== 'suggested' && (
                <View style={[
                  styles.statusBadge,
                  action.status === 'running' && styles.statusRunning,
                  action.status === 'completed' && styles.statusCompleted,
                  action.status === 'suggested' && styles.statusSuggested,
                ]}>
                  {action.status === 'running' && (
                    <ActivityIndicator size={8} color={colors.warning} />
                  )}
                  {action.status === 'completed' && (
                    <Feather name="check" size={10} color={colors.success} />
                  )}
                  <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                    {action.status === 'running' ? 'Running' : action.status === 'completed' ? 'Done' : ''}
                  </Text>
                </View>
              )}
            </View>
            <Switch
              value={action.enabled}
              onValueChange={onToggle}
              disabled={isDisabled || hasMissingRequirements}
              trackColor={{ false: colors.muted, true: colors.primary + '60' }}
              thumbColor={action.enabled ? colors.primary : colors.mutedForeground}
            />
          </View>
          <Text style={styles.actionDescription}>{action.description}</Text>
        </View>
      </View>

      {hasMissingRequirements && (
        <View style={styles.missingRequirements}>
          <Text style={styles.missingText}>
            Missing: {action.missingRequirements?.join(', ')}
          </Text>
        </View>
      )}

      {action.aiSuggestion && action.enabled && !hasMissingRequirements && (
        <View style={styles.aiSuggestion}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={styles.aiText}>{action.aiSuggestion}</Text>
        </View>
      )}

      {isExpanded && action.preview && action.enabled && !hasMissingRequirements && (
        <View style={styles.previewSection}>
          {action.preview.recipient && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>To:</Text>
              <Text style={styles.previewValue} numberOfLines={1}>{action.preview.recipient}</Text>
            </View>
          )}
          {action.preview.subject && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Subject:</Text>
              <Text style={styles.previewValue} numberOfLines={1}>{action.preview.subject}</Text>
            </View>
          )}
          {action.preview.amount && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Amount:</Text>
              <Text style={[styles.previewValue, styles.previewAmount]}>{action.preview.amount}</Text>
            </View>
          )}
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

  const enabledActions = actions.filter(a => a.enabled && (!a.missingRequirements || a.missingRequirements.length === 0));
  const completedActions = actions.filter(a => a.status === 'completed');
  const hasActionsToRun = enabledActions.length > 0 && enabledActions.some(a => a.status !== 'completed');

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
            onToggle={(enabled) => onActionToggle(action.id, enabled)}
            onExecute={() => onActionExecute(action.id)}
            isExecuting={isExecuting}
            colors={colors}
            styles={styles}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            {enabledActions.length} action{enabledActions.length !== 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity style={styles.skipButton} onPress={onSkipAll} disabled={isExecuting}>
            <Text style={styles.skipButtonText}>Skip all</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.executeButton,
            (!hasActionsToRun || isExecuting) && styles.executeButtonDisabled,
          ]}
          onPress={onExecuteAll}
          disabled={!hasActionsToRun || isExecuting}
          activeOpacity={0.8}
        >
          {isExecuting ? (
            <>
              <ActivityIndicator size={16} color={colors.primaryForeground} />
              <Text style={styles.executeButtonText}>Running actions...</Text>
            </>
          ) : (
            <>
              <Feather name="arrow-right" size={18} color={hasActionsToRun ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[
                styles.executeButtonText,
                !hasActionsToRun && styles.executeButtonTextDisabled,
              ]}>
                Run {enabledActions.length} Action{enabledActions.length !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Review each action above before running. Nothing happens until you tap Run.
        </Text>
      </View>
    </View>
  );
}

// Helper function to generate smart actions for a job
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

  // Add Collect Payment action when invoice exists and isn't paid
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
        enabled: false,
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
      enabled: false,
      preview: {
        recipient: clientEmail,
        subject: `Booking Confirmed: ${job.title}`,
        message: `G'day! Just confirming we'll be there on ${job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'the scheduled date'}.`,
      },
    });
  }

  return actions;
}
