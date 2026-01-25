import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useClientsStore, useQuotesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors, getVisibleButtonColors } from '../../../src/lib/theme';
import api from '../../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../../src/lib/offline-storage';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { getBottomNavHeight } from '../../../src/components/BottomNav';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stickyHeader: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonPressed: {
      backgroundColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      flex: 1,
      marginLeft: 12,
    },
    totalBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    totalBadgeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: 14,
      padding: 5,
      width: '100%',
      alignSelf: 'stretch',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 10,
      gap: 10,
    },
    tabContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabPressed: {
      opacity: 0.8,
    },
    tabActivePressed: {
      backgroundColor: colors.primaryDark,
    },
    tabText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.foreground,
    },
    tabTextActive: {
      color: colors.primaryForeground,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    editContainer: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingTop: 8,
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardHeaderText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    itemCountBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    itemCountText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectPlaceholder: {
      fontSize: 15,
      color: colors.mutedForeground,
    },
    selectedClient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    clientAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clientAvatarText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    selectedClientText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 80,
      paddingTop: 14,
    },
    dateInputWrapper: {
      position: 'relative',
    },
    dateIcon: {
      position: 'absolute',
      left: 14,
      top: 16,
      zIndex: 1,
    },
    dateInput: {
      paddingLeft: 40,
    },
    inputRow: {
      flexDirection: 'row',
    },
    lineItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    lineItemInfo: {
      flex: 1,
    },
    lineItemDescription: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
      marginBottom: 2,
    },
    lineItemMeta: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    lineItemTotal: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      marginRight: 8,
    },
    lineItemActions: {
      flexDirection: 'row',
      gap: 4,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    addItemButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addItemText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    catalogButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    totalLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
      paddingTop: 12,
    },
    grandTotalLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    grandTotalValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    depositHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleSwitch: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      padding: 2,
      justifyContent: 'center',
    },
    toggleSwitchOn: {
      backgroundColor: colors.primary,
    },
    toggleKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.white,
    },
    toggleKnobOn: {
      alignSelf: 'flex-end',
    },
    depositOptions: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    depositLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 10,
    },
    depositPercentRow: {
      flexDirection: 'row',
      gap: 8,
    },
    depositPercentOption: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: colors.muted,
      borderRadius: 10,
      alignItems: 'center',
    },
    depositPercentSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    depositPercentText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    depositPercentTextSelected: {
      color: colors.primary,
    },
    depositAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      marginTop: 12,
      textAlign: 'center',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      paddingVertical: 16,
      borderWidth: 1,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 12,
      marginBottom: 16,
    },
    createClientButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
    },
    createClientButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
    },
    clientOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    clientOptionAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    clientOptionAvatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    clientOptionInfo: {
      flex: 1,
    },
    clientOptionName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    clientOptionEmail: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    lineTotalPreview: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    lineTotalLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    lineTotalValue: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    saveItemButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveItemButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    previewHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    previewHeadingTitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewHeadingBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.muted,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeadingBadgeText: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
  });
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export default function NewQuoteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string; clientId?: string }>();
  const { user, businessSettings } = useAuthStore();
  const { clients, fetchClients } = useClientsStore();
  const { fetchQuotes } = useQuotesStore();
  const { colors, isDark } = useTheme();
  const { isOnline, pendingSyncCount } = useOfflineStore();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showLineItemEditor, setShowLineItemEditor] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', email: '', phone: '' });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);
  
  const [form, setForm] = useState({
    clientId: params.clientId || '',
    clientName: '',
    title: '',
    description: '',
    notes: '',
    terms: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    quoteDate: new Date().toISOString().split('T')[0],
    requireDeposit: false,
    depositPercent: '50',
  });
  
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editForm, setEditForm] = useState({
    description: '',
    quantity: '1',
    unitPrice: ''
  });

  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  useEffect(() => {
    fetchClients();
  }, []);

  // Auto-fill client when creating quote from job
  useEffect(() => {
    const fetchJobAndSetClient = async () => {
      if (params.jobId && !params.clientId) {
        try {
          const response = await api.get(`/api/jobs/${params.jobId}`);
          if (response.data && response.data.clientId) {
            setForm(prev => ({
              ...prev,
              clientId: response.data.clientId,
            }));
          }
        } catch (error) {
          console.error('Failed to fetch job for client auto-fill:', error);
        }
      }
    };
    fetchJobAndSetClient();
  }, [params.jobId, params.clientId]);

  // Auto-fill client name when clientId is provided via URL params or clients are loaded
  useEffect(() => {
    if (form.clientId && clients.length > 0 && !form.clientName) {
      const client = clients.find(c => c.id === form.clientId);
      if (client) {
        setForm(prev => ({
          ...prev,
          clientName: client.name,
        }));
      }
    }
  }, [form.clientId, clients, form.clientName]);

  const handleAddLineItem = () => {
    setEditForm({ description: '', quantity: '1', unitPrice: '' });
    setEditingItemIndex(-1);
    setShowLineItemEditor(true);
  };

  const handleEditLineItem = (index: number) => {
    const item = lineItems[index];
    setEditForm({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });
    setEditingItemIndex(index);
    setShowLineItemEditor(true);
  };

  const handleSaveLineItem = () => {
    if (!editForm.description.trim()) {
      Alert.alert('Error', 'Please enter a description for this item');
      return;
    }

    if (editingItemIndex === -1) {
      setLineItems([
        ...lineItems,
        { id: Date.now().toString(), ...editForm }
      ]);
    } else if (editingItemIndex !== null) {
      setLineItems(lineItems.map((item, index) => 
        index === editingItemIndex ? { ...item, ...editForm } : item
      ));
    }
    setShowLineItemEditor(false);
    setEditingItemIndex(null);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const gstEnabled = user?.gstEnabled !== false;
  const subtotal = lineItems.reduce(
    (sum, item) => sum + calculateTotal(item.quantity, item.unitPrice), 
    0
  );
  const gst = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const handleSelectClient = (client: any) => {
    setForm({
      ...form,
      clientId: client.id,
      clientName: client.name
    });
    setShowClientPicker(false);
  };

  const handleQuickAddClient = async () => {
    if (!quickAddForm.name.trim()) {
      Alert.alert('Error', 'Please enter a client name');
      return;
    }

    setIsCreatingClient(true);
    try {
      const response = await api.post('/api/clients', {
        name: quickAddForm.name.trim(),
        email: quickAddForm.email.trim() || undefined,
        phone: quickAddForm.phone.trim() || undefined,
      });
      
      await fetchClients();
      
      setForm({
        ...form,
        clientId: response.data.id,
        clientName: response.data.name
      });
      
      setShowQuickAddClient(false);
      setShowClientPicker(false);
      setQuickAddForm({ name: '', email: '', phone: '' });
      
      Alert.alert('Success', `${response.data.name} has been added and selected`);
    } catch (error: any) {
      console.error('Failed to create client:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create client');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const selectedClient = clients.find(c => c.id === form.clientId);

  const handleSave = async () => {
    if (!form.clientId) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    if (!form.title.trim()) {
      Alert.alert('Error', 'Please enter a quote title');
      return;
    }

    if (lineItems.length === 0) {
      Alert.alert('Error', 'Please add at least one line item');
      return;
    }

    setIsLoading(true);
    
    const quoteData = {
      clientId: form.clientId,
      clientName: selectedClient?.name,
      jobId: jobId || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      notes: form.notes.trim() || undefined,
      validUntil: new Date(form.validUntil).toISOString(),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(gst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      depositRequired: form.requireDeposit,
      depositPercent: form.requireDeposit ? parseInt(form.depositPercent) : 0,
      depositAmount: form.requireDeposit ? parseFloat((total * (parseInt(form.depositPercent) / 100)).toFixed(2)) : 0,
      documentTemplate: (businessSettings as any)?.documentTemplate || 'professional',
      documentTemplateSettings: (businessSettings as any)?.documentTemplateSettings || null,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };
    
    // Offline-first: save offline if no connection
    if (!isOnline) {
      try {
        await offlineStorage.saveQuoteOffline(quoteData);
        Alert.alert(
          'Saved Offline', 
          'Quote saved locally and will sync when you\'re back online.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Failed to save quote offline:', error);
        Alert.alert('Error', 'Failed to save quote offline. Please try again.');
      }
      setIsLoading(false);
      return;
    }
    
    // Online: try API first, fallback to offline if network error
    try {
      const response = await api.post('/api/quotes', quoteData);

      if (response.data) {
        await fetchQuotes();
        Alert.alert('Success', 'Quote created successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to create quote');
      }
    } catch (error: any) {
      // Network error - save offline
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        try {
          await offlineStorage.saveQuoteOffline(quoteData);
          Alert.alert(
            'Saved Offline', 
            'Quote saved locally and will sync when connection is restored.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } catch (offlineError) {
          console.error('Failed to save quote offline:', offlineError);
          Alert.alert('Error', 'Failed to save quote. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Failed to create quote. Please try again.');
      }
    }
    setIsLoading(false);
  };

  const handleGenerateAI = async () => {
    if (!aiDescription.trim()) {
      Alert.alert('Error', 'Please describe the job');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const response = await api.post('/api/ai/generate-quote', {
        jobId: jobId || undefined,
        jobDescription: aiDescription.trim(),
      });
      if (response.data && response.data.lineItems) {
        const aiItems = response.data.lineItems.map((item: any) => ({
          id: Date.now().toString() + Math.random(),
          description: item.description,
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unitPrice || 0),
        }));
        setLineItems([...lineItems, ...aiItems]);
        if (response.data.suggestedTitle && !form.title) {
          setForm({ ...form, title: response.data.suggestedTitle });
        }
        setShowAIGenerator(false);
        setAiDescription('');
        Alert.alert('Success', `Added ${aiItems.length} items from AI`);
      } else {
        Alert.alert('Error', response.data?.notes?.[0] || 'Could not generate quote');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate quote. Please try again.');
    }
    setIsGeneratingAI(false);
  };

  const handleOpenCatalog = async () => {
    setShowCatalog(true);
    setIsLoadingCatalog(true);
    try {
      const response = await api.get('/api/catalog');
      if (response.data) {
        setCatalogItems(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load catalog');
    }
    setIsLoadingCatalog(false);
  };

  const handleAddCatalogItem = (catalogItem: any) => {
    setLineItems([...lineItems, {
      id: Date.now().toString(),
      description: catalogItem.name || catalogItem.description,
      quantity: '1',
      unitPrice: String(catalogItem.price || catalogItem.unitPrice || 0),
    }]);
    setShowCatalog(false);
  };

  const businessInfo = {
    businessName: businessSettings?.businessName || user?.businessName || 'Your Business',
    abn: businessSettings?.abn,
    email: businessSettings?.email || user?.email,
    phone: businessSettings?.phone,
    address: businessSettings?.address,
    logoUrl: businessSettings?.logoUrl,
    brandColor: businessSettings?.brandColor,
  };

  const clientInfo = selectedClient ? {
    name: selectedClient.name,
    email: selectedClient.email,
    phone: selectedClient.phone,
    address: selectedClient.address,
  } : null;

  const previewLineItems = lineItems.map(item => ({
    description: item.description,
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Sticky Header with Back + Title + Total */}
        <View style={styles.stickyHeader}>
          <View style={styles.headerRow}>
            <Pressable 
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]} 
              onPress={() => router.back()}
            >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
            <Text style={styles.headerTitle}>New Quote</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{formatCurrency(total)}</Text>
            </View>
          </View>
          
          {/* Tab Switcher */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: 10,
            padding: 4,
            width: '100%',
          }}>
            <Pressable
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                gap: 8,
                backgroundColor: activeTab === 'edit' ? colors.primary : 'transparent',
              }}
              onPress={() => setActiveTab('edit')}
            >
              <Feather 
                name="edit-2" 
                size={16} 
                color={activeTab === 'edit' ? colors.primaryForeground : colors.foreground} 
              />
              <Text style={{
                fontSize: 15,
                fontWeight: '600',
                color: activeTab === 'edit' ? colors.primaryForeground : colors.foreground,
              }}>
                Edit
              </Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                gap: 8,
                backgroundColor: activeTab === 'preview' ? colors.primary : 'transparent',
              }}
              onPress={() => setActiveTab('preview')}
            >
              <Feather 
                name="eye" 
                size={16} 
                color={activeTab === 'preview' ? colors.primaryForeground : colors.foreground} 
              />
              <Text style={{
                fontSize: 15,
                fontWeight: '600',
                color: activeTab === 'preview' ? colors.primaryForeground : colors.foreground,
              }}>
                Preview
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Preview Mode */}
        {activeTab === 'preview' && (
          <View style={[styles.previewContainer, { paddingBottom: bottomNavHeight }]}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.mutedForeground,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Live Preview
              </Text>
              <View style={{
                backgroundColor: colors.muted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: colors.mutedForeground,
                }}>
                  Updates as you type
                </Text>
              </View>
            </View>
            <LiveDocumentPreview
              type="quote"
              title={form.title}
              description={form.description}
              date={form.quoteDate}
              validUntil={form.validUntil}
              lineItems={previewLineItems}
              notes={form.notes}
              terms={form.terms}
              business={businessInfo}
              client={clientInfo}
              gstEnabled={user?.gstEnabled !== false}
              showDepositSection={form.requireDeposit}
              depositPercent={parseInt(form.depositPercent) || 50}
              templateId={(businessSettings as any)?.documentTemplate || 'minimal'}
              templateCustomization={(businessSettings as any)?.documentTemplateSettings}
            />
          </View>
        )}

        {/* Edit Mode */}
        {activeTab === 'edit' && (
          <KeyboardAvoidingView 
            style={styles.editContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 20 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Client Selection Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="user" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Client</Text>
                </View>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowClientPicker(true)}
                >
                  {form.clientId ? (
                    <View style={styles.selectedClient}>
                      <View style={styles.clientAvatar}>
                        <Text style={styles.clientAvatarText}>
                          {(selectedClient?.name || form.clientName || 'Select Client').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.selectedClientText}>{selectedClient?.name || form.clientName || 'Select Client'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.selectPlaceholder}>Tap to select a client...</Text>
                  )}
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Quote Details Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Quote Details</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(text) => setForm({ ...form, title: text })}
                    placeholder="e.g., Bathroom Renovation"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={form.description}
                    onChangeText={(text) => setForm({ ...form, description: text })}
                    placeholder="Brief description of the work..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Valid Until</Text>
                  <View style={styles.dateInputWrapper}>
                    <Feather name="calendar" size={16} color={colors.mutedForeground} style={styles.dateIcon} />
                    <TextInput
                      style={[styles.input, styles.dateInput]}
                      value={form.validUntil}
                      onChangeText={(text) => setForm({ ...form, validUntil: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>
              </View>

              {/* Line Items Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeader}>
                    <Feather name="package" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Line Items</Text>
                  </View>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>
                      {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>

                {lineItems.map((item, index) => {
                  const itemTotal = calculateTotal(item.quantity, item.unitPrice);
                  return (
                    <View key={item.id} style={styles.lineItemRow}>
                      <View style={styles.lineItemInfo}>
                        <Text style={styles.lineItemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                        <Text style={styles.lineItemMeta}>
                          {item.quantity} × {formatCurrency(parseFloat(item.unitPrice) || 0)}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>{formatCurrency(itemTotal)}</Text>
                      <View style={styles.lineItemActions}>
                        <TouchableOpacity 
                          style={styles.iconButton}
                          onPress={() => handleEditLineItem(index)}
                        >
                          <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.iconButton}
                          onPress={() => removeLineItem(index)}
                        >
                          <Feather name="trash-2" size={14} color={colors.destructive} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.addButtonsRow}>
                  <TouchableOpacity
                    style={styles.addItemButton}
                    onPress={handleAddLineItem}
                  >
                    <Feather name="plus" size={16} color={colors.foreground} />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.catalogButton}
                    onPress={handleOpenCatalog}
                  >
                    <Feather name="book-open" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.catalogButton, { backgroundColor: colors.primaryLight }]}
                    onPress={() => setShowAIGenerator(true)}
                  >
                    <Feather name="zap" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Totals Card */}
              {lineItems.length > 0 && (
                <View style={styles.totalsCard}>
                  {gstEnabled ? (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>GST (10%)</Text>
                        <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                      </View>
                      <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.grandTotalLabel}>Total (inc. GST)</Text>
                        <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.totalRow}>
                      <Text style={styles.grandTotalLabel}>Total</Text>
                      <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Deposit Card */}
              <View style={styles.card}>
                <View style={styles.depositHeader}>
                  <View style={styles.cardHeader}>
                    <Feather name="dollar-sign" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Require Deposit</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleSwitch, form.requireDeposit && styles.toggleSwitchOn]}
                    onPress={() => setForm({ ...form, requireDeposit: !form.requireDeposit })}
                  >
                    <View style={[styles.toggleKnob, form.requireDeposit && styles.toggleKnobOn]} />
                  </TouchableOpacity>
                </View>
                {form.requireDeposit && (
                  <View style={styles.depositOptions}>
                    <Text style={styles.depositLabel}>Deposit Amount</Text>
                    <View style={styles.depositPercentRow}>
                      {['25', '50', '75'].map((percent) => (
                        <TouchableOpacity
                          key={percent}
                          style={[
                            styles.depositPercentOption,
                            form.depositPercent === percent && styles.depositPercentSelected
                          ]}
                          onPress={() => setForm({ ...form, depositPercent: percent })}
                        >
                          <Text style={[
                            styles.depositPercentText,
                            form.depositPercent === percent && styles.depositPercentTextSelected
                          ]}>
                            {percent}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.depositAmount}>
                      Deposit: {formatCurrency(total * (parseInt(form.depositPercent) / 100))}
                    </Text>
                  </View>
                )}
              </View>

              {/* Terms Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Terms & Conditions</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.terms}
                  onChangeText={(text) => setForm({ ...form, terms: text })}
                  placeholder="Terms, conditions, or notes for the client..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button - Uses business primary color */}
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isLoading ? 0.6 : 1,
                }}
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: '600' }}>Create Quote</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowClientPicker(false);
          setShowQuickAddClient(false);
          setQuickAddForm({ name: '', email: '', phone: '' });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showQuickAddClient ? 'Quick Add Client' : 'Select Client'}</Text>
            <TouchableOpacity onPress={() => {
              if (showQuickAddClient) {
                setShowQuickAddClient(false);
                setQuickAddForm({ name: '', email: '', phone: '' });
              } else {
                setShowClientPicker(false);
              }
            }}>
              <Feather name={showQuickAddClient ? 'arrow-left' : 'x'} size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          
          {showQuickAddClient ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <ScrollView style={styles.modalContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Client Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.name}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, name: text })}
                    placeholder="e.g. John Smith"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.email}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, email: text })}
                    placeholder="john@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.phone}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, phone: text })}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveItemButton, { opacity: isCreatingClient ? 0.6 : 1 }]}
                  onPress={handleQuickAddClient}
                  disabled={isCreatingClient}
                >
                  {isCreatingClient ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveItemButtonText}>Add & Select Client</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <ScrollView style={styles.modalContent}>
              {/* Quick Add Client Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.primaryLight,
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 16,
                  gap: 10,
                }}
                onPress={() => setShowQuickAddClient(true)}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="user-plus" size={18} color={colors.primaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>Quick Add Client</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Create a new client without leaving this screen</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.primary} />
              </TouchableOpacity>

              {clients.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="user" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateText}>No clients found</Text>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                    Use Quick Add above to create your first client
                  </Text>
                </View>
              ) : (
                clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={styles.clientOption}
                    onPress={() => handleSelectClient(client)}
                  >
                    <View style={styles.clientOptionAvatar}>
                      <Text style={styles.clientOptionAvatarText}>
                        {client.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clientOptionInfo}>
                      <Text style={styles.clientOptionName}>{client.name}</Text>
                      {client.email && (
                        <Text style={styles.clientOptionEmail}>{client.email}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Line Item Editor Modal */}
      <Modal
        visible={showLineItemEditor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLineItemEditor(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingItemIndex === -1 ? 'Add Item' : 'Edit Item'}
            </Text>
            <TouchableOpacity onPress={() => setShowLineItemEditor(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={editForm.description}
                onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                placeholder="What are you quoting for?"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.quantity}
                  onChangeText={(text) => setEditForm({ ...editForm, quantity: text })}
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.inputLabel}>Unit Price ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.unitPrice}
                  onChangeText={(text) => setEditForm({ ...editForm, unitPrice: text })}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.lineTotalPreview}>
              <Text style={styles.lineTotalLabel}>Line Total</Text>
              <Text style={styles.lineTotalValue}>
                {formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveItemButton}
              onPress={handleSaveLineItem}
            >
              <Text style={styles.saveItemButtonText}>
                {editingItemIndex === -1 ? 'Add Item' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Generator Modal */}
      <Modal
        visible={showAIGenerator}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIGenerator(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Quote Generator</Text>
            <TouchableOpacity onPress={() => setShowAIGenerator(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }}>
              Describe the job and AI will generate quote line items with realistic pricing.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Job Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { minHeight: 120 }]}
                value={aiDescription}
                onChangeText={setAiDescription}
                placeholder="e.g., Full bathroom renovation including new tiles, toilet, vanity and shower..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[styles.saveItemButton, isGeneratingAI && { opacity: 0.6 }]}
              onPress={handleGenerateAI}
              disabled={isGeneratingAI}
            >
              {isGeneratingAI ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="zap" size={18} color={colors.white} />
                  <Text style={styles.saveItemButtonText}>Generate Quote Items</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Catalog Picker Modal */}
      <Modal
        visible={showCatalog}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCatalog(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Product Catalog</Text>
            <TouchableOpacity onPress={() => setShowCatalog(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {isLoadingCatalog ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : catalogItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="book-open" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyStateText}>No catalog items found</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>
                  Add items to your catalog from the web app
                </Text>
              </View>
            ) : (
              catalogItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.clientOption}
                  onPress={() => handleAddCatalogItem(item)}
                >
                  <View style={[styles.clientOptionAvatar, { backgroundColor: colors.muted }]}>
                    <Feather name="package" size={18} color={colors.foreground} />
                  </View>
                  <View style={styles.clientOptionInfo}>
                    <Text style={styles.clientOptionName}>{item.name || item.description}</Text>
                    <Text style={styles.clientOptionEmail}>
                      {formatCurrency(item.price || item.unitPrice || 0)}
                    </Text>
                  </View>
                  <Feather name="plus" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
