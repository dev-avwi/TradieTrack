import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useJobsStore } from '../../src/lib/store';

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface Expense {
  id: string;
  categoryId: string;
  jobId?: string;
  amount: string;
  gstAmount?: string;
  description: string;
  vendor?: string;
  receiptNumber?: string;
  expenseDate: string;
  isBillable: boolean;
  createdAt: string;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  statTitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  filters: {
    paddingVertical: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    color: colors.foreground,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  addCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginLeft: spacing.sm,
    marginRight: spacing.lg,
  },
  addCategoryText: {
    ...typography.caption,
    color: colors.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  expenseItem: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  categoryBadgeText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '500',
  },
  vendorText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  expenseAmounts: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  expenseGst: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expenseFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  expenseDateText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  deleteIconButton: {
    padding: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categorySelect: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryOptionText: {
    ...typography.caption,
    color: colors.foreground,
  },
  categoryOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing['2xl'],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default function ExpenseTrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs } = useJobsStore();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<string>('all');
  
  const [newExpense, setNewExpense] = useState({
    categoryId: '',
    jobId: '',
    amount: '',
    description: '',
    vendor: '',
  });
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, expRes] = await Promise.all([
        api.get<ExpenseCategory[]>('/api/expense-categories'),
        api.get<Expense[]>('/api/expenses'),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (expRes.data) setExpenses(expRes.data);
      await fetchJobs();
    } catch (error) {
      console.log('Error fetching data:', error);
    }
    setIsLoading(false);
  }, [fetchJobs]);

  useEffect(() => {
    fetchData();
  }, []);

  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const thisMonthExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.expenseDate);
    const now = new Date();
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  }).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  const filteredExpenses = expenses.filter(exp => {
    const categoryMatch = selectedCategory === 'all' || exp.categoryId === selectedCategory;
    const jobMatch = selectedJob === 'all' || exp.jobId === selectedJob;
    return categoryMatch && jobMatch;
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getJobTitle = (jobId?: string) => {
    if (!jobId) return undefined;
    return jobs.find(j => j.id === jobId)?.title;
  };

  const handleAddExpense = async () => {
    if (!newExpense.categoryId || !newExpense.amount || !newExpense.description) {
      Alert.alert('Required Fields', 'Please fill in category, amount and description');
      return;
    }
    
    setIsSaving(true);
    try {
      const gstAmount = (parseFloat(newExpense.amount) * 0.1).toFixed(2);
      const response = await api.post<Expense>('/api/expenses', {
        ...newExpense,
        gstAmount,
        expenseDate: new Date().toISOString(),
        isBillable: true,
      });
      if (response.data) {
        setExpenses(prev => [response.data!, ...prev]);
        setShowAddModal(false);
        setNewExpense({ categoryId: '', jobId: '', amount: '', description: '', vendor: '' });
        Alert.alert('Success', 'Expense recorded');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense');
    }
    setIsSaving(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      Alert.alert('Required', 'Category name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await api.post<ExpenseCategory>('/api/expense-categories', {
        ...newCategory,
        isActive: true,
      });
      if (response.data) {
        setCategories(prev => [...prev, response.data!]);
        setShowCategoryModal(false);
        setNewCategory({ name: '', description: '' });
        Alert.alert('Success', 'Category created');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create category');
    }
    setIsSaving(false);
  };

  const handleDeleteExpense = (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/expenses/${id}`);
            setExpenses(prev => prev.filter(e => e.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete expense');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Expense Tracking</Text>
              <Text style={styles.headerSubtitle}>Monitor business expenses</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="dollar-sign" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>${totalExpenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.statTitle}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
                <Feather name="trending-up" size={20} color={colors.success} />
              </View>
              <Text style={styles.statValue}>${thisMonthExpenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.statTitle}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.warningLight }]}>
                <Feather name="folder" size={20} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{categories.length}</Text>
              <Text style={styles.statTitle}>Categories</Text>
            </View>
          </View>

          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[styles.filterText, selectedCategory === cat.id && styles.filterTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addCategoryChip}
                onPress={() => setShowCategoryModal(true)}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={styles.addCategoryText}>Add Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Expenses ({filteredExpenses.length})</Text>
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map(expense => {
                const amount = parseFloat(expense.amount) || 0;
                const gst = parseFloat(expense.gstAmount || '0') || 0;
                const category = categories.find(c => c.id === expense.categoryId);
                const jobTitle = getJobTitle(expense.jobId);
                
                return (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={styles.expenseHeader}>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseDescription}>{expense.description}</Text>
                        <View style={styles.expenseMeta}>
                          {category && (
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>{category.name}</Text>
                            </View>
                          )}
                          {expense.vendor && (
                            <Text style={styles.vendorText}>{expense.vendor}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.expenseAmounts}>
                        <Text style={styles.expenseAmount}>${amount.toFixed(2)}</Text>
                        {gst > 0 && (
                          <Text style={styles.expenseGst}>+${gst.toFixed(2)} GST</Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.expenseFooter}>
                      <View style={styles.expenseFooterLeft}>
                        <Feather name="calendar" size={12} color={colors.mutedForeground} />
                        <Text style={styles.expenseDateText}>
                          {new Date(expense.expenseDate).toLocaleDateString('en-AU')}
                        </Text>
                        {jobTitle && (
                          <>
                            <Feather name="briefcase" size={12} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
                            <Text style={styles.expenseDateText}>{jobTitle}</Text>
                          </>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteExpense(expense.id)} style={styles.deleteIconButton}>
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyStateTitle}>No Expenses</Text>
                <Text style={styles.emptyStateText}>
                  Tap + to record your first expense
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <Modal visible={showAddModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Record Expense</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelect}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryOption,
                        newExpense.categoryId === cat.id && styles.categoryOptionSelected
                      ]}
                      onPress={() => setNewExpense({ ...newExpense, categoryId: cat.id })}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newExpense.categoryId === cat.id && styles.categoryOptionTextSelected
                      ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Amount (AUD) *</Text>
                <TextInput
                  style={styles.input}
                  value={newExpense.amount}
                  onChangeText={text => setNewExpense({ ...newExpense, amount: text })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={styles.input}
                  value={newExpense.description}
                  onChangeText={text => setNewExpense({ ...newExpense, description: text })}
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Vendor (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newExpense.vendor}
                  onChangeText={text => setNewExpense({ ...newExpense, vendor: text })}
                  placeholder="e.g., Bunnings"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Job (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelect}>
                  <TouchableOpacity
                    style={[styles.categoryOption, !newExpense.jobId && styles.categoryOptionSelected]}
                    onPress={() => setNewExpense({ ...newExpense, jobId: '' })}
                  >
                    <Text style={[styles.categoryOptionText, !newExpense.jobId && styles.categoryOptionTextSelected]}>
                      No Job
                    </Text>
                  </TouchableOpacity>
                  {jobs.slice(0, 10).map(job => (
                    <TouchableOpacity
                      key={job.id}
                      style={[
                        styles.categoryOption,
                        newExpense.jobId === job.id && styles.categoryOptionSelected
                      ]}
                      onPress={() => setNewExpense({ ...newExpense, jobId: job.id })}
                    >
                      <Text 
                        style={[
                          styles.categoryOptionText,
                          newExpense.jobId === job.id && styles.categoryOptionTextSelected
                        ]}
                        numberOfLines={1}
                      >
                        {job.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleAddExpense}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Record Expense</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showCategoryModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Category Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newCategory.name}
                  onChangeText={text => setNewCategory({ ...newCategory, name: text })}
                  placeholder="e.g., Materials, Fuel, Tools"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={newCategory.description}
                  onChangeText={text => setNewCategory({ ...newCategory, description: text })}
                  placeholder="What kind of expenses go here?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowCategoryModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleAddCategory}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Category</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
