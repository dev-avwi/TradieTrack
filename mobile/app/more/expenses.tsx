import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';

interface Expense {
  id: string;
  jobId: string | null;
  categoryId: string;
  amount: string;
  gstAmount: string | null;
  description: string;
  vendor: string | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  expenseDate: string;
  isBillable: boolean;
  status: string;
  categoryName?: string;
  jobTitle?: string;
  createdAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Job {
  id: string;
  title: string;
  status: string;
  clientName?: string;
}

type FilterKey = 'all' | string;

const formatCurrency = (amount: number | string) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount);
};

function ExpenseCard({
  expense,
  onPress,
  onDelete,
}: {
  expense: Expense;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AnimatedCardPressable onPress={onPress} style={styles.expenseCard}>
      <View style={[styles.expenseCardAccent, { backgroundColor: colors.destructive }]} />
      <View style={styles.expenseCardContent}>
        <View style={styles.expenseCardHeader}>
          <View style={styles.expenseHeaderLeft}>
            <Text style={styles.expenseDescription} numberOfLines={1}>{expense.description}</Text>
            {expense.categoryName && (
              <View style={[styles.categoryBadge, { backgroundColor: colors.primaryLight }]}>
                <Feather name="tag" size={10} color={colors.primary} />
                <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                  {expense.categoryName}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.expenseTotal, { color: colors.destructive }]}>
            -{formatCurrency(expense.amount)}
          </Text>
        </View>

        <View style={styles.expenseDetails}>
          {expense.vendor && (
            <View style={styles.expenseDetailRow}>
              <Feather name="shopping-bag" size={12} color={colors.mutedForeground} />
              <Text style={styles.expenseDetailText} numberOfLines={1}>{expense.vendor}</Text>
            </View>
          )}
          {expense.jobTitle && (
            <View style={styles.expenseDetailRow}>
              <Feather name="briefcase" size={12} color={colors.mutedForeground} />
              <Text style={styles.expenseDetailText} numberOfLines={1}>{expense.jobTitle}</Text>
            </View>
          )}
          <View style={styles.expenseDetailRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.expenseDetailText} numberOfLines={1}>
              {expense.expenseDate
                ? format(new Date(expense.expenseDate), 'dd MMM yyyy')
                : 'No date'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={14} color={colors.destructive} />
      </TouchableOpacity>
    </AnimatedCardPressable>
  );
}

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { jobId: routeJobId } = useLocalSearchParams<{ jobId?: string }>();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [filterByJobId, setFilterByJobId] = useState<string | null>(routeJobId || null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);

  const [formCategoryId, setFormCategoryId] = useState('');
  const [formJobId, setFormJobId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formReceiptNumber, setFormReceiptNumber] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.append('categoryId', activeFilter);
      if (filterByJobId) params.append('jobId', filterByJobId);

      const [expensesRes, categoriesRes, jobsRes] = await Promise.all([
        api.get<Expense[]>(`/api/expenses?${params.toString()}`),
        api.get<ExpenseCategory[]>('/api/expense-categories'),
        api.get<Job[]>('/api/jobs'),
      ]);
      setExpenses(expensesRes.data || []);
      setCategories(categoriesRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, filterByJobId]);

  useEffect(() => {
    fetchData();
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const resetForm = () => {
    setFormCategoryId('');
    setFormJobId(routeJobId || '');
    setFormAmount('');
    setFormGst('');
    setFormDescription('');
    setFormVendor('');
    setFormReceiptNumber('');
    setFormDate(new Date());
    setScannedImageUri(null);
    setIsScanning(false);
  };

  const handleAmountChange = (value: string) => {
    setFormAmount(value);
    const amount = parseFloat(value) || 0;
    setFormGst((amount * 0.1).toFixed(2));
  };

  const handleScanReceipt = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to scan receipts.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library access is needed to scan receipts.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setScannedImageUri(asset.uri);
      setIsScanning(true);
      setShowExpenseModal(true);

      try {
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
        const scanRes = await api.post<any>('/api/expenses/scan-receipt', { image: base64Image });

        if (scanRes.data) {
          const data = scanRes.data;
          if (data.total) {
            const totalStr = String(data.total);
            setFormAmount(totalStr);
            const gst = data.gst ? String(data.gst) : (parseFloat(totalStr) * 0.1).toFixed(2);
            setFormGst(gst);
          }
          if (data.vendor) setFormVendor(data.vendor);
          if (data.lineItems?.length > 0) {
            const desc = data.lineItems.map((item: any) => item.description).filter(Boolean).join(', ');
            if (desc) setFormDescription(desc);
          }
          if (data.date) setFormDate(new Date(data.date));

          Alert.alert('Receipt Scanned', 'Fields pre-filled from receipt. Review and save.');
        }
      } catch (err: any) {
        Alert.alert('Scan Failed', err.message || 'Could not read receipt. Fill in manually.');
      } finally {
        setIsScanning(false);
      }
    } catch (err) {
      setIsScanning(false);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const handleSubmitExpense = async () => {
    if (!formDescription.trim()) {
      Alert.alert('Required', 'Please enter a description');
      return;
    }
    if (!formAmount.trim() || isNaN(parseFloat(formAmount))) {
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }
    if (!formCategoryId) {
      Alert.alert('Required', 'Please select a category');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/expenses', {
        categoryId: formCategoryId,
        jobId: formJobId || undefined,
        amount: formAmount,
        gstAmount: formGst || '0.00',
        description: formDescription.trim(),
        vendor: formVendor.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        receiptUrl: scannedImageUri || undefined,
        expenseDate: formDate.toISOString(),
        isBillable: true,
      });
      setShowExpenseModal(false);
      resetForm();
      fetchData();
      Alert.alert('Success', 'Expense recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/api/expense-categories', {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        isActive: true,
      });
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      fetchData();
      Alert.alert('Success', 'Category created');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/expenses/${id}`);
            fetchData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete expense');
          }
        },
      },
    ]);
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const count = expenses.length;
    return { total, count };
  }, [expenses]);

  const categoryFilters = useMemo(() => {
    const filters: { key: string; label: string; count: number }[] = [
      { key: 'all', label: 'All', count: expenses.length },
    ];
    categories.forEach((cat) => {
      const count = expenses.filter((e) => e.categoryId === cat.id).length;
      filters.push({ key: cat.id, label: cat.name, count });
    });
    return filters;
  }, [categories, expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        expense.description?.toLowerCase().includes(searchLower) ||
        (expense.vendor || '').toLowerCase().includes(searchLower) ||
        (expense.categoryName || '').toLowerCase().includes(searchLower) ||
        (expense.jobTitle || '').toLowerCase().includes(searchLower);
      return matchesSearch;
    });
  }, [expenses, searchQuery]);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(a.expenseDate || a.createdAt).getTime();
    const dateB = new Date(b.expenseDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    sortedExpenses.forEach((exp) => {
      const key = format(new Date(exp.expenseDate || exp.createdAt), 'dd MMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups);
  }, [sortedExpenses]);

  const selectedCategoryName = categories.find((c) => c.id === formCategoryId)?.name || 'Select Category';
  const selectedJobName = jobs.find((j) => j.id === formJobId)?.title || 'No Job';

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
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>{filterByJobId ? 'Job Expenses' : 'Expenses'}</Text>
              <Text style={styles.pageSubtitle}>
                {filterByJobId 
                  ? (jobs.find(j => j.id === filterByJobId)?.title || 'Filtered by job')
                  : 'Track costs across all your jobs'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {filterByJobId && (
            <TouchableOpacity 
              onPress={() => setFilterByJobId(null)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, marginBottom: spacing.sm }}
            >
              <Feather name="x-circle" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>Show all expenses</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
            onPress={() => {
              Alert.alert(
                'AI Receipt Scanner',
                'Take a photo of a receipt or invoice and AI will automatically extract the vendor, amount, GST, date and line items.',
                [
                  { text: 'Take Photo', onPress: () => handleScanReceipt('camera') },
                  { text: 'Choose from Library', onPress: () => handleScanReceipt('library') },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Feather name="camera" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>Scan Receipt with AI</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                Photo a receipt to auto-extract vendor, amount, GST & items
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                resetForm();
                setShowExpenseModal(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>Record Expense</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>TOTAL EXPENSES</Text>
            <Text style={[styles.overviewValue, { color: colors.foreground }]}>{formatCurrency(stats.total)}</Text>
            <Text style={[styles.overviewSubtext, { color: colors.mutedForeground }]}>
              {stats.count} expense{stats.count !== 1 ? 's' : ''} recorded
            </Text>
          </View>

          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.kpiIconRow}>
                <Feather name="tag" size={14} color={colors.info} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Categories</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{categories.length}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.kpiIconRow}>
                <Feather name="briefcase" size={14} color={colors.warning} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Linked Jobs</Text>
              </View>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                {new Set(expenses.filter((e) => e.jobId).map((e) => e.jobId)).size}
              </Text>
            </View>
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search expenses..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {categoryFilters.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.7}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {filter.label}
                  </Text>
                  <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                      {filter.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.7}
              style={[styles.filterPill, { borderStyle: 'dashed' as any }]}
            >
              <Feather name="plus" size={12} color={colors.mutedForeground} />
              <Text style={styles.filterPillText}>Add Category</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="trending-down" size={iconSizes.md} color={colors.destructive} />
              <Text style={styles.sectionTitle}>
                {filteredExpenses.length} EXPENSE{filteredExpenses.length !== 1 ? 'S' : ''}
              </Text>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sortedExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="dollar-sign" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No expenses found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Record your first expense or scan a receipt to get started'}
                </Text>
              </View>
            ) : (
              <View style={styles.expensesList}>
                {groupedExpenses.map(([dateLabel, dateExpenses]) => (
                  <View key={dateLabel}>
                    <Text style={[styles.dateGroupLabel, { color: colors.mutedForeground }]}>{dateLabel}</Text>
                    {dateExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        onPress={() => {}}
                        onDelete={() => handleDeleteExpense(expense.id)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={showExpenseModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowExpenseModal(false);
            resetForm();
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity
                onPress={() => {
                  setShowExpenseModal(false);
                  resetForm();
                }}
              >
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Record Expense</Text>
              <TouchableOpacity onPress={handleSubmitExpense} disabled={isSubmitting}>
                <Text style={[styles.modalSave, { color: isSubmitting ? colors.mutedForeground : colors.primary }]}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {isScanning && (
                <View style={[styles.scanningBanner, { backgroundColor: colors.primaryLight, borderColor: colors.promoBorder }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <View>
                    <Text style={[styles.scanningTitle, { color: colors.foreground }]}>Reading receipt...</Text>
                    <Text style={[styles.scanningSubtitle, { color: colors.mutedForeground }]}>
                      AI is extracting details
                    </Text>
                  </View>
                </View>
              )}

              {scannedImageUri && !isScanning && (
                <View style={[styles.receiptPreview, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Image source={{ uri: scannedImageUri }} style={styles.receiptImage} />
                  <View>
                    <Text style={[styles.receiptAttachedText, { color: colors.foreground }]}>Receipt attached</Text>
                    <Text style={[styles.receiptHintText, { color: colors.mutedForeground }]}>Review pre-filled fields</Text>
                  </View>
                </View>
              )}

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.mutedForeground}
                  value={formDescription}
                  onChangeText={setFormDescription}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Amount (AUD) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={formAmount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>GST</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.cardBorder, color: colors.mutedForeground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={formGst}
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Category *</Text>
                <TouchableOpacity
                  style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={{ color: formCategoryId ? colors.foreground : colors.mutedForeground }}>
                    {selectedCategoryName}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Job (Optional)</Text>
                <TouchableOpacity
                  style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => setShowJobPicker(true)}
                >
                  <Text style={{ color: formJobId ? colors.foreground : colors.mutedForeground }}>
                    {selectedJobName}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Vendor</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="e.g., Bunnings"
                  placeholderTextColor={colors.mutedForeground}
                  value={formVendor}
                  onChangeText={setFormVendor}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Date</Text>
                  <TouchableOpacity
                    style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Feather name="calendar" size={14} color={colors.mutedForeground} />
                    <Text style={{ color: colors.foreground }}>{format(formDate, 'dd MMM yyyy')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Receipt #</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    value={formReceiptNumber}
                    onChangeText={setFormReceiptNumber}
                  />
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setFormDate(date);
                  }}
                />
              )}

              {!scannedImageUri && (
                <TouchableOpacity
                  style={[styles.scanButton, { borderColor: colors.cardBorder }]}
                  onPress={() => {
                    Alert.alert('Scan Receipt', 'Choose source', [
                      { text: 'Camera', onPress: () => handleScanReceipt('camera') },
                      { text: 'Photo Library', onPress: () => handleScanReceipt('library') },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="camera" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.scanButtonText, { color: colors.mutedForeground }]}>
                    Scan Receipt to Auto-Fill
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={showCategoryModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Category</Text>
              <TouchableOpacity onPress={handleCreateCategory} disabled={isSubmitting}>
                <Text style={[styles.modalSave, { color: isSubmitting ? colors.mutedForeground : colors.primary }]}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalScrollContent}>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Category Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="e.g., Materials, Fuel, Tools"
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                />
              </View>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="Describe what this category covers..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryDescription}
                  onChangeText={setNewCategoryDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showCategoryPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Category</Text>
              <TouchableOpacity onPress={() => {
                setShowCategoryPicker(false);
                setShowCategoryModal(true);
              }}>
                <Feather name="plus" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.length === 0 ? (
                <View style={styles.emptyPicker}>
                  <Text style={[styles.emptyPickerText, { color: colors.mutedForeground }]}>
                    No categories yet. Create one first.
                  </Text>
                  <TouchableOpacity
                    style={[styles.emptyPickerButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setShowCategoryPicker(false);
                      setShowCategoryModal(true);
                    }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Add Category</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      formCategoryId === cat.id && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => {
                      setFormCategoryId(cat.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={styles.pickerItemContent}>
                      <Feather name="tag" size={16} color={formCategoryId === cat.id ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{cat.name}</Text>
                    </View>
                    {formCategoryId === cat.id && (
                      <Feather name="check" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        <Modal
          visible={showJobPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowJobPicker(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity onPress={() => setShowJobPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Job</Text>
              <View style={{ width: 20 }} />
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  { borderBottomColor: colors.border },
                  !formJobId && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  setFormJobId('');
                  setShowJobPicker(false);
                }}
              >
                <View style={styles.pickerItemContent}>
                  <Feather name="minus-circle" size={16} color={!formJobId ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.pickerItemText, { color: colors.foreground }]}>No Job</Text>
                </View>
                {!formJobId && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    formJobId === job.id && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => {
                    setFormJobId(job.id);
                    setShowJobPicker(false);
                  }}
                >
                  <View style={styles.pickerItemContent}>
                    <Feather name="briefcase" size={16} color={formJobId === job.id ? colors.primary : colors.mutedForeground} />
                    <View>
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{job.title}</Text>
                      {job.clientName && (
                        <Text style={[styles.pickerItemSubtext, { color: colors.mutedForeground }]}>{job.clientName}</Text>
                      )}
                    </View>
                  </View>
                  {formJobId === job.id && <Feather name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: pageShell.paddingTop,
      paddingBottom: pageShell.paddingBottom,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
      paddingTop: spacing.sm,
    },
    headerLeft: {
      flex: 1,
    },
    pageTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
    },
    pageSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
    backButton: {
      padding: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    actionButtonText: {
      ...typography.button,
    },
    overviewCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
    },
    overviewLabel: {
      ...typography.label,
      marginBottom: spacing.xs,
    },
    overviewValue: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    overviewSubtext: {
      ...typography.caption,
    },
    kpiGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    kpiCard: {
      flex: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
    },
    kpiIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    kpiLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      height: sizes.searchBarHeight,
      marginBottom: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.foreground,
    },
    filtersScroll: {
      marginBottom: spacing.lg,
      marginHorizontal: -pageShell.paddingHorizontal,
    },
    filtersContent: {
      paddingHorizontal: pageShell.paddingHorizontal,
      gap: spacing.sm,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: spacing.xs,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      ...typography.captionSmall,
      fontWeight: '500',
      color: colors.foreground,
    },
    filterPillTextActive: {
      color: colors.primaryForeground,
    },
    filterCount: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.sm,
      minWidth: sizes.filterCountMin,
      alignItems: 'center',
    },
    filterCountActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterCountText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.foreground,
    },
    filterCountTextActive: {
      color: colors.primaryForeground,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.foreground,
      letterSpacing: 0.5,
    },
    loadingContainer: {
      paddingVertical: spacing['3xl'],
      alignItems: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['4xl'],
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    emptyStateIcon: {
      marginBottom: spacing.lg,
    },
    emptyStateTitle: {
      ...typography.subtitle,
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    emptyStateSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
    expensesList: {
      gap: spacing.md,
    },
    dateGroupLabel: {
      ...typography.label,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    expenseCard: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    expenseCardAccent: {
      width: 4,
    },
    expenseCardContent: {
      flex: 1,
      padding: spacing.md,
    },
    expenseCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    expenseHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    expenseDescription: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      flex: 1,
    },
    expenseTotal: {
      fontSize: 16,
      fontWeight: '700',
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      gap: 4,
    },
    categoryBadgeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    expenseDetails: {
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    expenseDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    expenseDetailText: {
      fontSize: 13,
      color: colors.mutedForeground,
      flex: 1,
    },
    deleteButton: {
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
    },
    modalCancel: {
      ...typography.body,
      fontWeight: '500',
    },
    modalTitle: {
      ...typography.cardTitle,
    },
    modalSave: {
      ...typography.body,
      fontWeight: '600',
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    scanningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    scanningTitle: {
      ...typography.bodySemibold,
    },
    scanningSubtitle: {
      ...typography.caption,
    },
    receiptPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    receiptImage: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
    },
    receiptAttachedText: {
      ...typography.bodySemibold,
    },
    receiptHintText: {
      ...typography.caption,
    },
    formSection: {
      marginBottom: spacing.lg,
    },
    formRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    formHalf: {
      flex: 1,
    },
    formLabel: {
      ...typography.caption,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      height: sizes.inputHeight,
      ...typography.body,
    },
    textArea: {
      height: 88,
      paddingTop: spacing.md,
      textAlignVertical: 'top',
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    scanButtonText: {
      ...typography.body,
      fontWeight: '500',
    },
    emptyPicker: {
      alignItems: 'center',
      paddingVertical: spacing['4xl'],
      paddingHorizontal: spacing.lg,
    },
    emptyPickerText: {
      ...typography.body,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    emptyPickerButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
    },
    pickerItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    pickerItemText: {
      ...typography.body,
      fontWeight: '500',
    },
    pickerItemSubtext: {
      ...typography.caption,
      marginTop: 2,
    },
  });
