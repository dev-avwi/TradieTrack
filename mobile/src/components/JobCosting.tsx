import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import { format } from 'date-fns';

interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  rate: number;
  cost: number;
  date: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface JobCostingData {
  jobId: string;
  jobTitle: string;
  revenue: {
    invoiced: number;
    pending: number;
  };
  costs: {
    materials: number;
    labor: number;
    total: number;
  };
  profit: {
    amount: number;
    margin: number;
  };
  estimates?: {
    laborCost: number;
    materialCost: number;
    totalCost: number;
  };
  timeEntries?: TimeEntry[];
  expenses?: Expense[];
}

interface JobCostingProps {
  jobId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  }).format(amount);
}

export function JobCosting({ jobId }: JobCostingProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [costingData, setCostingData] = useState<JobCostingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'time' | 'expenses' | null>(null);

  useEffect(() => {
    loadCostingData();
  }, [jobId]);

  const loadCostingData = async () => {
    try {
      setError(null);
      const response = await api.get(`/api/jobs/${jobId}/profitability`);
      setCostingData(response.data);
    } catch (err: any) {
      console.error('Failed to load costing data:', err);
      setError('Failed to load job costing data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadCostingData();
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: `${colors.success}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.subtitle,
      color: colors.foreground,
    },
    refreshButton: {
      padding: spacing.xs,
    },
    content: {
      padding: spacing.md,
    },
    profitCard: {
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 2,
    },
    profitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profitLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    profitLabelText: {
      ...typography.body,
      fontWeight: '600',
    },
    profitValue: {
      ...typography.h3,
      fontWeight: '700',
    },
    profitMargin: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    rowLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowLabelText: {
      ...typography.body,
      color: colors.foreground,
    },
    rowValue: {
      ...typography.body,
      fontWeight: '600',
      color: colors.foreground,
    },
    estimateValue: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    progressContainer: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    progressText: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.destructive}15`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      gap: 4,
      marginTop: spacing.xs,
    },
    warningText: {
      ...typography.caption,
      color: colors.destructive,
      fontWeight: '600',
    },
    successBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.success}15`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      gap: 4,
      marginTop: spacing.xs,
    },
    successText: {
      ...typography.caption,
      color: colors.success,
      fontWeight: '600',
    },
    expandableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    expandedSection: {
      backgroundColor: `${colors.muted}30`,
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    entryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    entryDescription: {
      ...typography.caption,
      color: colors.foreground,
      flex: 1,
    },
    entryMeta: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    entryAmount: {
      ...typography.caption,
      color: colors.foreground,
      fontWeight: '600',
      minWidth: 70,
      textAlign: 'right',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
    },
    emptySubtext: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    errorContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    errorText: {
      ...typography.body,
      color: colors.destructive,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    retryButtonText: {
      ...typography.body,
      color: colors.primaryForeground,
      fontWeight: '600',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="dollar-sign" size={18} color={colors.success} />
            </View>
            <Text style={styles.headerTitle}>Job Costing</Text>
          </View>
        </View>
        <View style={[styles.content, { alignItems: 'center', paddingVertical: spacing.xl }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="dollar-sign" size={18} color={colors.success} />
            </View>
            <Text style={styles.headerTitle}>Job Costing</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={32} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadCostingData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!costingData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Feather name="dollar-sign" size={18} color={colors.success} />
            </View>
            <Text style={styles.headerTitle}>Job Costing</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.emptyContainer}>
            <Feather name="dollar-sign" size={32} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No costing data</Text>
            <Text style={styles.emptySubtext}>
              Add time entries and expenses to track job costs
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const isProfit = costingData.profit.amount >= 0;
  const profitColor = isProfit ? colors.success : colors.destructive;
  const profitBgColor = isProfit ? `${colors.success}10` : `${colors.destructive}10`;
  const profitBorderColor = isProfit ? `${colors.success}30` : `${colors.destructive}30`;

  const laborEstimate = costingData.estimates?.laborCost || 0;
  const materialEstimate = costingData.estimates?.materialCost || 0;
  const laborPercent = laborEstimate > 0 ? (costingData.costs.labor / laborEstimate) * 100 : 0;
  const materialPercent = materialEstimate > 0 ? (costingData.costs.materials / materialEstimate) * 100 : 0;
  const laborOverBudget = laborPercent > 100;
  const materialOverBudget = materialPercent > 100;

  const timeEntries = costingData.timeEntries || [];
  const expenses = costingData.expenses || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="dollar-sign" size={18} color={colors.success} />
          </View>
          <Text style={styles.headerTitle}>Job Costing</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <Feather 
            name="refresh-cw" 
            size={18} 
            color={isRefreshing ? colors.muted : colors.mutedForeground} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.profitCard, { backgroundColor: profitBgColor, borderColor: profitBorderColor }]}>
          <View style={styles.profitRow}>
            <View style={styles.profitLabel}>
              <Feather 
                name={isProfit ? 'trending-up' : 'trending-down'} 
                size={20} 
                color={profitColor} 
              />
              <Text style={[styles.profitLabelText, { color: profitColor }]}>
                {isProfit ? 'Profit' : 'Loss'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.profitValue, { color: profitColor }]}>
                {formatCurrency(Math.abs(costingData.profit.amount))}
              </Text>
              <Text style={styles.profitMargin}>
                {costingData.profit.margin.toFixed(1)}% margin
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Feather name="file-text" size={16} color={colors.mutedForeground} />
            <Text style={styles.rowLabelText}>Revenue (Invoiced)</Text>
          </View>
          <Text style={styles.rowValue}>{formatCurrency(costingData.revenue.invoiced)}</Text>
        </View>

        {costingData.revenue.pending > 0 && (
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Feather name="clock" size={16} color={colors.mutedForeground} />
              <Text style={styles.rowLabelText}>Pending Revenue</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {formatCurrency(costingData.revenue.pending)}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.expandableRow}
          onPress={() => setExpandedSection(expandedSection === 'time' ? null : 'time')}
        >
          <View style={styles.rowLabel}>
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text style={styles.rowLabelText}>Labour Costs</Text>
            {timeEntries.length > 0 && (
              <Text style={styles.entryMeta}>({timeEntries.length})</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rowValue}>{formatCurrency(costingData.costs.labor)}</Text>
              {laborEstimate > 0 && (
                <Text style={styles.estimateValue}>/ {formatCurrency(laborEstimate)}</Text>
              )}
            </View>
            <Feather 
              name={expandedSection === 'time' ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.mutedForeground} 
            />
          </View>
        </TouchableOpacity>

        {laborEstimate > 0 ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(laborPercent, 100)}%`,
                  backgroundColor: laborOverBudget ? colors.destructive : colors.primary
                }
              ]} />
            </View>
            {laborOverBudget ? (
              <View style={styles.warningBadge}>
                <Feather name="alert-triangle" size={12} color={colors.destructive} />
                <Text style={styles.warningText}>
                  {formatCurrency(costingData.costs.labor - laborEstimate)} over budget
                </Text>
              </View>
            ) : (
              <View style={styles.successBadge}>
                <Feather name="check-circle" size={12} color={colors.success} />
                <Text style={styles.successText}>
                  {formatCurrency(laborEstimate - costingData.costs.labor)} remaining
                </Text>
              </View>
            )}
          </View>
        ) : costingData.costs.labor > 0 && (
          <View style={{ paddingBottom: spacing.xs }}>
            <Text style={[styles.estimateValue, { fontStyle: 'italic' }]}>
              No labour estimate set
            </Text>
          </View>
        )}

        {expandedSection === 'time' && timeEntries.length > 0 && (
          <View style={styles.expandedSection}>
            {timeEntries.map(entry => (
              <View key={entry.id} style={styles.entryItem}>
                <Text style={styles.entryDescription} numberOfLines={1}>
                  {entry.description || 'Time entry'}
                </Text>
                <Text style={styles.entryMeta}>
                  {entry.hours.toFixed(1)}h × {formatCurrency(entry.rate)}
                </Text>
                <Text style={styles.entryAmount}>{formatCurrency(entry.cost)}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={styles.expandableRow}
          onPress={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')}
        >
          <View style={styles.rowLabel}>
            <Feather name="package" size={16} color={colors.mutedForeground} />
            <Text style={styles.rowLabelText}>Material Costs</Text>
            {expenses.length > 0 && (
              <Text style={styles.entryMeta}>({expenses.length})</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rowValue}>{formatCurrency(costingData.costs.materials)}</Text>
              {materialEstimate > 0 && (
                <Text style={styles.estimateValue}>/ {formatCurrency(materialEstimate)}</Text>
              )}
            </View>
            <Feather 
              name={expandedSection === 'expenses' ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.mutedForeground} 
            />
          </View>
        </TouchableOpacity>

        {materialEstimate > 0 ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(materialPercent, 100)}%`,
                  backgroundColor: materialOverBudget ? colors.destructive : colors.primary
                }
              ]} />
            </View>
            {materialOverBudget ? (
              <View style={styles.warningBadge}>
                <Feather name="alert-triangle" size={12} color={colors.destructive} />
                <Text style={styles.warningText}>
                  {formatCurrency(costingData.costs.materials - materialEstimate)} over budget
                </Text>
              </View>
            ) : (
              <View style={styles.successBadge}>
                <Feather name="check-circle" size={12} color={colors.success} />
                <Text style={styles.successText}>
                  {formatCurrency(materialEstimate - costingData.costs.materials)} remaining
                </Text>
              </View>
            )}
          </View>
        ) : costingData.costs.materials > 0 && (
          <View style={{ paddingBottom: spacing.xs }}>
            <Text style={[styles.estimateValue, { fontStyle: 'italic' }]}>
              No material estimate set
            </Text>
          </View>
        )}

        {expandedSection === 'expenses' && expenses.length > 0 && (
          <View style={styles.expandedSection}>
            {expenses.map(expense => (
              <View key={expense.id} style={styles.entryItem}>
                <Text style={styles.entryDescription} numberOfLines={1}>
                  {expense.description}
                </Text>
                <Text style={styles.entryMeta}>{expense.category}</Text>
                <Text style={styles.entryAmount}>{formatCurrency(expense.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.row, styles.lastRow]}>
          <View style={styles.rowLabel}>
            <Feather name="target" size={16} color={colors.mutedForeground} />
            <Text style={styles.rowLabelText}>Total Costs</Text>
          </View>
          <Text style={[styles.rowValue, { fontWeight: '700' }]}>
            {formatCurrency(costingData.costs.total)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
