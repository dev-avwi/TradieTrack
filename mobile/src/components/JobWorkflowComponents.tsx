import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, iconSizes } from '../lib/design-tokens';

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: number;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

const WORKFLOW_STEPS = [
  { id: 'pending', label: 'New', icon: 'briefcase' as const },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar' as const },
  { id: 'in_progress', label: 'In Progress', icon: 'play' as const },
  { id: 'done', label: 'Done', icon: 'check-circle' as const },
  { id: 'invoiced', label: 'Invoiced', icon: 'file-text' as const },
] as const;

const STATUS_ORDER: Record<JobStatus, number> = {
  pending: 0,
  scheduled: 1,
  in_progress: 2,
  done: 3,
  invoiced: 4,
};

interface JobProgressBarProps {
  status: JobStatus;
}

export function JobProgressBar({ status }: JobProgressBarProps) {
  const { colors } = useTheme();
  const styles = createProgressStyles(colors);
  const currentIndex = STATUS_ORDER[status];

  return (
    <View style={styles.container}>
      {/* Simple Progress Steps - no header, cleaner design */}
      <View style={styles.stepsRow}>
        {WORKFLOW_STEPS.map((step, index) => {
          const isPassed = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <View key={step.id} style={styles.stepContainer}>
              {index > 0 && (
                <View 
                  style={[
                    styles.connector,
                    isPassed ? styles.connectorComplete : 
                    isCurrent ? styles.connectorActive : 
                    styles.connectorInactive
                  ]} 
                />
              )}
              <View
                style={[
                  styles.stepCircle,
                  isPassed && styles.stepCircleComplete,
                  isCurrent && styles.stepCircleCurrent,
                ]}
              >
                {isPassed ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : (
                  <View style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotCurrent,
                  ]} />
                )}
              </View>
              <Text 
                style={[
                  styles.stepLabel,
                  isPassed && styles.stepLabelComplete,
                  isCurrent && styles.stepLabelCurrent,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createProgressStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 12,
    right: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
    backgroundColor: colors.muted,
  },
  connectorComplete: {
    backgroundColor: colors.success,
  },
  connectorActive: {
    backgroundColor: colors.border,
  },
  connectorInactive: {
    backgroundColor: colors.muted,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.muted,
  },
  stepCircleComplete: {
    backgroundColor: colors.success,
  },
  stepCircleCurrent: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.foreground,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  stepDotCurrent: {
    backgroundColor: colors.foreground,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  stepLabelComplete: {
    color: colors.success,
    fontWeight: '600',
  },
  stepLabelCurrent: {
    color: colors.foreground,
    fontWeight: '600',
  },
});

interface LinkedReceipt {
  id: string;
  receiptNumber?: string;
  amount: number;
  paymentMethod?: string;
  createdAt?: string;
}

interface LinkedDocumentsCardProps {
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
  linkedReceipt?: LinkedReceipt | null;
  jobStatus: JobStatus;
  onViewQuote?: (id: string) => void;
  onViewInvoice?: (id: string) => void;
  onViewReceipt?: (id: string) => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
}

export function LinkedDocumentsCard({
  linkedQuote,
  linkedInvoice,
  linkedReceipt,
  jobStatus,
  onViewQuote,
  onViewInvoice,
  onViewReceipt,
  onCreateQuote,
  onCreateInvoice,
}: LinkedDocumentsCardProps) {
  const { colors } = useTheme();
  const styles = createDocumentsStyles(colors);

  const getQuoteStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return { bg: `${colors.scheduled}15`, text: colors.scheduled };
      case 'accepted': return { bg: `${colors.success}15`, text: colors.success };
      case 'declined': return { bg: `${colors.destructive}15`, text: colors.destructive };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return { bg: `${colors.scheduled}15`, text: colors.scheduled };
      case 'paid': return { bg: `${colors.success}15`, text: colors.success };
      case 'overdue': return { bg: `${colors.destructive}15`, text: colors.destructive };
      case 'partial': return { bg: `${colors.warning}15`, text: colors.warning };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="file-text" size={iconSizes.md} color={colors.foreground} />
        <Text style={styles.title}>Documents</Text>
      </View>

      <TouchableOpacity 
        style={[styles.documentRow, linkedQuote && styles.documentRowClickable]}
        onPress={() => linkedQuote && onViewQuote?.(linkedQuote.id)}
        activeOpacity={linkedQuote ? 0.7 : 1}
      >
        <View style={[styles.documentIcon, { backgroundColor: linkedQuote ? `${colors.scheduled}15` : colors.muted }]}>
          <Feather name="file-text" size={16} color={linkedQuote ? colors.scheduled : colors.mutedForeground} />
        </View>
        <View style={styles.documentContent}>
          <Text style={styles.documentTitle}>
            {linkedQuote ? (linkedQuote.quoteNumber || linkedQuote.number || 'Quote') : 'No Quote'}
          </Text>
          {linkedQuote ? (
            <View style={styles.documentMeta}>
              <Text style={styles.documentAmount}>{formatCurrency(linkedQuote.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getQuoteStatusColor(linkedQuote.status).bg }]}>
                <Text style={[styles.statusText, { color: getQuoteStatusColor(linkedQuote.status).text }]}>
                  {linkedQuote.status || 'Draft'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.documentSubtitle}>Create a quote for this job</Text>
          )}
        </View>
        {!linkedQuote && onCreateQuote ? (
          <TouchableOpacity style={styles.createButton} onPress={onCreateQuote}>
            <Text style={styles.createButtonText}>Create Quote</Text>
          </TouchableOpacity>
        ) : linkedQuote ? (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.documentRow, linkedInvoice && styles.documentRowClickable]}
        onPress={() => linkedInvoice && onViewInvoice?.(linkedInvoice.id)}
        activeOpacity={linkedInvoice ? 0.7 : 1}
      >
        <View style={[styles.documentIcon, { backgroundColor: linkedInvoice ? `${colors.invoiced}15` : colors.muted }]}>
          <Feather name="file" size={16} color={linkedInvoice ? colors.invoiced : colors.mutedForeground} />
        </View>
        <View style={styles.documentContent}>
          <Text style={styles.documentTitle}>
            {linkedInvoice ? (linkedInvoice.invoiceNumber || linkedInvoice.number || 'Invoice') : 'No Invoice'}
          </Text>
          {linkedInvoice ? (
            <View style={styles.documentMeta}>
              <Text style={styles.documentAmount}>{formatCurrency(linkedInvoice.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getInvoiceStatusColor(linkedInvoice.status).bg }]}>
                <Text style={[styles.statusText, { color: getInvoiceStatusColor(linkedInvoice.status).text }]}>
                  {linkedInvoice.status || 'Draft'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.documentSubtitle}>
              {jobStatus === 'done' ? 'Job complete - ready to invoice!' : 'Create invoice after job is done'}
            </Text>
          )}
        </View>
        {!linkedInvoice && onCreateInvoice ? (
          <TouchableOpacity style={styles.createButton} onPress={onCreateInvoice}>
            <Text style={styles.createButtonText}>Create Invoice</Text>
          </TouchableOpacity>
        ) : linkedInvoice ? (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        ) : null}
      </TouchableOpacity>

      {/* Receipt Row - only show if invoice is paid and receipt exists */}
      {linkedInvoice?.status?.toLowerCase() === 'paid' && (
        <TouchableOpacity 
          style={[styles.documentRow, linkedReceipt && styles.documentRowClickable]}
          onPress={() => linkedReceipt && onViewReceipt?.(linkedReceipt.id)}
          activeOpacity={linkedReceipt ? 0.7 : 1}
        >
          <View style={[styles.documentIcon, { backgroundColor: linkedReceipt ? `${colors.success}15` : colors.muted }]}>
            <Feather name="check-circle" size={16} color={linkedReceipt ? colors.success : colors.mutedForeground} />
          </View>
          <View style={styles.documentContent}>
            <Text style={styles.documentTitle}>
              {linkedReceipt ? (linkedReceipt.receiptNumber || 'Receipt') : 'No Receipt'}
            </Text>
            {linkedReceipt ? (
              <View style={styles.documentMeta}>
                <Text style={styles.documentAmount}>{formatCurrency(linkedReceipt.amount)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                  <Text style={[styles.statusText, { color: colors.success }]}>
                    {linkedReceipt.paymentMethod || 'Paid'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.documentSubtitle}>Payment received - no receipt created</Text>
            )}
          </View>
          {linkedReceipt ? (
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          ) : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

const createDocumentsStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
    backgroundColor: `${colors.muted}30`,
  },
  documentRowClickable: {
    backgroundColor: `${colors.muted}50`,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  documentSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  documentAmount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  createButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});

interface NextActionCardProps {
  jobStatus: JobStatus;
  hasInvoice: boolean;
  hasQuote: boolean;
  onCreateInvoice?: () => void;
  onCreateQuote?: () => void;
}

export function NextActionCard({
  jobStatus,
  hasInvoice,
  hasQuote,
  onCreateInvoice,
  onCreateQuote,
}: NextActionCardProps) {
  const { colors } = useTheme();
  const styles = createNextActionStyles(colors);

  if (jobStatus === 'done' && !hasInvoice) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Feather name="file-text" size={20} color={colors.destructive} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Create Invoice</Text>
          <Text style={styles.subtitle}>Job is done - time to get paid!</Text>
        </View>
        {onCreateInvoice && (
          <TouchableOpacity style={styles.actionButton} onPress={onCreateInvoice}>
            <Text style={styles.actionButtonText}>Create Invoice</Text>
            <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if ((jobStatus === 'pending' || jobStatus === 'scheduled') && !hasQuote) {
    return (
      <View style={[styles.container, { borderColor: `${colors.scheduled}40`, backgroundColor: `${colors.scheduled}08` }]}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.scheduled}15` }]}>
          <Feather name="file-text" size={20} color={colors.scheduled} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Create Quote</Text>
          <Text style={styles.subtitle}>Send a quote before starting</Text>
        </View>
        {onCreateQuote && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.scheduled }]} 
            onPress={onCreateQuote}
          >
            <Text style={styles.actionButtonText}>Create Quote</Text>
            <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
}

const createNextActionStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.destructive}08`,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.destructive}40`,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.destructive}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
