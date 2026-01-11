import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL, api } from '../../src/lib/api';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import AppTour from '../../src/components/AppTour';
import { Slider } from '../../src/components/ui/Slider';

const PLAN_FEATURES = [
  { icon: 'briefcase', text: 'Unlimited jobs, quotes & invoices', pro: true },
  { icon: 'star', text: 'AI-powered suggestions', pro: true },
  { icon: 'sliders', text: 'Custom branding & theming', pro: true },
  { icon: 'users', text: 'Team management & permissions', pro: true },
  { icon: 'mail', text: 'Automated email reminders', pro: true },
  { icon: 'help-circle', text: 'Priority support', pro: true },
];

const SETTINGS_TABS = [
  { key: 'account', label: 'Account', icon: 'user' },
  { key: 'brand', label: 'Brand', icon: 'palette' },
  { key: 'templates', label: 'Templates', icon: 'file-text' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'plan', label: 'Plan', icon: 'award' },
  { key: 'help', label: 'Help', icon: 'help-circle' },
];

const BRAND_COLORS = [
  '#3B5998', '#1877F2', '#0A66C2', '#2563EB', '#3B82F6',
  '#059669', '#10B981', '#22C55E', '#84CC16', '#EAB308',
  '#F59E0B', '#F97316', '#EF4444', '#DC2626', '#E11D48',
  '#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#6366F1',
  '#475569', '#334155', '#1E293B', '#0F172A', '#000000',
];

const GEOFENCE_STORAGE_KEY = '@tradietrack/global_geofence_settings';
const NOTIFICATION_SETTINGS_KEY = '@tradietrack/notification_settings';
const BRAND_SETTINGS_KEY = '@tradietrack/brand_settings';

interface NotificationSettings {
  push: {
    newJobAssignments: boolean;
    jobStatusChanges: boolean;
    paymentReceived: boolean;
    quoteAccepted: boolean;
    teamMessages: boolean;
  };
  email: {
    dailyDigest: boolean;
    weeklySummary: boolean;
    paymentReceipts: boolean;
    overdueReminders: boolean;
  };
  sms: {
    urgentJobAlerts: boolean;
    paymentConfirmations: boolean;
  };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  push: {
    newJobAssignments: true,
    jobStatusChanges: true,
    paymentReceived: true,
    quoteAccepted: true,
    teamMessages: true,
  },
  email: {
    dailyDigest: false,
    weeklySummary: true,
    paymentReceipts: true,
    overdueReminders: true,
  },
  sms: {
    urgentJobAlerts: false,
    paymentConfirmations: false,
  },
};

interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
  };
  sections: {
    showHeader?: boolean;
    showLineItems?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showSignature?: boolean;
  };
  defaults: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
    dueTermDays?: number;
    gstEnabled?: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  unit: string;
}

interface NewTemplate {
  name: string;
  type: 'quote' | 'invoice' | 'job';
  tradeType: string;
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    gstEnabled: boolean;
  };
  defaultLineItems: LineItem[];
}

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman', 'general'
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subscriptionLinkText: {
    flex: 1,
  },
  subscriptionLinkTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  subscriptionLinkSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabsScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  planSection: {
    gap: spacing.lg,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  planDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  planPriceBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  planPriceText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  proFeaturesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  proBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  manageBillingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  manageBillingText: {
    ...typography.body,
    color: colors.foreground,
  },
  tabContentSection: {
    gap: spacing.lg,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingsCardInfo: {
    flex: 1,
  },
  settingsCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  settingsCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  settingsInfoCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  settingsInfoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  settingsInfoText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  notificationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationToggleRowLast: {
    borderBottomWidth: 0,
  },
  notificationToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  notificationToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationToggleInfo: {
    flex: 1,
  },
  notificationToggleTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  notificationToggleSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.foreground,
  },
  logoSection: {
    marginTop: spacing.lg,
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  uploadButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  templateStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  templateStatCard: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  templateStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 2,
  },
  templateStatLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  templateList: {
    gap: spacing.md,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  templateType: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    textTransform: 'capitalize',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTrade: {
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  templateDetails: {
    marginTop: spacing.sm,
  },
  templateTitle: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  badge: {
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTerms: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  createTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  createTemplateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg + 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: spacing.md + 2,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  typeButtonTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tradeChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  tradeChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lineItemInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItemQty: {
    width: 60,
  },
  lineItemPrice: {
    width: 80,
  },
  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addLineItemText: {
    fontSize: 14,
    color: colors.primary,
  },
  removeLineItemButton: {
    padding: spacing.sm,
    justifyContent: 'center',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
});

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings, user, refreshUser, updateBusinessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [showTour, setShowTour] = useState(false);
  
  // Account tab - Geofence settings
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [autoClockIn, setAutoClockIn] = useState(true);
  const [autoClockOut, setAutoClockOut] = useState(true);

  // Brand tab settings
  const [selectedColor, setSelectedColor] = useState('#3B5998');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Templates tab
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quote' | 'invoice' | 'job'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    type: 'quote',
    tradeType: 'general',
    defaults: {
      title: '',
      description: '',
      terms: '',
      depositPct: 0,
      gstEnabled: true,
    },
    defaultLineItems: []
  });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Load geofence settings
  const loadGeofenceSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setGeofenceEnabled(settings.enabled ?? false);
        setGeofenceRadius(settings.radius ?? 100);
        setAutoClockIn(settings.autoClockIn ?? true);
        setAutoClockOut(settings.autoClockOut ?? true);
      }
    } catch (error) {
      console.error('Failed to load geofence settings:', error);
    }
  }, []);

  const saveGeofenceSettings = useCallback(async (settings: {
    enabled: boolean;
    radius: number;
    autoClockIn: boolean;
    autoClockOut: boolean;
  }) => {
    try {
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save geofence settings:', error);
    }
  }, []);

  const handleGeofenceEnabledChange = useCallback((value: boolean) => {
    setGeofenceEnabled(value);
    saveGeofenceSettings({ enabled: value, radius: geofenceRadius, autoClockIn, autoClockOut });
  }, [saveGeofenceSettings, geofenceRadius, autoClockIn, autoClockOut]);

  const handleRadiusChange = useCallback((value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    setGeofenceRadius(numValue);
  }, []);

  const handleRadiusChangeComplete = useCallback((value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: numValue, autoClockIn, autoClockOut });
  }, [saveGeofenceSettings, geofenceEnabled, autoClockIn, autoClockOut]);

  const handleAutoClockInChange = useCallback((value: boolean) => {
    setAutoClockIn(value);
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: geofenceRadius, autoClockIn: value, autoClockOut });
  }, [saveGeofenceSettings, geofenceEnabled, geofenceRadius, autoClockOut]);

  const handleAutoClockOutChange = useCallback((value: boolean) => {
    setAutoClockOut(value);
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: geofenceRadius, autoClockIn, autoClockOut: value });
  }, [saveGeofenceSettings, geofenceEnabled, geofenceRadius, autoClockIn]);

  // Load brand settings - prioritize server businessSettings, fallback to local storage
  const loadBrandSettings = useCallback(async () => {
    try {
      // First try to use server-synced business settings
      if (businessSettings?.brandColor || businessSettings?.logoUrl) {
        setSelectedColor(businessSettings.brandColor || '#3B5998');
        setLogoUrl(businessSettings.logoUrl || null);
        // Also save locally for offline access
        await AsyncStorage.setItem(BRAND_SETTINGS_KEY, JSON.stringify({ 
          color: businessSettings.brandColor || '#3B5998', 
          logoUrl: businessSettings.logoUrl || null 
        }));
        return;
      }
      // Fallback to local storage
      const stored = await AsyncStorage.getItem(BRAND_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setSelectedColor(settings.color || '#3B5998');
        setLogoUrl(settings.logoUrl || null);
      }
    } catch (error) {
      console.error('Failed to load brand settings:', error);
    }
  }, [businessSettings]);

  const saveBrandSettings = useCallback(async (color: string, logo: string | null) => {
    try {
      // Save locally first for immediate feedback
      await AsyncStorage.setItem(BRAND_SETTINGS_KEY, JSON.stringify({ color, logoUrl: logo }));
      
      // Sync to server
      const success = await updateBusinessSettings({ 
        brandColor: color, 
        logoUrl: logo || undefined 
      });
      
      if (!success) {
        console.error('Failed to sync brand settings to server');
      }
    } catch (error) {
      console.error('Failed to save brand settings:', error);
    }
  }, [updateBusinessSettings]);

  const handleColorSelect = useCallback((color: string) => {
    setSelectedColor(color);
    saveBrandSettings(color, logoUrl);
  }, [saveBrandSettings, logoUrl]);

  const handlePickLogo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingLogo(true);
        const localUri = result.assets[0].uri;
        
        // Upload to server
        const response = await api.uploadBusinessLogo(localUri);
        
        if (response.data?.logoUrl) {
          const serverLogoUrl = response.data.logoUrl;
          setLogoUrl(serverLogoUrl);
          await saveBrandSettings(selectedColor, serverLogoUrl);
        } else {
          Alert.alert('Upload Failed', response.error || 'Failed to upload logo to server.');
          // Fallback to local URI for preview if server fails? 
          // Better to keep it consistent and only use server URLs if possible
        }
        
        setIsUploadingLogo(false);
      }
    } catch (error) {
      console.error('Failed to pick logo:', error);
      setIsUploadingLogo(false);
      Alert.alert('Error', 'Failed to upload logo. Please try again.');
    }
  }, [selectedColor, saveBrandSettings]);

  // Notification settings handlers
  const loadNotificationSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored) as NotificationSettings;
        setNotificationSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }, []);

  const saveNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }, []);

  const updatePushSetting = useCallback((key: keyof NotificationSettings['push'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, push: { ...prev.push, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateEmailSetting = useCallback((key: keyof NotificationSettings['email'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, email: { ...prev.email, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateSmsSetting = useCallback((key: keyof NotificationSettings['sms'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, sms: { ...prev.sms, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  // Templates handlers
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const authToken = await api.getToken();
      const url = `${API_URL}/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
    setTemplatesLoading(false);
  }, [typeFilter]);

  const resetTemplateForm = () => {
    setNewTemplate({
      name: '',
      type: 'quote',
      tradeType: 'general',
      defaults: {
        title: '',
        description: '',
        terms: '',
        depositPct: 0,
        gstEnabled: true,
      },
      defaultLineItems: []
    });
    setEditingTemplate(null);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const authToken = await api.getToken();
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate 
        ? `${API_URL}/api/templates/${editingTemplate.id}`
        : `${API_URL}/api/templates`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newTemplate.name,
          type: newTemplate.type,
          tradeType: newTemplate.tradeType,
          familyKey: newTemplate.tradeType,
          defaults: newTemplate.defaults,
          defaultLineItems: newTemplate.defaultLineItems.filter(item => item.description.trim()),
          styling: {},
          sections: {
            showHeader: true,
            showLineItems: true,
            showTotals: true,
            showTerms: true,
            showSignature: false,
          },
        }),
      });

      if (response.ok) {
        await loadTemplates();
        setShowCreateModal(false);
        resetTemplateForm();
        Alert.alert('Success', editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      } else {
        const error = await response.text();
        Alert.alert('Error', error || 'Failed to save template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setIsCreatingTemplate(false);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      type: template.type,
      tradeType: template.tradeType,
      defaults: {
        title: template.defaults?.title || '',
        description: template.defaults?.description || '',
        terms: template.defaults?.terms || '',
        depositPct: template.defaults?.depositPct || 0,
        gstEnabled: template.defaults?.gstEnabled ?? true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setShowCreateModal(true);
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          type: template.type,
          tradeType: template.tradeType,
          familyKey: template.familyKey,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
          styling: template.styling,
          sections: template.sections,
        }),
      });

      if (response.ok) {
        await loadTemplates();
        Alert.alert('Success', 'Template duplicated successfully');
      } else {
        Alert.alert('Error', 'Failed to duplicate template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleDeleteTemplate = (template: DocumentTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const authToken = await api.getToken();
              const response = await fetch(`${API_URL}/api/templates/${template.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (response.ok) {
                await loadTemplates();
                Alert.alert('Success', 'Template deleted');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        }
      ]
    );
  };

  const addLineItem = () => {
    setNewTemplate({
      ...newTemplate,
      defaultLineItems: [
        ...newTemplate.defaultLineItems,
        { description: '', qty: 1, unitPrice: 0, unit: 'each' }
      ]
    });
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const items = [...newTemplate.defaultLineItems];
    items[index] = { ...items[index], [field]: value };
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const removeLineItem = (index: number) => {
    const items = newTemplate.defaultLineItems.filter((_, i) => i !== index);
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const quoteTemplates = templates.filter(t => t.type === 'quote').length;
  const invoiceTemplates = templates.filter(t => t.type === 'invoice').length;
  const jobTemplates = templates.filter(t => t.type === 'job').length;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote': return colors.info;
      case 'invoice': return colors.success;
      case 'job': return colors.warning;
      default: return colors.primary;
    }
  };

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      refreshUser(),
      loadGeofenceSettings(), 
      loadNotificationSettings(),
      loadBrandSettings(),
      loadTemplates(),
    ]);
    setIsLoading(false);
  }, [refreshUser, loadGeofenceSettings, loadNotificationSettings, loadBrandSettings, loadTemplates]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [typeFilter, activeTab]);

  const currentPlan = (user?.subscriptionTier || 'free') as 'free' | 'pro' | 'team' | 'trial';

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Settings</Text>
              <Text style={styles.pageSubtitle}>Manage your business profile and preferences</Text>
            </View>
            <TouchableOpacity style={styles.saveButton} data-testid="button-save-settings">
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.subscriptionLink}
            onPress={() => router.push('/more/subscription')}
            data-testid="button-manage-subscription"
          >
            <View style={styles.subscriptionLinkContent}>
              <Feather name="award" size={20} color={colors.primary} />
              <View style={styles.subscriptionLinkText}>
                <Text style={styles.subscriptionLinkTitle}>Manage Subscription</Text>
                <Text style={styles.subscriptionLinkSubtitle}>View plan details, usage & billing</Text>
              </View>
            </View>
            <Feather name="external-link" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  data-testid={`tab-${tab.key}`}
                >
                  <Feather 
                    name={tab.icon as any}
                    size={16} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'account' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="map-pin" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Geofence Settings</Text>
                </View>

                <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Feather name="target" size={16} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureText}>Enable Geofence for New Jobs</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>Auto-enable location tracking on new jobs</Text>
                    </View>
                  </View>
                  <Switch
                    value={geofenceEnabled}
                    onValueChange={handleGeofenceEnabledChange}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={geofenceEnabled ? colors.primary : colors.mutedForeground}
                    data-testid="switch-geofence-enabled"
                  />
                </View>

                {geofenceEnabled && (
                  <>
                    <View style={{ marginTop: spacing.lg }}>
                      <Text style={styles.settingsCardTitle}>Default Radius: {geofenceRadius}m</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>
                        Distance from job site to trigger clock-in/out
                      </Text>
                      <Slider
                        value={geofenceRadius}
                        onValueChange={handleRadiusChange}
                        onSlidingComplete={handleRadiusChangeComplete}
                        minimumValue={50}
                        maximumValue={500}
                        step={10}
                        style={{ marginTop: spacing.md }}
                      />
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between', marginTop: spacing.lg }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-in" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-In</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Automatically start time when entering geofence</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockIn}
                        onValueChange={handleAutoClockInChange}
                        trackColor={{ false: colors.muted, true: colors.primaryLight }}
                        thumbColor={autoClockIn ? colors.primary : colors.mutedForeground}
                        data-testid="switch-auto-clock-in"
                      />
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-out" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-Out</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Automatically stop time when leaving geofence</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockOut}
                        onValueChange={handleAutoClockOutChange}
                        trackColor={{ false: colors.muted, true: colors.primaryLight }}
                        thumbColor={autoClockOut ? colors.primary : colors.mutedForeground}
                        data-testid="switch-auto-clock-out"
                      />
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/business-settings')}
                data-testid="button-business-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="briefcase" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Business Details</Text>
                    <Text style={styles.settingsCardSubtitle}>Update your business information</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/profile-edit')}
                data-testid="button-profile-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="user" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Profile Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Manage your personal information</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'brand' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="droplet" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>App Color</Text>
                </View>
                <Text style={styles.planDescription}>
                  Choose a brand color for your app theme
                </Text>

                <View style={styles.colorGrid}>
                  {BRAND_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorSwatchSelected
                      ]}
                      onPress={() => handleColorSelect(color)}
                      data-testid={`color-swatch-${color.replace('#', '')}`}
                    >
                      {selectedColor === color && (
                        <Feather name="check" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="image" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Business Logo</Text>
                </View>
                <Text style={styles.planDescription}>
                  Upload your business logo to personalize documents
                </Text>

                <View style={styles.logoSection}>
                  <View style={styles.logoPreview}>
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                    ) : (
                      <Feather name="image" size={32} color={colors.mutedForeground} />
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handlePickLogo}
                    disabled={isUploadingLogo}
                    data-testid="button-upload-logo"
                  >
                    <Feather name="upload" size={18} color={colors.primary} />
                    <Text style={styles.uploadButtonText}>
                      {isUploadingLogo ? 'Uploading...' : (logoUrl ? 'Change Logo' : 'Upload Logo')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Brand Customization</Text>
                <Text style={styles.settingsInfoText}>
                  Your brand color and logo will appear on quotes, invoices, and other documents sent to clients.
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Quick Actions</Text>
              
              <TouchableOpacity
                style={styles.settingsCard}
                onPress={() => router.push('/more/templates')}
                data-testid="button-document-templates"
              >
                <View style={styles.settingsCardHeader}>
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
                    <Feather name="file-text" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Document Templates</Text>
                    <Text style={styles.settingsCardSubtitle}>Customise quote & invoice styling</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsCard}
                onPress={() => router.push('/more/ai-assistant')}
                data-testid="button-ai-assistant"
              >
                <View style={styles.settingsCardHeader}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                    <Feather name="cpu" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>AI Assistant</Text>
                    <Text style={styles.settingsCardSubtitle}>Smart suggestions & automation</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsCard}
                onPress={() => router.push('/more/automations')}
                data-testid="button-automations"
              >
                <View style={styles.settingsCardHeader}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="zap" size={18} color="#D97706" />
                  </View>
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Automations</Text>
                    <Text style={styles.settingsCardSubtitle}>Reminders, follow-ups & triggers</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'templates' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity
                style={styles.settingsCard}
                onPress={() => router.push('/more/templates')}
                data-testid="button-full-templates"
              >
                <View style={styles.settingsCardHeader}>
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
                    <Feather name="file-text" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Document Templates</Text>
                    <Text style={styles.settingsCardSubtitle}>Quote, invoice & job styling with live preview</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsCard}
                onPress={() => router.push('/more/business-templates')}
                data-testid="button-safety-forms"
              >
                <View style={styles.settingsCardHeader}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="shield" size={18} color="#D97706" />
                  </View>
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Safety Forms & WHS</Text>
                    <Text style={styles.settingsCardSubtitle}>Compliance templates, checklists & permits</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Quick Templates</Text>

              <TouchableOpacity
                style={styles.createTemplateButton}
                onPress={() => {
                  resetTemplateForm();
                  setShowCreateModal(true);
                }}
                data-testid="button-create-template"
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
                <Text style={styles.createTemplateButtonText}>Create New Template</Text>
              </TouchableOpacity>

              <View style={styles.templateStatsRow}>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{quoteTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Quotes</Text>
                </View>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{invoiceTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Invoices</Text>
                </View>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{jobTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Jobs</Text>
                </View>
              </View>

              <View style={styles.filtersRow}>
                {(['all', 'quote', 'invoice', 'job'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      typeFilter === type && styles.filterChipActive
                    ]}
                    onPress={() => setTypeFilter(type)}
                    data-testid={`filter-${type}`}
                  >
                    <Text style={[
                      styles.filterChipText,
                      typeFilter === type && styles.filterChipTextActive
                    ]}>
                      {type === 'all' ? 'All Types' : type + 's'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {templatesLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : templates.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="file-text" size={48} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No templates yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Create templates to speed up creating quotes, invoices, and jobs
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => {
                      resetTemplateForm();
                      setShowCreateModal(true);
                    }}
                  >
                    <Feather name="plus" size={18} color={colors.primary} />
                    <Text style={styles.emptyButtonText}>Create First Template</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.templateList}>
                  {templates.map(template => (
                    <View key={template.id} style={styles.templateCard}>
                      <View style={styles.templateHeader}>
                        <View style={styles.templateInfo}>
                          <Text style={styles.templateName}>{template.name}</Text>
                          <View style={styles.templateMeta}>
                            <Text style={[styles.templateType, { backgroundColor: getTypeColor(template.type) + '20', color: getTypeColor(template.type) }]}>
                              {template.type}
                            </Text>
                            <Text style={styles.templateTrade}>{template.tradeType}</Text>
                          </View>
                        </View>
                        <View style={styles.templateActions}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleEditTemplate(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Feather name="edit-2" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDuplicateTemplate(template)}
                            data-testid={`button-duplicate-template-${template.id}`}
                          >
                            <Feather name="copy" size={18} color={colors.mutedForeground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteTemplate(template)}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Feather name="trash-2" size={18} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={styles.templateDetails}>
                        {template.defaults?.title && (
                          <Text style={styles.templateTitle} numberOfLines={1}>
                            {template.defaults.title}
                          </Text>
                        )}
                        
                        <View style={styles.badgeRow}>
                          {template.defaultLineItems?.length > 0 && (
                            <Text style={styles.badge}>
                              {template.defaultLineItems.length} line items
                            </Text>
                          )}
                          {(template.defaults?.depositPct ?? 0) > 0 && (
                            <Text style={styles.badge}>
                              {template.defaults.depositPct}% deposit
                            </Text>
                          )}
                          {template.defaults?.gstEnabled && (
                            <Text style={styles.badge}>GST</Text>
                          )}
                        </View>

                        {template.defaults?.terms && (
                          <Text style={styles.templateTerms} numberOfLines={2}>
                            {template.defaults.terms}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'alerts' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="smartphone" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Push Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="briefcase" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>New Job Assignments</Text>
                      <Text style={styles.notificationToggleSubtitle}>Get notified when assigned to a job</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.newJobAssignments}
                    onValueChange={(value) => updatePushSetting('newJobAssignments', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.newJobAssignments ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-new-job"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="refresh-cw" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Job Status Changes</Text>
                      <Text style={styles.notificationToggleSubtitle}>Updates when job status changes</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.jobStatusChanges}
                    onValueChange={(value) => updatePushSetting('jobStatusChanges', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.jobStatusChanges ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-job-status"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="dollar-sign" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Received</Text>
                      <Text style={styles.notificationToggleSubtitle}>Alert when a payment is received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.paymentReceived}
                    onValueChange={(value) => updatePushSetting('paymentReceived', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.paymentReceived ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-payment"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#f59e0b20' }]}>
                      <Feather name="check-circle" size={16} color="#f59e0b" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Quote Accepted</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notify when client accepts a quote</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.quoteAccepted}
                    onValueChange={(value) => updatePushSetting('quoteAccepted', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.quoteAccepted ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-quote"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                      <Feather name="message-circle" size={16} color="#8b5cf6" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Team Messages</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notifications for team chat messages</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.teamMessages}
                    onValueChange={(value) => updatePushSetting('teamMessages', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.teamMessages ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-team"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Email Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="sun" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Daily Digest</Text>
                      <Text style={styles.notificationToggleSubtitle}>Daily summary of activity</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.dailyDigest}
                    onValueChange={(value) => updateEmailSetting('dailyDigest', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.dailyDigest ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-daily"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Weekly Summary</Text>
                      <Text style={styles.notificationToggleSubtitle}>Weekly business overview email</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.weeklySummary}
                    onValueChange={(value) => updateEmailSetting('weeklySummary', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.weeklySummary ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-weekly"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="file-text" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Receipts</Text>
                      <Text style={styles.notificationToggleSubtitle}>Email receipt when payment received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.paymentReceipts}
                    onValueChange={(value) => updateEmailSetting('paymentReceipts', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.paymentReceipts ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-receipts"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-circle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Overdue Reminders</Text>
                      <Text style={styles.notificationToggleSubtitle}>Reminders for overdue invoices</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.overdueReminders}
                    onValueChange={(value) => updateEmailSetting('overdueReminders', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.overdueReminders ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-overdue"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="message-square" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>SMS Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-triangle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Urgent Job Alerts</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS for urgent job notifications</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.urgentJobAlerts}
                    onValueChange={(value) => updateSmsSetting('urgentJobAlerts', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.sms.urgentJobAlerts ? colors.primary : colors.mutedForeground}
                    data-testid="switch-sms-urgent"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="check-square" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Confirmations</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS when payments are confirmed</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.paymentConfirmations}
                    onValueChange={(value) => updateSmsSetting('paymentConfirmations', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.sms.paymentConfirmations ? colors.primary : colors.mutedForeground}
                    data-testid="switch-sms-payment"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/notifications')}
                data-testid="button-notification-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="settings" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Advanced Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Manage device permissions and inbox</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Stay Informed</Text>
                <Text style={styles.settingsInfoText}>
                  Configure how and when you receive notifications about jobs, payments, and team activity. SMS notifications may incur additional charges.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'plan' && (
            <View style={styles.planSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="award" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Your Subscription</Text>
                </View>

                <View style={styles.planInfo}>
                  <View style={styles.planBadge}>
                    <View style={styles.planIconContainer}>
                      <Feather 
                        name={currentPlan === 'team' ? 'users' : currentPlan === 'pro' || currentPlan === 'trial' ? 'star' : 'user'} 
                        size={22} 
                        color={colors.primary} 
                      />
                    </View>
                    <View>
                      <Text style={styles.planName}>
                        {currentPlan === 'team' ? 'Team Plan' : currentPlan === 'pro' ? 'Pro Plan' : currentPlan === 'trial' ? 'Pro Trial' : 'Free Plan'}
                      </Text>
                      <Text style={styles.planDescription}>
                        {currentPlan === 'team' ? 'Full team management features' : currentPlan === 'pro' || currentPlan === 'trial' ? 'Full access to all features' : 'Basic features'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.planPriceBadge}>
                    <Text style={styles.planPriceText}>
                      {currentPlan === 'team' ? '$49/mo' : currentPlan === 'pro' ? '$29/mo' : currentPlan === 'trial' ? 'Trial' : 'Free'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.proFeaturesTitle}>PRO FEATURES</Text>

                {PLAN_FEATURES.map((feature, index) => {
                  const isPaidPlan = currentPlan === 'pro' || currentPlan === 'team' || currentPlan === 'trial';
                  return (
                    <View key={index} style={styles.featureRow}>
                      <Feather 
                        name={feature.icon as any} 
                        size={18} 
                        color={isPaidPlan ? colors.primary : colors.mutedForeground} 
                      />
                      <Text style={[
                        styles.featureText,
                        !isPaidPlan && { color: colors.mutedForeground }
                      ]}>
                        {feature.text}
                      </Text>
                      {feature.pro && !isPaidPlan && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                      {isPaidPlan && (
                        <Feather name="check" size={18} color={colors.primary} />
                      )}
                    </View>
                  );
                })}

                {currentPlan === 'free' && (
                  <TouchableOpacity 
                    style={styles.upgradeButton}
                    onPress={() => router.push('/more/subscription')}
                    data-testid="button-upgrade"
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                )}

                {(currentPlan === 'pro' || currentPlan === 'team') && (
                  <TouchableOpacity 
                    style={styles.manageBillingButton}
                    onPress={() => router.push('/more/subscription')}
                  >
                    <Feather name="external-link" size={16} color={colors.foreground} />
                    <Text style={styles.manageBillingText}>Manage Billing</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {activeTab === 'help' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity 
                style={[styles.settingsCard, { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => setShowTour(true)}
                data-testid="button-start-tour"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="compass" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Start App Tour</Text>
                    <Text style={styles.settingsCardSubtitle}>Quick walkthrough of the app</Text>
                  </View>
                </View>
                <Feather name="play-circle" size={18} color={colors.primary} />
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>TAP TO PAY ON IPHONE</Text>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/tap-to-pay-setup?showTutorial=true')}
                data-testid="button-tap-to-pay-tutorial"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="radio" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>View Tap to Pay Tutorial</Text>
                    <Text style={styles.settingsCardSubtitle}>Learn how to accept contactless payments</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/tap-to-pay-setup')}
                data-testid="button-tap-to-pay-status"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="check-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Check Tap to Pay Status</Text>
                    <Text style={styles.settingsCardSubtitle}>View setup and T&C acceptance status</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('https://support.apple.com/en-au/HT212944')}
                data-testid="button-tap-to-pay-faq"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="help-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Apple Tap to Pay FAQ</Text>
                    <Text style={styles.settingsCardSubtitle}>Official support from Apple</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>SUPPORT</Text>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('mailto:support@tradietrack.com.au')}
                data-testid="button-contact-support"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Contact Support</Text>
                    <Text style={styles.settingsCardSubtitle}>support@tradietrack.com.au</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('https://tradietrack.com/help')}
                data-testid="button-help-centre"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="help-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Help Centre</Text>
                    <Text style={styles.settingsCardSubtitle}>Guides, FAQs, and tutorials</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Need Help?</Text>
                <Text style={styles.settingsInfoText}>
                  Our support team is available Monday to Friday, 9am-5pm AEST. We typically respond within 24 hours.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => {
                  setShowCreateModal(false);
                  resetTemplateForm();
                }} 
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Name</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.name}
                  onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
                  placeholder="e.g., Standard Plumbing Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Type</Text>
                <View style={styles.typeButtons}>
                  {(['quote', 'invoice', 'job'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newTemplate.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, type })}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newTemplate.type === type && styles.typeButtonTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trade Type</Text>
                <View style={styles.tradeTypeContainer}>
                  {tradeTypes.map((trade) => (
                    <TouchableOpacity
                      key={trade}
                      style={[
                        styles.tradeChip,
                        newTemplate.tradeType === trade && styles.tradeChipActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, tradeType: trade })}
                    >
                      <Text style={[
                        styles.tradeChipText,
                        newTemplate.tradeType === trade && styles.tradeChipTextActive
                      ]}>
                        {trade}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.sectionHeader}>Default Values</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Title</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.defaults.title}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, title: text } 
                  })}
                  placeholder="e.g., Plumbing Service Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.description}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, description: text } 
                  })}
                  placeholder="Brief description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Terms</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.terms}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, terms: text } 
                  })}
                  placeholder="Payment terms, conditions..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Deposit (%)</Text>
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  value={String(newTemplate.defaults.depositPct || '')}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, depositPct: parseInt(text) || 0 } 
                  })}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.sectionHeader}>Default Line Items</Text>

              {newTemplate.defaultLineItems.map((item, index) => (
                <View key={index} style={styles.lineItemRow}>
                  <TextInput
                    style={styles.lineItemInput}
                    value={item.description}
                    onChangeText={(text) => updateLineItem(index, 'description', text)}
                    placeholder="Description"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemQty]}
                    value={String(item.qty || '')}
                    onChangeText={(text) => updateLineItem(index, 'qty', parseInt(text) || 1)}
                    placeholder="Qty"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemPrice]}
                    value={String(item.unitPrice || '')}
                    onChangeText={(text) => updateLineItem(index, 'unitPrice', parseFloat(text) || 0)}
                    placeholder="Price"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.removeLineItemButton}
                    onPress={() => removeLineItem(index)}
                  >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addLineItemButton}
                onPress={addLineItem}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.addLineItemText}>Add Line Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isCreatingTemplate && styles.modalSaveButtonDisabled]}
                onPress={handleCreateTemplate}
                disabled={isCreatingTemplate}
              >
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.modalSaveButtonText}>
                  {isCreatingTemplate ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Modal>

        <AppTour 
          visible={showTour} 
          onClose={() => setShowTour(false)} 
        />
      </View>
    </>
  );
}
