import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Linking,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Image,
  FlatList,
  Switch,
  KeyboardAvoidingView,
  Dimensions,
  Animated,
  Easing,
  AppState,
  AppStateStatus,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Slider } from '../../src/components/ui/Slider';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { IOSBackButton } from '../../src/components/ui/IOSBackButton';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api, { API_URL } from '../../src/lib/api';
import { useJobsStore, useTimeTrackingStore, useAuthStore } from '../../src/lib/store';
import { Button } from '../../src/components/ui/Button';
import { AIPhotoAnalysisModal } from '../../src/components/AIPhotoAnalysis';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';
import { VoiceRecorder, VoiceNotePlayer } from '../../src/components/VoiceRecorder';
import { SignaturePad } from '../../src/components/SignaturePad';
import { JobForms } from '../../src/components/FormRenderer';
import { SmartAction, getJobSmartActions } from '../../src/components/SmartActionsPanel';
import { JobProgressBar, LinkedDocumentsCard, NextActionCard, PaymentCollectionCard } from '../../src/components/JobWorkflowComponents';
import { PhotoAnnotationEditor } from '../../src/components/PhotoAnnotationEditor';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { getJobUrgency } from '../../src/lib/jobUrgency';
import { useIntegrationHealth } from '../../src/hooks/useIntegrationHealth';

interface Job {
  id: string;
  title: string;
  description?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  notes?: string;
  estimatedHours?: number;
  estimatedCost?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  completedAt?: string;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'partial';
  dueDate?: string;
  paidAmount?: number;
}

interface Quote {
  id: string;
  number: string;
  title: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
}

interface LinkedReceipt {
  id: string;
  receiptNumber?: string;
  amount: number;
  paymentMethod?: string;
  createdAt?: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface JobPhoto {
  id: string;
  url?: string;
  signedUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt?: string;
  fileName?: string;
  category?: string;
  takenAt?: string;
  mimeType?: string;
}

const isVideo = (photo: JobPhoto) => {
  const mimeType = photo.mimeType || '';
  const fileName = photo.fileName?.toLowerCase() || '';
  const ext = fileName.split('.').pop() || '';
  return mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'm4v', '3gp'].includes(ext);
};

interface CompletedTimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}

interface VoiceNote {
  id: string;
  fileName: string;
  duration: number | null;
  title: string | null;
  transcription: string | null;
  createdAt: string | null;
  signedUrl?: string;
}

interface DigitalSignature {
  id: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signedAt: string;
  documentType: string;
  signerRole?: 'client' | 'worker' | 'owner';
}

interface JobExpense {
  id: string;
  categoryId: string;
  categoryName?: string;
  amount: string;
  gstAmount?: string;
  description: string;
  vendor?: string;
  expenseDate: string;
  isBillable: boolean;
}

const STATUS_ACTIONS = {
  pending: { next: 'scheduled', label: 'Schedule Job', icon: 'calendar' as const, iconSize: 20 },
  scheduled: { next: 'in_progress', label: 'Start Job', icon: 'play' as const, iconSize: 20 },
  in_progress: { next: 'done', label: 'Complete Job', icon: 'check-circle' as const, iconSize: 20 },
  done: { next: 'invoiced', label: 'Create Invoice', icon: 'file-text' as const, iconSize: 20 },
  invoiced: null,
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  errorButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: spacing.xl,
  },
  statusRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  headerUrgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  headerUrgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerUrgencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 15,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardPressable: {
    backgroundColor: colors.card,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '500',
  },
  cardActionIcon: {
    marginLeft: spacing.sm,
  },
  clientCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clientAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  clientEmail: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clientActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  clientActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    gap: spacing.xs,
    minHeight: 44,
  },
  clientActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  timerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timerActiveCard: {
    borderColor: colors.success,
    borderWidth: 2,
    backgroundColor: colors.successLight,
  },
  timerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timerActiveIcon: {
    backgroundColor: colors.success,
  },
  timerContent: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timerValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 2,
  },
  timerActiveValue: {
    color: colors.success,
    fontWeight: '700',
  },
  timerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.destructive,
  },
  quickActionsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    minHeight: 90,
  },
  quickActionIcon: {
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  notesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notesIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  notesText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  emptyNotesPlaceholder: {
    paddingVertical: spacing.md,
  },
  emptyNotesText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  geofenceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  geofenceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  geofenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  geofenceBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  geofenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  geofenceSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.muted,
  },
  geofenceSettingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceSettingIcon: {
    marginRight: spacing.sm,
  },
  geofenceSettingLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  geofenceSettingDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  geofenceRadiusRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.muted,
  },
  geofenceRadiusLabel: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  geofenceRadiusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  geofenceSlider: {
    marginTop: spacing.xs,
  },
  geofenceNoLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  geofenceNoLocationText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginLeft: spacing.sm,
    flex: 1,
  },
  photosCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  photosIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  photosHeaderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  photosCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  photosCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  photosScrollView: {
    flexDirection: 'row',
  },
  photosScrollContent: {
    paddingRight: spacing.md,
  },
  inlinePhotoItem: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  inlinePhotoImage: {
    width: '100%',
    height: '100%',
  },
  morePhotosButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  morePhotosText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  morePhotosLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  addPhotoButton: {
    width: 100,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '50',
    marginRight: spacing.sm,
    gap: 4,
  },
  viewAllPhotosButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  emptyPhotosContainer: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  takePhotoInlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  takePhotoInlineButtonIcon: {
    marginRight: spacing.sm,
  },
  takePhotoInlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  galleryInlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  galleryInlineButtonIcon: {
    marginRight: spacing.sm,
  },
  galleryInlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  actionButtonContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
  },
  mainActionButtonIcon: {
    marginRight: spacing.sm,
  },
  mainActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  invoicedMessage: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.mutedForeground,
    paddingVertical: spacing.lg,
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  documentNumber: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  documentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  documentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  documentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  documentViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  documentViewButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  costingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  costingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  costingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  costingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  costingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  costingItem: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  costingLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  costingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  paymentReceivedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  paymentReceivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentReceivedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentReceivedContent: {
    flex: 1,
  },
  paymentReceivedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  paymentReceivedSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  paymentReceivedAmount: {
    alignItems: 'flex-end',
  },
  paymentReceivedAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  paymentReceivedDate: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Quick Collect Payment Styles
  quickCollectCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadows.sm,
  },
  quickCollectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickCollectIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  quickCollectTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCollectTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  quickCollectBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  quickCollectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  quickCollectDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  quickCollectAmountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  quickCollectAmountLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickCollectAmountValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  quickCollectButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickCollectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  quickCollectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  activityCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  activityList: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginLeft: 8,
    paddingLeft: spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.inProgress,
    marginRight: spacing.sm,
    marginTop: 5,
    marginLeft: -spacing.md - 6,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  activityMore: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  sectionHeaderIcon: {
    marginRight: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    padding: spacing.lg,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  photosContainer: {
    padding: spacing.lg,
  },
  photosGrid: {
    gap: spacing.sm,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    marginRight: '2%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  photosEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  photosEmptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  photoActionButtonSecondary: {
    backgroundColor: colors.muted,
  },
  photoActionText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  photoActionTextSecondary: {
    color: colors.foreground,
  },
  photoPreviewModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: '100%',
    height: '80%',
  },
  closePhotoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom toolbar for photo actions
  photoToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Safe area
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  photoToolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 8,
  },
  photoToolbarButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 56,
  },
  photoToolbarButtonText: {
    fontSize: 11,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  photoToolbarDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Legacy styles kept for compatibility but now using photoToolbar
  deletePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deletePhotoText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  markupPhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  markupPhotoText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(100,100,100,0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  categoryPhotoText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  photoCategoryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(100,100,100,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCategoryBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  savePhotoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success || '#22c55e',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  savePhotoText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  saveVideoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success || '#22c55e',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  photoCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  photoCountText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    minHeight: 44,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabIcon: {
    color: colors.mutedForeground,
  },
  tabIconActive: {
    color: colors.primaryForeground,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabLabelActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  fixedHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  tabSection: {
    marginBottom: spacing.lg,
  },
  tabSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  completionModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  completionScrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  completionSection: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  completionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  completionSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  completionSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  completionSectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completionStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  completionSectionContent: {
    paddingLeft: 48,
  },
  completionSectionDetail: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  completionWarning: {
    backgroundColor: colors.warning + '15',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  completionWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  completionWarningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warning,
  },
  completionWarningText: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  completionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: spacing.md,
  },
  completionButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionButtonPrimary: {
    backgroundColor: colors.success,
  },
  completionButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  completionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  completionButtonTextSecondary: {
    color: colors.foreground,
  },
  photoThumbnailsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  photoThumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  videoPlayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordVideoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  recordVideoButtonIcon: {
    marginRight: spacing.sm,
  },
  recordVideoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  videoPlayerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.6,
    backgroundColor: '#000',
  },
  closeVideoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteVideoButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
});

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [linkedReceipt, setLinkedReceipt] = useState<LinkedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<JobPhoto | null>(null);
  
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isUploadingVoiceNote, setIsUploadingVoiceNote] = useState(false);
  
  const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState<'client' | 'worker' | 'owner'>('client');
  const [saveToClient, setSaveToClient] = useState(true);
  const [clientSavedSignature, setClientSavedSignature] = useState<{ signatureData: string; signerName: string } | null>(null);
  
  const [sliderRadius, setSliderRadius] = useState(100);
  
  const [timeEntries, setTimeEntries] = useState<CompletedTimeEntry[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [isConvertingToInvoice, setIsConvertingToInvoice] = useState(false);
  
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  
  const [jobExpenses, setJobExpenses] = useState<JobExpense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  
  // Automation settings for photo gates
  const [automationSettings, setAutomationSettings] = useState<{
    requirePhotoBeforeStart: boolean;
    requirePhotoAfterComplete: boolean;
  } | null>(null);

  const isSafetyForm = (form: any) => {
    const name = (form.name || '').toLowerCase();
    return name.includes('swms') || name.includes('jsa') || name.includes('safety') || name.includes('compliance');
  };

  const pendingSafetyForms = useMemo(() => {
    return availableForms.filter(f => {
      if (!isSafetyForm(f)) return false;
      return !formSubmissions.some(s => s.formId === f.id && s.status === 'submitted');
    });
  }, [availableForms, formSubmissions]);

  // Forms data is loaded by JobForms component and passed via onFormsChange/onSubmissionsChange callbacks
  // This eliminates duplicate API calls
  
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'photos' | 'notes'>('overview');
  
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isCompletingJob, setIsCompletingJob] = useState(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [isSendingOnMyWay, setIsSendingOnMyWay] = useState(false);
  
  const { updateJobStatus, updateJobNotes } = useJobsStore();
  const { businessSettings, roleInfo, user, hasPermission } = useAuthStore();
  const { isSmsReady } = useIntegrationHealth();
  
  // Check if user can delete jobs (owner, admin, or manager only)
  // - If roleInfo.isOwner is true: they're the business owner
  // - If roleInfo exists with OWNER/ADMIN/MANAGER role: they have delete permission
  // - If roleInfo is null and user exists with their own business: they're a solo owner
  const isOwnerOrManager = roleInfo 
    ? (roleInfo.isOwner || ['OWNER', 'ADMIN', 'MANAGER'].includes(roleInfo.roleName?.toUpperCase() || ''))
    : false;
  const isSoloOwner = user && businessSettings && !roleInfo;
  const canDeleteJobs = isOwnerOrManager || isSoloOwner;
  
  // Check if user can collect payments (owners always can, workers need permission)
  // Guard against hasPermission being undefined during auth hydration
  const canCollectPayments = isOwnerOrManager || isSoloOwner || (typeof hasPermission === 'function' && hasPermission('collect_payments'));
  const { 
    activeTimer, 
    fetchActiveTimer, 
    startTimer, 
    stopTimer, 
    isLoading: timerLoading, 
    getElapsedMinutes,
    error: timerError 
  } = useTimeTrackingStore();

  const isTimerForThisJob = activeTimer?.jobId === id;

  // Pulse animation for active timer
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isTimerForThisJob) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTimerForThisJob]);

  // Create ref for AppState tracking
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    loadJob();
    fetchActiveTimer();
    loadPhotos();
    loadVoiceNotes();
    loadSignatures();
    loadRelatedDocuments();
    loadTimeEntries();
    loadActivityLog();
    loadJobExpenses();
    loadAutomationSettings();
    // Forms data is loaded by JobForms component via callbacks
    
    // Auto-refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground - refresh job data and timer
        loadJob();
        fetchActiveTimer();
        loadTimeEntries();
      }
      appStateRef.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, [id]);

  useEffect(() => {
    if (timerError) {
      Alert.alert('Timer Error', timerError);
    }
  }, [timerError]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isTimerForThisJob && activeTimer) {
      setElapsedTime(getElapsedMinutes());
      interval = setInterval(() => {
        setElapsedTime(getElapsedMinutes());
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerForThisJob, activeTimer?.id, activeTimer?.startTime]);

  // Generate smart actions when job/client/quote/invoice change
  useEffect(() => {
    if (job) {
      const actions = getJobSmartActions(job, client, quote, invoice);
      setSmartActions(actions);
    }
  }, [job?.status, client?.email, client?.phone, quote?.id, invoice?.id]);

  // Fetch client's saved signature when client changes
  useEffect(() => {
    const fetchClientSavedSignature = async () => {
      if (!client?.id) {
        setClientSavedSignature(null);
        return;
      }
      try {
        const response = await api.get<{ signatureData: string; signerName: string }>(`/api/clients/${client.id}/saved-signature`);
        if (response.data && response.data.signatureData) {
          setClientSavedSignature(response.data);
        } else {
          setClientSavedSignature(null);
        }
      } catch (error) {
        console.log('No saved signature for client:', error);
        setClientSavedSignature(null);
      }
    };
    fetchClientSavedSignature();
  }, [client?.id]);

  const handleSmartActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => 
      prev.map(action => 
        action.id === actionId ? { ...action, enabled } : action
      )
    );
  };

  const executeAction = async (action: SmartAction): Promise<boolean> => {
    if (!job) return false;

    try {
      // Use action.id for more specific routing when needed
      switch (action.id) {
        case 'create_invoice':
          router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'create_quote':
          router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'mark_complete':
          // Route through completion modal for review instead of direct completion
          setShowCompletionModal(true);
          return true;

        case 'send_invoice_email':
          // Open native email app (Gmail/Outlook) so user can see and customize before sending
          if (client?.email && invoice?.id) {
            const invoiceNumber = (invoice as any)?.number || invoice.id.slice(0, 8);
            const total = invoice?.total ? `$${Number(invoice.total).toFixed(2)}` : '';
            const subject = `Invoice ${invoiceNumber}${total ? ` - ${total}` : ''}`;
            const body = `G'day ${client.name || 'there'},\n\nPlease find your invoice for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and pay your invoice here:\n${API_URL.replace('/api', '')}/invoices/${invoice.id}/pay\n\nThanks for your business!`;
            
            await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            Alert.alert('Email Ready', 'Your email app has opened with the invoice details. Review and send when ready.');
          } else if (client?.email) {
            await Linking.openURL(`mailto:${client.email}?subject=Invoice for ${job.title}`);
          } else {
            Alert.alert('No Email', 'This client doesn\'t have an email address on file.');
          }
          return true;

        case 'send_invoice_sms':
          // Log SMS activity on server, then open native SMS
          if (client?.phone) {
            const message = `Hi! Your invoice for ${job.title} is ready. Please check your email for payment details.`;
            try {
              await api.post('/api/sms/send', {
                to: client.phone,
                message,
                context: {
                  type: 'invoice',
                  entityId: invoice?.id,
                  clientId: client.id,
                }
              });
            } catch (logError) {
              console.log('SMS logging failed, continuing with native SMS:', logError);
            }
            await Linking.openURL(`sms:${client.phone}?body=${encodeURIComponent(message)}`);
          }
          return true;

        case 'send_quote_email':
          // Open native email app (Gmail/Outlook) so user can see and customize before sending
          if (client?.email && quote?.id) {
            const quoteNumber = (quote as any)?.number || quote.id.slice(0, 8);
            const total = (quote as any)?.total ? `$${Number((quote as any).total).toFixed(2)}` : '';
            const subject = `Quote ${quoteNumber}${total ? ` - ${total}` : ''}`;
            const body = `G'day ${client.name || 'there'},\n\nPlease find your quote for ${job.title}${total ? ` totalling ${total}` : ''}.\n\nYou can view and accept this quote here:\n${API_URL.replace('/api', '')}/q/${(quote as any)?.acceptanceToken || quote.id}\n\nLet me know if you have any questions!`;
            
            await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            Alert.alert('Email Ready', 'Your email app has opened with the quote details. Review and send when ready.');
          } else if (client?.email) {
            await Linking.openURL(`mailto:${client.email}?subject=Quote for ${job.title}`);
          } else {
            Alert.alert('No Email', 'This client doesn\'t have an email address on file.');
          }
          return true;

        case 'send_confirmation':
          if (client?.email) {
            try {
              await api.post(`/api/jobs/${job.id}/send-confirmation`, {});
              Alert.alert('Success', 'Confirmation email sent');
            } catch {
              await Linking.openURL(`mailto:${client.email}?subject=Booking Confirmed: ${job.title}`);
            }
          }
          return true;

        case 'send_reminder':
          if (invoice?.id) {
            try {
              await api.post(`/api/invoices/${invoice.id}/reminder`, {});
              Alert.alert('Success', 'Payment reminder sent');
            } catch {
              Alert.alert('Error', 'Failed to send reminder');
            }
          }
          return true;

        case 'schedule_followup':
          router.push(`/more/create-job?copyFromId=${job.id}`);
          return true;

        case 'collect_payment':
          // Navigate to Collect Payment screen with invoice pre-selected
          if (invoice?.id) {
            router.push(`/(tabs)/collect?invoiceId=${invoice.id}`);
          } else {
            Alert.alert('No Invoice', 'Please create an invoice first to collect payment.');
          }
          return true;

        default:
          // Fall back to type-based routing for any other actions
          switch (action.type) {
            case 'send_email':
              if (client?.email) {
                await Linking.openURL(`mailto:${client.email}?subject=${encodeURIComponent(job.title)}`);
              }
              return true;

            case 'send_sms':
              if (client?.phone) {
                // Log SMS activity on server for audit trail
                try {
                  await api.post('/api/sms/send', {
                    to: client.phone,
                    message: `Re: ${job.title}`,
                    context: {
                      type: 'job',
                      entityId: job.id,
                      clientId: client.id,
                    }
                  });
                } catch (logError) {
                  console.log('SMS logging failed:', logError);
                }
                await Linking.openURL(`sms:${client.phone}`);
              }
              return true;

            default:
              return false;
          }
      }
    } catch (error) {
      console.error(`Error executing action ${action.id}:`, error);
      return false;
    }
  };

  const handleSmartActionExecute = async (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (!action || !job) return;

    setSmartActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: 'running' as const } : a)
    );

    const success = await executeAction(action);

    setSmartActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: success ? 'completed' as const : 'pending' as const } : a)
    );
  };

  const handleExecuteAllActions = async () => {
    if (!job) return;
    
    setIsExecutingActions(true);
    try {
      const enabledActions = smartActions.filter(a => a.enabled && a.status !== 'completed');
      
      for (const action of enabledActions) {
        setSmartActions(prev =>
          prev.map(a => a.id === action.id ? { ...a, status: 'running' as const } : a)
        );

        const success = await executeAction(action);

        setSmartActions(prev =>
          prev.map(a => a.id === action.id ? { ...a, status: success ? 'completed' as const : 'pending' as const } : a)
        );

        if (action.type === 'create_invoice' || action.type === 'create_quote') {
          break;
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute actions');
    } finally {
      setIsExecutingActions(false);
    }
  };

  const handleSkipAllActions = () => {
    setSmartActions(prev =>
      prev.map(action => ({ ...action, enabled: false, status: 'skipped' as const }))
    );
  };

  const loadJob = async () => {
    if (!id) {
      console.error('No job ID provided');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.get<Job>(`/api/jobs/${id}`);
      if (response.data) {
        setJob(response.data);
        setEditedNotes(response.data.notes || '');
        setSliderRadius(response.data.geofenceRadius || 100);
        if (response.data.clientId) {
          const clientResponse = await api.get<Client>(`/api/clients/${response.data.clientId}`);
          if (clientResponse.data) {
            setClient(clientResponse.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    }
    setIsLoading(false);
  };
  
  // Load automation settings for photo gate enforcement
  const loadAutomationSettings = async () => {
    try {
      const response = await api.get<{
        requirePhotoBeforeStart: boolean;
        requirePhotoAfterComplete: boolean;
      }>('/api/automation-settings');
      if (response.data) {
        setAutomationSettings({
          requirePhotoBeforeStart: response.data.requirePhotoBeforeStart ?? false,
          requirePhotoAfterComplete: response.data.requirePhotoAfterComplete ?? false,
        });
      }
    } catch (error) {
      console.log('Could not load automation settings:', error);
      // Default to no photo requirements if settings can't be loaded
      setAutomationSettings({
        requirePhotoBeforeStart: false,
        requirePhotoAfterComplete: false,
      });
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await api.get<JobPhoto[]>(`/api/jobs/${id}/photos`);
      if (response.data) {
        setPhotos(response.data);
      }
    } catch (error) {
      console.log('No photos or error loading:', error);
      setPhotos([]);
    }
  };

  const loadVoiceNotes = async () => {
    try {
      const response = await api.get<VoiceNote[]>(`/api/jobs/${id}/voice-notes`);
      if (response.data) {
        setVoiceNotes(response.data);
      }
    } catch (error) {
      console.log('No voice notes or error loading:', error);
      setVoiceNotes([]);
    }
  };

  const handleUploadVoiceNote = async (uri: string, duration: number) => {
    if (!job) return;
    
    setIsUploadingVoiceNote(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const audioData = await base64Promise;
      
      await api.post(`/api/jobs/${job.id}/voice-notes`, {
        audioData,
        fileName: `voice-note-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        duration,
      });
      
      await loadVoiceNotes();
      setShowVoiceRecorder(false);
      Alert.alert('Success', 'Voice note saved');
    } catch (error) {
      console.error('Error uploading voice note:', error);
      Alert.alert('Error', 'Failed to upload voice note');
    } finally {
      setIsUploadingVoiceNote(false);
    }
  };

  const handleDeleteVoiceNote = async (voiceNoteId: string) => {
    if (!job) return;
    
    Alert.alert(
      'Delete Voice Note',
      'Are you sure you want to delete this voice note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/jobs/${job.id}/voice-notes/${voiceNoteId}`);
              setVoiceNotes(voiceNotes.filter(v => v.id !== voiceNoteId));
            } catch (error) {
              console.error('Error deleting voice note:', error);
              Alert.alert('Error', 'Failed to delete voice note');
            }
          },
        },
      ]
    );
  };

  const handleDeleteJob = () => {
    if (!job) return;
    
    Alert.alert(
      'Delete Job',
      `Are you sure you want to delete "${job.title}"? This action cannot be undone.\n\nAll photos, notes, and other data associated with this job will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingJob(true);
            try {
              await api.delete(`/api/jobs/${job.id}`);
              Alert.alert('Job Deleted', 'The job has been permanently deleted');
              router.back();
            } catch (error) {
              console.error('Error deleting job:', error);
              Alert.alert('Error', 'Failed to delete job');
            } finally {
              setIsDeletingJob(false);
            }
          },
        },
      ]
    );
  };

  const loadSignatures = async () => {
    try {
      const response = await api.get<DigitalSignature[]>(`/api/jobs/${id}/signatures`);
      if (response.data) {
        setSignatures(response.data);
      }
    } catch (error) {
      console.log('No signatures or error loading:', error);
      setSignatures([]);
    }
  };

  const handleSaveSignature = async (data: { signerName: string; signerEmail?: string; signatureData: string }) => {
    if (!job) return;
    
    setIsSavingSignature(true);
    try {
      await api.post(`/api/jobs/${job.id}/signatures`, {
        signerName: data.signerName,
        signerEmail: data.signerEmail,
        signatureData: data.signatureData,
        signerRole: signerRole,
        saveToClient: saveToClient && signerRole === 'client'
      });
      await loadSignatures();
      setShowSignaturePad(false);
      setSignerRole('client');
      setSaveToClient(true);
      Alert.alert('Success', 'Signature captured successfully');
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'Failed to save signature');
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Direct delete without confirmation (for re-sign flow) - returns success boolean
  const deleteSignatureDirectly = async (signatureId: string): Promise<boolean> => {
    if (!job) return false;
    try {
      await api.delete(`/api/jobs/${job.id}/signatures/${signatureId}`);
      // Use functional state update to prevent desync
      setSignatures(prev => prev.filter(s => s.id !== signatureId));
      return true;
    } catch (error) {
      console.error('Error deleting signature:', error);
      Alert.alert('Error', 'Failed to delete signature. Please try again.');
      return false;
    }
  };

  const handleDeleteSignature = (signatureId: string) => {
    if (!job) return;
    
    Alert.alert(
      'Delete Signature',
      'Are you sure you want to delete this signature?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSignatureDirectly(signatureId);
          },
        },
      ]
    );
  };

  const loadRelatedDocuments = async () => {
    // Use the dedicated linked-documents endpoint for efficiency
    try {
      const response = await api.get<{
        linkedQuote: any;
        linkedInvoice: any;
        quoteCount: number;
        invoiceCount: number;
      }>(`/api/jobs/${id}/linked-documents`);
      
      if (response.data) {
        if (response.data.linkedQuote) {
          setQuote({
            id: response.data.linkedQuote.id,
            number: response.data.linkedQuote.number,
            title: response.data.linkedQuote.title,
            total: parseFloat(response.data.linkedQuote.total) || 0,
            status: response.data.linkedQuote.status,
          });
        } else {
          setQuote(null);
        }
        
        if (response.data.linkedInvoice) {
          const linkedInv = response.data.linkedInvoice;
          setInvoice({
            id: linkedInv.id,
            number: linkedInv.number,
            title: linkedInv.title,
            total: parseFloat(linkedInv.total) || 0,
            status: linkedInv.status,
            dueDate: linkedInv.dueDate,
            paidAmount: 0,
          });
          
          // If invoice is paid, try to fetch related receipt
          if (linkedInv.status?.toLowerCase() === 'paid') {
            try {
              const receiptsResponse = await api.get<any[]>(`/api/receipts?invoiceId=${linkedInv.id}`);
              if (receiptsResponse.data && receiptsResponse.data.length > 0) {
                const receipt = receiptsResponse.data[0];
                setLinkedReceipt({
                  id: receipt.id,
                  receiptNumber: receipt.receiptNumber,
                  amount: parseFloat(receipt.amount) || 0,
                  paymentMethod: receipt.paymentMethod,
                  createdAt: receipt.createdAt,
                });
              } else {
                setLinkedReceipt(null);
              }
            } catch {
              setLinkedReceipt(null);
            }
          } else {
            setLinkedReceipt(null);
          }
        } else {
          setInvoice(null);
          setLinkedReceipt(null);
        }
      }
    } catch (error) {
      console.log('Error loading linked documents:', error);
      // Clear the state on error
      setQuote(null);
      setInvoice(null);
      setLinkedReceipt(null);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const response = await api.get<CompletedTimeEntry[]>(`/api/time-entries?jobId=${id}`);
      if (response.data) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      console.log('Error loading time entries:', error);
      setTimeEntries([]);
    }
  };
  
  // Calculate total hours from completed time entries (startTime and endTime)
  const calculateTotalTrackedHours = (): number => {
    let totalMinutes = 0;
    timeEntries.forEach(entry => {
      // Only count entries that have a valid endTime (completed entries)
      // Skip active timers (no endTime) and entries with null/empty endTime
      if (entry.startTime && entry.endTime && entry.endTime !== 'null' && entry.endTime !== '') {
        try {
          const start = new Date(entry.startTime);
          const end = new Date(entry.endTime);
          // Validate dates are valid
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
            const durationMs = end.getTime() - start.getTime();
            totalMinutes += durationMs / (1000 * 60);
          }
        } catch {
          // Skip invalid entries
        }
      }
    });
    return totalMinutes / 60;
  };
  
  const totalTrackedHours = calculateTotalTrackedHours();

  const loadActivityLog = async () => {
    // Note: Timeline endpoint may not exist yet - fail gracefully
    try {
      const response = await api.get<ActivityItem[]>(`/api/jobs/${id}/activity`);
      if (response.data && Array.isArray(response.data)) {
        setActivityLog(response.data);
      }
    } catch (error) {
      // Activity log is optional - fail gracefully
      setActivityLog([]);
    }
  };

  const loadJobExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      const response = await api.get<any[]>(`/api/expenses?jobId=${id}`);
      if (response.data && Array.isArray(response.data)) {
        setJobExpenses(response.data);
      }
    } catch (error) {
      console.log('Error loading job expenses:', error);
      setJobExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quote?.id) return;
    
    setIsConvertingToInvoice(true);
    try {
      const response = await api.post(`/api/quotes/${quote.id}/convert-to-invoice`, {});
      if (response.data) {
        Alert.alert('Success', 'Quote converted to invoice successfully');
        router.push(`/more/invoice/${response.data.id}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to convert quote to invoice');
    } finally {
      setIsConvertingToInvoice(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadJob(), 
      loadPhotos(), 
      loadVoiceNotes(),
      loadSignatures(),
      loadRelatedDocuments(),
      loadTimeEntries(),
      loadActivityLog(),
      loadJobExpenses(),
      // Forms data is refreshed by JobForms component
    ]);
    setRefreshing(false);
  };

  // Use pre-calculated total tracked hours from completed time entries
  const actualHours = totalTrackedHours;
  const estimatedHours = job?.estimatedHours || 0;
  const hoursVariance = actualHours - estimatedHours;
  const estimatedCost = job?.estimatedCost || 0;

  const handleViewInvoice = () => {
    if (invoice?.id) {
      router.push(`/more/invoice/${invoice.id}`);
    }
  };

  const handleViewQuote = () => {
    if (quote?.id) {
      router.push(`/more/quote/${quote.id}`);
    }
  };

  // Payment collection handlers
  const handleTapToPay = () => {
    if (invoice?.id) {
      router.push(`/more/collect-payment?tab=tap&invoiceId=${invoice.id}&jobId=${job?.id}`);
    }
  };

  const handleQRCode = () => {
    if (invoice?.id) {
      router.push(`/more/collect-payment?tab=qr&invoiceId=${invoice.id}&jobId=${job?.id}`);
    }
  };

  const handlePaymentLink = () => {
    if (invoice?.id) {
      router.push(`/more/collect-payment?tab=link&invoiceId=${invoice.id}&jobId=${job?.id}`);
    }
  };

  const handleRecordCash = async () => {
    if (!invoice || !job) return;
    
    // Parse amounts as numbers to handle string values from API
    const total = typeof invoice.total === 'number' ? invoice.total : parseFloat(String(invoice.total) || '0');
    const paidAmount = typeof invoice.paidAmount === 'number' ? invoice.paidAmount : parseFloat(String(invoice.paidAmount) || '0');
    const outstanding = total - paidAmount;
    
    const formatAmount = (amount: number) => 
      new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
    
    Alert.alert(
      'Record Cash Payment',
      `Record ${formatAmount(outstanding)} cash payment for ${invoice.number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record Payment',
          onPress: async () => {
            try {
              // Create receipt with cash payment (no timestamp for cash)
              await api.post('/api/receipts', {
                invoiceId: invoice.id,
                jobId: job.id,
                clientId: client?.id,
                amount: String(outstanding.toFixed(2)),
                paymentMethod: 'cash',
                reference: invoice.number,
                description: `Cash payment for ${invoice.number}`,
                // Note: paidAt is intentionally not set for cash payments
              });
              
              // Mark invoice as paid
              await api.patch(`/api/invoices/${invoice.id}`, {
                status: 'paid',
                paidAmount: total,
              });
              
              Alert.alert('Success', 'Cash payment recorded successfully');
              handleRefresh();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to record payment');
            }
          },
        },
      ]
    );
  };

  // Quick Collect Payment - for collecting payment directly from accepted quote without invoice
  const [isQuickCollecting, setIsQuickCollecting] = useState(false);
  
  const handleQuickCollect = async (paymentMethod: 'cash' | 'card' | 'bank_transfer') => {
    if (!quote || !job || quote.status !== 'accepted') {
      Alert.alert('Error', 'An accepted quote is required for quick payment');
      return;
    }
    
    if (isQuickCollecting) return; // Prevent duplicate submissions

    const total = typeof quote.total === 'number' ? quote.total : parseFloat(String(quote.total) || '0');
    const formatAmount = (amount: number) => 
      new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

    const methodLabels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
    };

    Alert.alert(
      'Quick Collect Payment',
      `Collect ${formatAmount(total)} via ${methodLabels[paymentMethod]}?\n\nThis will automatically create an invoice marked as paid and generate a receipt.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Collect Payment',
          onPress: async () => {
            setIsQuickCollecting(true);
            try {
              const response = await api.post<{ receiptId: string; invoiceId: string }>(`/api/jobs/${job.id}/quick-collect`, {
                quoteId: quote.id,
                paymentMethod,
                amount: String(total.toFixed(2)),
              });
              
              if (response.error) {
                Alert.alert('Error', response.error);
                return;
              }
              
              Alert.alert(
                'Payment Collected!',
                `${formatAmount(total)} collected successfully.\n\nInvoice and receipt have been created.`,
                [
                  {
                    text: 'View Receipt',
                    onPress: () => response.data?.receiptId && router.push(`/more/receipt/${response.data.receiptId}`),
                  },
                  { text: 'OK', style: 'cancel' },
                ]
              );
              handleRefresh();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to collect payment');
            } finally {
              setIsQuickCollecting(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'partial': return colors.warning;
      case 'overdue': return colors.destructive;
      case 'sent': return colors.scheduled;
      case 'viewed': return colors.inProgress;
      default: return colors.mutedForeground;
    }
  };

  const formatElapsedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone.replace(/\s/g, '')}`);
    }
  };

  const handleSMS = () => {
    if (client?.phone) {
      Linking.openURL(`sms:${client.phone.replace(/\s/g, '')}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleNavigate = () => {
    if (!job) return;
    
    if (job.latitude && job.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(job.latitude, job.longitude, job.address);
    } else if (job.address) {
      const { openMapsWithAddress } = require('../../src/lib/maps-store');
      openMapsWithAddress(job.address);
    }
  };

  const handleViewClient = () => {
    if (client?.id) {
      router.push(`/more/client/${client.id}`);
    }
  };

  const handleDuplicateJob = async () => {
    if (!job) return;
    
    Alert.alert(
      'Duplicate Job',
      'Create a new job with the same details?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Duplicate',
          onPress: async () => {
            try {
              const newJobData = {
                title: job.title,
                description: job.description ? `${job.description}\n\n(Duplicated from job #${job.id})` : `Duplicated from job #${job.id}`,
                address: job.address,
                clientId: job.clientId,
                status: 'pending',
                estimatedDuration: job.estimatedDuration,
                estimatedCost: job.estimatedCost,
                geofenceRadius: job.geofenceRadius,
                latitude: job.latitude,
                longitude: job.longitude,
                notes: job.notes ? `${job.notes}\n\n(Original job: #${job.id})` : `Original job: #${job.id}`,
              };
              
              const response = await api.post<{ id: string }>('/api/jobs', newJobData);
              
              if (response.data?.id) {
                Alert.alert('Success', 'Job duplicated successfully', [
                  {
                    text: 'View New Job',
                    onPress: () => router.push(`/job/${response.data!.id}`),
                  },
                ]);
              } else {
                Alert.alert('Error', 'Failed to duplicate job');
              }
            } catch (error) {
              console.error('Error duplicating job:', error);
              Alert.alert('Error', 'Failed to duplicate job');
            }
          }
        }
      ]
    );
  };

  const handleStopRecurring = async () => {
    if (!job) return;
    
    Alert.alert(
      'Stop Recurring',
      'This will stop future jobs from being automatically created. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Recurring',
          style: 'destructive',
          onPress: async () => {
            const { isOnline } = useOfflineStore.getState();
            const updates = { isRecurring: false, nextRecurrenceDate: null };
            
            // Optimistic UI update
            setJob({ ...job, ...updates });
            
            if (!isOnline) {
              await offlineStorage.updateJobOffline(job.id, updates);
              Alert.alert('Saved Offline', 'Changes will sync when online');
              return;
            }
            
            try {
              const response = await api.patch(`/api/jobs/${job.id}`, updates);
              
              if (response.data) {
                Alert.alert('Success', 'Recurring schedule stopped');
              } else {
                // Revert on failure
                setJob(job);
                Alert.alert('Error', 'Failed to stop recurring schedule');
              }
            } catch (error: any) {
              if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
                await offlineStorage.updateJobOffline(job.id, updates);
                Alert.alert('Saved Offline', 'Changes will sync when connection is restored');
              } else {
                // Revert on error
                setJob(job);
                console.error('Error stopping recurring:', error);
                Alert.alert('Error', 'Failed to stop recurring schedule');
              }
            }
          }
        }
      ]
    );
  };

  const handleStartTimer = async () => {
    if (!job) return;
    
    if (activeTimer && !isTimerForThisJob) {
      Alert.alert(
        'Timer Already Running',
        'You have an active timer on another job. Would you like to stop it and start timing this job?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            onPress: async () => {
              const stopped = await stopTimer();
              if (!stopped) {
                Alert.alert('Error', 'Failed to stop the existing timer. Please try again.');
                return;
              }
              const success = await startTimer(job.id, `Working on: ${job.title}`);
              if (success) {
                if (job.status === 'scheduled') {
                  await updateJobStatus(job.id, 'in_progress');
                  setJob({ ...job, status: 'in_progress' });
                }
              } else {
                Alert.alert('Error', 'Failed to start timer. Please try again.');
              }
            }
          }
        ]
      );
      return;
    }

    const success = await startTimer(job.id, `Working on: ${job.title}`);
    if (success) {
      if (job.status === 'scheduled') {
        await updateJobStatus(job.id, 'in_progress');
        setJob({ ...job, status: 'in_progress' });
      }
    } else {
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async () => {
    const timeWorked = formatElapsedTime(elapsedTime);
    Alert.alert(
      'Stop Timer',
      `You've worked ${timeWorked}. Stop the timer?`,
      [
        { text: 'Keep Running', style: 'cancel' },
        {
          text: 'Stop',
          onPress: async () => {
            const success = await stopTimer();
            if (success) {
              // Reload time entries to show updated total - await to ensure state updates
              await loadTimeEntries();
            } else {
              Alert.alert('Error', 'Failed to stop timer. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleStatusChange = async () => {
    if (!job) return;
    
    const action = STATUS_ACTIONS[job.status];
    if (!action) return;

    if (action.next === 'invoiced') {
      router.push(`/more/invoice/new?jobId=${job.id}`);
      return;
    }

    // PHOTO GATE: Check if "before" photos are required before starting job
    if (action.next === 'in_progress' && automationSettings?.requirePhotoBeforeStart) {
      const beforePhotos = photos.filter(p => p.category === 'before');
      if (beforePhotos.length === 0) {
        Alert.alert(
          'Before Photo Required',
          'A "Before" photo is required before starting this job. Please take a photo to document the work site and mark it as "Before".',
          [
            { text: 'Take Photo', onPress: () => setActiveTab('photos') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
    }

    // Show completion summary modal when completing a job
    if (action.next === 'done') {
      // PHOTO GATE: Check if "after" photos are required before completing job
      if (automationSettings?.requirePhotoAfterComplete) {
        const afterPhotos = photos.filter(p => p.category === 'after');
        if (afterPhotos.length === 0) {
          Alert.alert(
            'After Photo Required',
            'An "After" photo is required before completing this job. Please take a photo to document the completed work and mark it as "After".',
            [
              { text: 'Take Photo', onPress: () => setActiveTab('photos') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          return;
        }
      }
      setShowCompletionModal(true);
      return;
    }

    // Show schedule picker when scheduling a job
    if (action.next === 'scheduled') {
      setScheduleDate(job.scheduledAt ? new Date(job.scheduledAt) : new Date());
      setShowScheduleModal(true);
      return;
    }

    // For other transitions (scheduled -> in_progress), show confirmation
    if (action.next === 'in_progress' && pendingSafetyForms.length > 0) {
      Alert.alert(
        'Safety Check',
        `There are ${pendingSafetyForms.length} safety forms (SWMS/JSA) pending. It is recommended to complete these before starting work. Do you want to continue?`,
        [
          { text: 'Go to Forms', onPress: () => setActiveTab('documents') },
          { 
            text: 'Start Anyway', 
            onPress: async () => {
              const success = await updateJobStatus(job.id, action.next as any);
              if (success) {
                setJob({ ...job, status: action.next as any });
              }
            },
            style: 'destructive'
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    Alert.alert(
      action.label,
      `Are you sure you want to ${action.label.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const success = await updateJobStatus(job.id, action.next as any);
            if (success) {
              setJob({ ...job, status: action.next as any });
            }
          }
        }
      ]
    );
  };

  const handleOnMyWay = async () => {
    if (!job) return;
    
    const { isOnline } = useOfflineStore.getState();
    
    if (!isOnline) {
      Alert.alert(
        'No Connection',
        'Sending "On My Way" notifications requires an internet connection. Please try again when online.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!isSmsReady) {
      Alert.alert(
        'SMS Not Configured',
        'SMS notifications require Twilio setup. Configure in Settings > Integrations.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsSendingOnMyWay(true);
    try {
      const response = await api.post(`/api/jobs/${job.id}/on-my-way`);
      
      if (response.data?.demoMode) {
        Alert.alert(
          'SMS Not Configured',
          'Twilio SMS is not set up. The "On My Way" action was logged but no message was sent to the client.\n\nSet up Twilio in Settings > Integrations to enable real SMS notifications.',
          [{ text: 'OK' }]
        );
      } else if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        Alert.alert('Sent!', 'Client has been notified via SMS.');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to send notification. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSendingOnMyWay(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!job) return;
    setIsCompletingJob(true);
    try {
      const success = await updateJobStatus(job.id, 'done');
      if (success) {
        setJob({ ...job, status: 'done' });
        setShowCompletionModal(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to complete job. Please try again.');
    }
    setIsCompletingJob(false);
  };

  const handleConfirmSchedule = async () => {
    if (!job) return;
    
    // Validate that the selected time is not in the past
    const now = new Date();
    if (scheduleDate < now) {
      Alert.alert('Invalid Time', 'Please select a future date and time for scheduling.');
      return;
    }
    
    const { isOnline } = useOfflineStore.getState();
    const previousStatus = job.status;
    const scheduledAtISO = scheduleDate.toISOString();
    
    // Optimistic UI update
    setJob({ ...job, status: 'scheduled', scheduledAt: scheduledAtISO });
    setShowScheduleModal(false);
    
    if (!isOnline) {
      await offlineStorage.updateJobStatusOffline(job.id, 'scheduled', previousStatus);
      await offlineStorage.updateJobOffline(job.id, { scheduledAt: scheduledAtISO });
      Alert.alert('Saved Offline', 'Job will be scheduled when online');
      return;
    }
    
    try {
      const response = await api.patch(`/api/jobs/${job.id}`, {
        status: 'scheduled',
        scheduledAt: scheduledAtISO,
      });
      
      if (response.data) {
        // Refresh the jobs store to update any cached job lists
        const { fetchJobs, fetchTodaysJobs } = useJobsStore.getState();
        fetchJobs();
        fetchTodaysJobs();
        
        Alert.alert('Success', 'Job scheduled successfully');
      } else {
        // Revert on failure
        setJob({ ...job, status: previousStatus });
        setShowScheduleModal(true);
        Alert.alert('Error', 'Failed to schedule job');
      }
    } catch (error: any) {
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        await offlineStorage.updateJobStatusOffline(job.id, 'scheduled', previousStatus);
        await offlineStorage.updateJobOffline(job.id, { scheduledAt: scheduledAtISO });
        Alert.alert('Saved Offline', 'Job will be scheduled when connection is restored');
      } else {
        // Revert on error
        setJob({ ...job, status: previousStatus });
        setShowScheduleModal(true);
        Alert.alert('Error', 'Failed to schedule job. Please try again.');
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!job) return;
    
    setIsSavingNotes(true);
    const { isOnline } = useOfflineStore.getState();
    const previousNotes = job.notes;
    
    // Optimistic UI update
    setJob({ ...job, notes: editedNotes });
    setShowNotesModal(false);
    
    if (!isOnline) {
      await offlineStorage.updateJobOffline(job.id, { notes: editedNotes });
      Alert.alert('Saved Offline', 'Notes will sync when online');
      setIsSavingNotes(false);
      return;
    }
    
    try {
      const response = await api.patch(`/api/jobs/${job.id}`, { notes: editedNotes });
      if (response.data) {
        Alert.alert('Saved', 'Notes updated successfully');
      } else {
        // Revert on failure
        setJob({ ...job, notes: previousNotes });
        setShowNotesModal(true);
        Alert.alert('Error', 'Failed to save notes');
      }
    } catch (error: any) {
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        await offlineStorage.updateJobOffline(job.id, { notes: editedNotes });
        Alert.alert('Saved Offline', 'Notes will sync when connection is restored');
      } else {
        // Revert on error
        setJob({ ...job, notes: previousNotes });
        setShowNotesModal(true);
        Alert.alert('Error', 'Failed to save notes. Please try again.');
      }
    }
    setIsSavingNotes(false);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'image');
    }
  };

  const handleRecordVideo = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to record videos.');
      return;
    }

    const microphonePermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'video');
    }
  };

  const promptForCategoryAndUpload = (uri: string, mediaType: 'image' | 'video') => {
    // Always prompt for category when any photo gate is enabled (even if already satisfied)
    // This ensures all uploads are properly categorized for documentation
    const hasBeforeGate = automationSettings?.requirePhotoBeforeStart;
    const hasAfterGate = automationSettings?.requirePhotoAfterComplete;
    
    if (hasBeforeGate || hasAfterGate) {
      // Build contextual message showing what's still needed
      const beforeCount = photos.filter(p => p.category === 'before').length;
      const afterCount = photos.filter(p => p.category === 'after').length;
      const needsMore: string[] = [];
      if (hasBeforeGate && beforeCount === 0) needsMore.push('Before photo');
      if (hasAfterGate && afterCount === 0 && job?.status === 'in_progress') needsMore.push('After photo');
      
      const message = needsMore.length > 0 
        ? `Still needed: ${needsMore.join(', ')}. What type of ${mediaType === 'video' ? 'video' : 'photo'} is this?`
        : `What type of ${mediaType === 'video' ? 'video' : 'photo'} is this?`;
      
      Alert.alert(
        `${mediaType === 'video' ? 'Video' : 'Photo'} Category`,
        message,
        [
          { text: 'Before (Site Condition)', onPress: () => uploadMedia(uri, mediaType, 'before') },
          { text: 'After (Completed Work)', onPress: () => uploadMedia(uri, mediaType, 'after') },
          { text: 'Progress', onPress: () => uploadMedia(uri, mediaType, 'progress') },
          { text: 'General', onPress: () => uploadMedia(uri, mediaType, 'general') },
        ]
      );
    } else {
      uploadMedia(uri, mediaType, 'general');
    }
  };

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Media library access is needed to select photos and videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideoFile = asset.type === 'video' || 
                          asset.uri.endsWith('.mp4') || 
                          asset.uri.endsWith('.mov') || 
                          asset.uri.endsWith('.m4v');
      promptForCategoryAndUpload(asset.uri, isVideoFile ? 'video' : 'image');
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      promptForCategoryAndUpload(result.assets[0].uri, 'image');
    }
  };

  const uploadMedia = async (uri: string, mediaType: 'image' | 'video', category: string = 'general') => {
    if (!job) return;
    
    setIsUploadingPhoto(true);
    
    // Create optimistic entry immediately for instant UI feedback
    const tempId = `temp-${Date.now()}`;
    const optimisticMedia: JobPhoto = {
      id: tempId,
      url: uri,
      signedUrl: uri,
      createdAt: new Date().toISOString(),
      mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      category: category,
    };
    
    // Add media optimistically
    setPhotos(prev => [...prev, optimisticMedia]);
    
    try {
      const filename = uri.split('/').pop() || (mediaType === 'video' ? 'video.mp4' : 'photo.jpg');
      const ext = filename.split('.').pop()?.toLowerCase() || (mediaType === 'video' ? 'mp4' : 'jpg');
      
      let mimeType: string;
      if (mediaType === 'video') {
        mimeType = ext === 'mov' ? 'video/quicktime' : `video/${ext}`;
      } else {
        mimeType = ext === 'png' ? 'image/png' : `image/${ext}`;
      }
      
      // Get session token for authorization
      const token = await api.getToken();
      
      // Use FileSystem.uploadAsync for streaming multipart upload (works for large videos)
      const uploadUrl = `${API_URL}/api/jobs/${job.id}/photos/upload`;
      // Use FileSystemUploadType.MULTIPART (value: 1) with fallback for compatibility
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: uploadType,
        fieldName: 'file',
        mimeType: mimeType,
        parameters: {
          category: category,
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (uploadResult.status === 200) {
        const responseData = JSON.parse(uploadResult.body);
        if (responseData.success) {
          setPhotos(prev => prev.filter(p => p.id !== tempId));
          await loadPhotos();
          Alert.alert('Success', `${mediaType === 'video' ? 'Video' : 'Photo'} uploaded successfully`);
        } else {
          setPhotos(prev => prev.filter(p => p.id !== tempId));
          Alert.alert('Error', responseData.error || `Failed to upload ${mediaType}. Please try again.`);
        }
      } else {
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        Alert.alert('Error', `Failed to upload ${mediaType}. Server returned status ${uploadResult.status}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setPhotos(prev => prev.filter(p => p.id !== tempId));
      Alert.alert('Error', `Failed to upload ${mediaType}. ${error.message || 'Please try again.'}`);
    }
    setIsUploadingPhoto(false);
  };

  const uploadPhoto = async (uri: string) => {
    uploadMedia(uri, 'image', 'general');
  };

  const handleChangePhotoCategory = (photo: JobPhoto) => {
    Alert.alert(
      'Change Photo Category',
      `Current category: ${photo.category || 'general'}`,
      [
        { text: 'Before (Site Condition)', onPress: () => updatePhotoCategory(photo, 'before') },
        { text: 'After (Completed Work)', onPress: () => updatePhotoCategory(photo, 'after') },
        { text: 'Progress', onPress: () => updatePhotoCategory(photo, 'progress') },
        { text: 'General', onPress: () => updatePhotoCategory(photo, 'general') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const updatePhotoCategory = async (photo: JobPhoto, newCategory: string) => {
    try {
      const response = await api.patch(`/api/jobs/${job?.id}/photos/${photo.id}`, { category: newCategory });
      if (response.data) {
        // Update local state
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, category: newCategory } : p
        ));
        if (selectedPhoto?.id === photo.id) {
          setSelectedPhoto({ ...selectedPhoto, category: newCategory });
        }
        Alert.alert('Success', `Photo category changed to "${newCategory}"`);
      } else {
        Alert.alert('Error', 'Failed to update photo category');
      }
    } catch (error: any) {
      console.error('Update category error:', error);
      Alert.alert('Error', 'Failed to update photo category');
    }
  };

  const handleDeletePhoto = async (photo: JobPhoto) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/jobs/${job?.id}/photos/${photo.id}`);
              setPhotos(photos.filter(p => p.id !== photo.id));
              setSelectedPhoto(null);
            } catch (error) {
              setPhotos(photos.filter(p => p.id !== photo.id));
              setSelectedPhoto(null);
            }
          }
        }
      ]
    );
  };

  const [isSavingMedia, setIsSavingMedia] = useState(false);
  
  const handleSaveMedia = async (photo: JobPhoto) => {
    if (isSavingMedia) return;
    
    const isVideo = photo.mimeType?.startsWith('video/');
    const mediaUrl = photo.signedUrl || photo.url || `${api.getBaseUrl()}/api/jobs/${job?.id}/photos/${photo.id}/view`;
    
    setIsSavingMedia(true);
    
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Not Available', 'Sharing is not available on this device');
        setIsSavingMedia(false);
        return;
      }

      const extension = isVideo ? (photo.fileName?.split('.').pop() || 'mp4') : 'jpg';
      const filename = photo.fileName || `media_${Date.now()}.${extension}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(mediaUrl, localUri);
      
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: photo.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          dialogTitle: `Save ${isVideo ? 'Video' : 'Photo'} to...`,
        });
      } else {
        Alert.alert('Error', 'Failed to download media. Please try again.');
      }
    } catch (error: any) {
      console.error('Save media error:', error);
      Alert.alert('Error', `Failed to save ${isVideo ? 'video' : 'photo'}. ${error.message || 'Please try again.'}`);
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleAnnotatedPhotoSave = async (annotatedUri: string) => {
    if (!job) return;
    
    setIsUploadingPhoto(true);
    setShowAnnotationEditor(false);
    
    try {
      const base64Data = annotatedUri.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data');
      }
      
      const filename = `annotated_${Date.now()}.jpg`;
      const tempFilePath = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const token = await api.getToken();
      const uploadUrl = `${API_URL}/api/jobs/${job.id}/photos/upload`;
      
      // Use FileSystemUploadType.MULTIPART (value: 1) with fallback for compatibility
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, tempFilePath, {
        httpMethod: 'POST',
        uploadType: uploadType,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        parameters: {
          category: 'annotated',
        },
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        await loadPhotos();
        setSelectedPhoto(null);
        Alert.alert('Success', 'Annotated photo saved successfully');
      } else {
        console.error('Upload failed:', uploadResult.status, uploadResult.body);
        Alert.alert('Error', 'Failed to save annotated photo. Please try again.');
      }
    } catch (error: any) {
      console.error('Annotated photo upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload annotated photo. Please try again.');
    }
    setIsUploadingPhoto(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.pending;
      case 'scheduled': return colors.scheduled;
      case 'in_progress': return colors.inProgress;
      case 'done': return colors.done;
      case 'invoiced': return colors.invoiced;
      default: return colors.primary;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text style={styles.errorText}>Job not found</Text>
        <Text style={[styles.errorText, { fontSize: 14, marginTop: 4 }]}>
          The job may have been deleted or you don't have access.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <TouchableOpacity onPress={loadJob} style={[styles.errorButton, { backgroundColor: colors.primary }]}>
            <Feather name="refresh-cw" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={[styles.errorButtonText, { color: '#fff' }]}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const action = STATUS_ACTIONS[job.status];
  const statusColor = getStatusColor(job.status);
  const clientInitials = client?.name ? client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const TAB_CONFIG = [
    { id: 'overview' as const, label: 'Overview', icon: 'briefcase' as const },
    { id: 'documents' as const, label: 'Docs', icon: 'file-text' as const },
    { id: 'photos' as const, label: 'Photos', icon: 'camera' as const },
    { id: 'notes' as const, label: 'Notes', icon: 'file' as const },
  ];

  const renderOverviewTab = () => (
    <>
      {/* Job Progress Bar - Visual workflow indicator */}
      <JobProgressBar status={job.status} />

      {/* Safety & Compliance Section - Prominent before work starts */}
      {(job.status === 'scheduled' || job.status === 'in_progress') && availableForms.some(isSafetyForm) && (
        <View style={[
          styles.card, 
          pendingSafetyForms.length > 0 && { borderColor: colors.warning, borderWidth: 2, backgroundColor: `${colors.warning}05` }
        ]}>
          <View style={[styles.cardIconContainer, { backgroundColor: pendingSafetyForms.length > 0 ? `${colors.warning}15` : `${colors.success}15` }]}>
            <Feather 
              name={pendingSafetyForms.length > 0 ? "alert-triangle" : "shield-check"} 
              size={iconSizes.xl} 
              color={pendingSafetyForms.length > 0 ? colors.warning : colors.success} 
            />
          </View>
          <View style={styles.cardContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={styles.cardLabel}>Safety & Compliance</Text>
              {pendingSafetyForms.length > 0 && (
                <View style={{ backgroundColor: colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>REQUIRED</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardValue, pendingSafetyForms.length > 0 && { color: colors.warning, fontWeight: '700' }]}>
              {pendingSafetyForms.length > 0 
                ? `${pendingSafetyForms.length} safety form${pendingSafetyForms.length > 1 ? 's' : ''} pending`
                : 'All safety forms completed'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setActiveTab('documents')}
            style={{ padding: spacing.sm }}
          >
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Next Action Card - CTA when job is done without invoice */}
      <NextActionCard
        jobStatus={job.status}
        hasInvoice={!!invoice}
        hasQuote={!!quote}
        onCreateInvoice={() => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

      {/* Address Card */}
      {job.address && (
        <TouchableOpacity 
          activeOpacity={0.7} 
          style={styles.card}
          onPress={handleNavigate}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.scheduled}15` }]}>
            <Feather name="map-pin" size={iconSizes.xl} color={colors.scheduled} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>Address</Text>
            <Text style={styles.cardValue}>{job.address}</Text>
          </View>
          <Feather 
            name="navigation" 
            size={iconSizes.lg} 
            color={colors.primary} 
            style={styles.cardActionIcon}
          />
        </TouchableOpacity>
      )}

      {/* Scheduled Date Card - Tappable to edit schedule */}
      <TouchableOpacity 
        activeOpacity={0.7} 
        style={styles.card}
        onPress={() => {
          if (job.scheduledAt) {
            setScheduleDate(new Date(job.scheduledAt));
          } else {
            setScheduleDate(new Date());
          }
          setShowScheduleModal(true);
        }}
      >
        <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="clock" size={iconSizes.xl} color={colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>Scheduled</Text>
          <Text style={styles.cardValue}>
            {formatDate(job.scheduledAt)}
            {job.scheduledAt && ` at ${formatTime(job.scheduledAt)}`}
          </Text>
        </View>
        <Feather 
          name="edit-2" 
          size={iconSizes.lg} 
          color={colors.primary} 
          style={styles.cardActionIcon}
        />
      </TouchableOpacity>

      {/* Client Card */}
      {client && (
        <View style={styles.clientCard}>
          <TouchableOpacity 
            style={styles.clientHeader}
            onPress={handleViewClient}
            activeOpacity={0.7}
          >
            <View style={[styles.clientAvatar, { backgroundColor: statusColor }]}>
              <Text style={styles.clientAvatarText}>{clientInitials}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              {client.email && (
                <Text style={styles.clientEmail}>{client.email}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </TouchableOpacity>
          
          <View style={styles.clientActions}>
            {client.phone && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.success}15` }]}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={iconSizes.md} color={colors.success} />
                <Text style={[styles.clientActionText, { color: colors.success }]}>Call</Text>
              </TouchableOpacity>
            )}
            {client.phone && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.scheduled}15` }]}
                onPress={handleSMS}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={iconSizes.md} color={colors.scheduled} />
                <Text style={[styles.clientActionText, { color: colors.scheduled }]}>SMS</Text>
              </TouchableOpacity>
            )}
            {client.email && (
              <TouchableOpacity 
                style={[styles.clientActionButton, { backgroundColor: `${colors.invoiced}15` }]}
                onPress={handleEmail}
                activeOpacity={0.7}
              >
                <Feather name="mail" size={iconSizes.md} color={colors.invoiced} />
                <Text style={[styles.clientActionText, { color: colors.invoiced }]}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Time Tracking Card with Pulse Animation */}
      {(job.status === 'scheduled' || job.status === 'in_progress') && (
        <Animated.View 
          style={[
            styles.timerCard, 
            isTimerForThisJob && styles.timerActiveCard,
            { transform: [{ scale: isTimerForThisJob ? pulseAnim : 1 }] }
          ]}
        >
          <View style={[styles.timerIconContainer, isTimerForThisJob && styles.timerActiveIcon]}>
            <Feather 
              name="clock" 
              size={iconSizes.xl} 
              color={isTimerForThisJob ? colors.primaryForeground : colors.primary} 
            />
          </View>
          <View style={styles.timerContent}>
            <Text style={styles.timerLabel}>Time Tracking</Text>
            {isTimerForThisJob ? (
              <Text style={[styles.timerValue, styles.timerActiveValue]}>
                Running: {formatElapsedTime(elapsedTime)}
              </Text>
            ) : activeTimer ? (
              <Text style={styles.timerValue}>Timer on another job</Text>
            ) : totalTrackedHours > 0 ? (
              <Text style={styles.timerValue}>Total: {totalTrackedHours.toFixed(1)}h tracked</Text>
            ) : (
              <Text style={styles.timerValue}>Not started</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={isTimerForThisJob ? handleStopTimer : handleStartTimer}
            style={[
              styles.timerButton,
              isTimerForThisJob ? styles.stopButton : styles.startButton
            ]}
            disabled={timerLoading}
          >
            {timerLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : isTimerForThisJob ? (
              <Feather name="square" size={iconSizes.md} color={colors.primaryForeground} />
            ) : (
              <Feather name="play" size={iconSizes.md} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Linked Documents Card */}
      <LinkedDocumentsCard
        linkedQuote={quote ? {
          id: quote.id,
          status: quote.status,
          total: quote.total,
          quoteNumber: quote.number,
        } : null}
        linkedInvoice={invoice ? {
          id: invoice.id,
          status: invoice.status,
          total: invoice.total,
          invoiceNumber: invoice.number,
        } : null}
        linkedReceipt={linkedReceipt}
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onViewReceipt={(receiptId) => router.push(`/more/receipt/${receiptId}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={() => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

      {/* Quick Collect Payment - Shows when job is done/in_progress with accepted quote but no invoice yet */}
      {(job.status === 'done' || job.status === 'in_progress') && quote && quote.status === 'accepted' && !invoice && canCollectPayments && (
        <View style={[styles.quickCollectCard, { borderColor: colors.cardBorder }]}>
          <View style={styles.quickCollectHeader}>
            <View style={[styles.quickCollectIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.15) }]}>
              <Feather name="credit-card" size={iconSizes.lg} color={colors.primary} />
            </View>
            <View style={styles.quickCollectTitleContainer}>
              <Text style={[styles.quickCollectTitle, { color: colors.foreground }]}>Collect Payment Now</Text>
              <View style={[styles.quickCollectBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.quickCollectBadgeText, { color: colors.mutedForeground }]}>Based on quote</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.quickCollectDescription, { color: colors.mutedForeground }]}>
            Collect payment using the accepted quote amount. Invoice and receipt will be created automatically.
          </Text>
          <View style={[styles.quickCollectAmountBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.quickCollectAmountLabel, { color: colors.mutedForeground }]}>Quote total</Text>
            <Text style={[styles.quickCollectAmountValue, { color: colors.primary }]}>
              {formatCurrency(typeof quote.total === 'number' ? quote.total : parseFloat(String(quote.total) || '0'))}
            </Text>
          </View>
          <View style={styles.quickCollectButtons}>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.primary }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('cash')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-cash"
            >
              {isQuickCollecting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="dollar-sign" size={iconSizes.md} color={colors.primaryForeground} />
                  <Text style={[styles.quickCollectButtonText, { color: colors.primaryForeground }]}>Cash</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.muted }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('card')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-card"
            >
              <Feather name="credit-card" size={iconSizes.md} color={colors.foreground} />
              <Text style={[styles.quickCollectButtonText, { color: colors.foreground }]}>Card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCollectButton, { backgroundColor: colors.muted }, isQuickCollecting && { opacity: 0.6 }]}
              onPress={() => handleQuickCollect('bank_transfer')}
              activeOpacity={0.8}
              disabled={isQuickCollecting}
              data-testid="button-quick-collect-bank"
            >
              <Feather name="home" size={iconSizes.md} color={colors.foreground} />
              <Text style={[styles.quickCollectButtonText, { color: colors.foreground }]}>Bank</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Collection Card - for collecting payment on invoiced jobs */}
      <PaymentCollectionCard
        invoice={invoice ? {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          paidAmount: invoice.paidAmount,
        } : null}
        jobId={job.id}
        canCollectPayments={canCollectPayments}
        onTapToPay={handleTapToPay}
        onQRCode={handleQRCode}
        onPaymentLink={handlePaymentLink}
        onRecordCash={handleRecordCash}
      />

      {/* Payment Received Section - shows when there are linked receipts */}
      {linkedReceipt && (
        <TouchableOpacity 
          style={styles.paymentReceivedCard}
          onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
          activeOpacity={0.7}
          data-testid="card-payment-received"
        >
          <View style={styles.paymentReceivedHeader}>
            <View style={[styles.paymentReceivedIcon, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="check-circle" size={iconSizes.lg} color={colors.success} />
            </View>
            <View style={styles.paymentReceivedContent}>
              <Text style={styles.paymentReceivedTitle}>Payment Received</Text>
              <Text style={styles.paymentReceivedSubtitle}>
                {linkedReceipt.receiptNumber || 'Receipt'} • {linkedReceipt.paymentMethod || 'Payment'}
              </Text>
            </View>
            <View style={styles.paymentReceivedAmount}>
              <Text style={styles.paymentReceivedAmountText}>
                {formatCurrency(linkedReceipt.amount)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
          </View>
          {linkedReceipt.createdAt && (
            <Text style={styles.paymentReceivedDate}>
              Received {new Date(linkedReceipt.createdAt).toLocaleDateString('en-AU', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Job Costing Section */}
      {(estimatedHours > 0 || estimatedCost > 0 || actualHours > 0) && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="dollar-sign" size={iconSizes.lg} color={colors.warning} />
            </View>
            <Text style={styles.costingTitle}>Job Costing</Text>
          </View>
          <View style={styles.costingGrid}>
            {estimatedHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Estimated Hours</Text>
                <Text style={styles.costingValue}>{estimatedHours.toFixed(1)}h</Text>
              </View>
            )}
            {actualHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Actual Hours</Text>
                <Text style={[
                  styles.costingValue,
                  hoursVariance > 0 && { color: colors.destructive },
                  hoursVariance < 0 && { color: colors.success }
                ]}>{actualHours.toFixed(1)}h</Text>
              </View>
            )}
            {estimatedCost > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Estimated Cost</Text>
                <Text style={styles.costingValue}>{formatCurrency(estimatedCost)}</Text>
              </View>
            )}
            {estimatedHours > 0 && actualHours > 0 && (
              <View style={styles.costingItem}>
                <Text style={styles.costingLabel}>Hours Variance</Text>
                <Text style={[
                  styles.costingValue,
                  hoursVariance > 0 && { color: colors.destructive },
                  hoursVariance < 0 && { color: colors.success }
                ]}>
                  {hoursVariance > 0 ? '+' : ''}{hoursVariance.toFixed(1)}h
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Job Expenses Section */}
      <View style={styles.costingCard}>
        <View style={styles.costingHeader}>
          <View style={[styles.costingIconContainer, { backgroundColor: `${colors.destructive}15` }]}>
            <Feather name="credit-card" size={iconSizes.lg} color={colors.destructive} />
          </View>
          <Text style={styles.costingTitle}>Job Expenses</Text>
          <TouchableOpacity
            onPress={() => router.push(`/more/expense-tracking?jobId=${job.id}`)}
            style={{ marginLeft: 'auto', padding: spacing.xs }}
          >
            <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {jobExpenses.length > 0 ? (
          <>
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              {jobExpenses.slice(0, 3).map((expense) => (
                <View 
                  key={expense.id} 
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: '500' }}>
                      {expense.description}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      {expense.categoryName || 'Expense'} • {new Date(expense.expenseDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                    {formatCurrency(parseFloat(expense.amount) || 0)}
                  </Text>
                </View>
              ))}
            </View>
            {jobExpenses.length > 3 && (
              <TouchableOpacity onPress={() => router.push(`/more/expense-tracking?jobId=${job.id}`)}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>
                  +{jobExpenses.length - 3} more expenses
                </Text>
              </TouchableOpacity>
            )}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              marginTop: spacing.sm,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                Total Expenses
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.destructive }}>
                {formatCurrency(jobExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0))}
              </Text>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.md }}>
              No expenses recorded for this job
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: colors.primary,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
              }}
              onPress={() => router.push(`/more/expense-tracking?jobId=${job.id}`)}
            >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recurring Schedule Section */}
      {job.isRecurring && (
        <View style={styles.costingCard}>
          <View style={styles.costingHeader}>
            <View style={[styles.costingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="repeat" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.costingTitle}>Recurring Schedule</Text>
          </View>
          
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Frequency</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                {job.recurrencePattern === 'weekly' && 'Weekly'}
                {job.recurrencePattern === 'fortnightly' && 'Fortnightly'}
                {job.recurrencePattern === 'monthly' && 'Monthly'}
                {job.recurrencePattern === 'quarterly' && 'Quarterly'}
                {job.recurrencePattern === 'yearly' && 'Yearly'}
              </Text>
            </View>
            
            {job.nextRecurrenceDate && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Next Job</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                  {new Date(job.nextRecurrenceDate).toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}
            
            {job.recurrenceEndDate && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Ends</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }}>
                  {new Date(job.recurrenceEndDate).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                backgroundColor: colors.destructive,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                marginTop: spacing.sm,
              }}
              onPress={handleStopRecurring}
              activeOpacity={0.8}
            >
              <Feather name="x-circle" size={18} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 14 }}>
                Stop Recurring
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Duplicate Job Button */}
      <View style={styles.costingCard}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: colors.card,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          onPress={handleDuplicateJob}
          activeOpacity={0.8}
        >
          <Feather name="copy" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
            Duplicate Job
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Action Button */}
      <View style={styles.actionButtonContainer}>
        {action ? (
          job.status === 'scheduled' && job.clientId ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {/* On My Way Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: isSmsReady ? colors.info : colors.muted,
                  backgroundColor: colors.card,
                  opacity: isSendingOnMyWay ? 0.6 : 1,
                  minHeight: 52,
                }}
                onPress={handleOnMyWay}
                activeOpacity={0.8}
                disabled={isSendingOnMyWay}
                data-testid="button-on-my-way"
              >
                <Feather name="navigation" size={18} color={isSmsReady ? colors.info : colors.mutedForeground} />
                <Text style={{ 
                  color: isSmsReady ? colors.info : colors.mutedForeground, 
                  fontWeight: '600', 
                  fontSize: 14 
                }}>
                  On My Way
                </Text>
                {isSendingOnMyWay && (
                  <ActivityIndicator size="small" color={colors.info} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
              
              {/* Main Action Button */}
              <TouchableOpacity
                style={[styles.mainActionButton, { backgroundColor: statusColor, flex: 1 }]}
                onPress={handleStatusChange}
                activeOpacity={0.8}
                data-testid="button-main-action"
              >
                <View style={styles.mainActionButtonIcon}>
                  <Feather name={action.icon} size={action.iconSize} color={colors.primaryForeground} />
                </View>
                <Text style={styles.mainActionText}>{action.label}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.mainActionButton, { backgroundColor: statusColor }]}
              onPress={handleStatusChange}
              activeOpacity={0.8}
              data-testid="button-main-action"
            >
              <View style={styles.mainActionButtonIcon}>
                <Feather name={action.icon} size={action.iconSize} color={colors.primaryForeground} />
              </View>
              <Text style={styles.mainActionText}>{action.label}</Text>
            </TouchableOpacity>
          )
        ) : job.status === 'invoiced' && !invoice && (
          <Text style={styles.invoicedMessage}>This job has been invoiced</Text>
        )}
      </View>
    </>
  );

  const renderDocumentsTab = () => (
    <>
      {/* Linked Documents Card */}
      <LinkedDocumentsCard
        linkedQuote={quote ? {
          id: quote.id,
          status: quote.status,
          total: quote.total,
          quoteNumber: quote.number,
        } : null}
        linkedInvoice={invoice ? {
          id: invoice.id,
          status: invoice.status,
          total: invoice.total,
          invoiceNumber: invoice.number,
        } : null}
        linkedReceipt={linkedReceipt}
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onViewReceipt={(receiptId) => router.push(`/more/receipt/${receiptId}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={() => router.push(`/more/invoice/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

      {/* Job Checklist Section - available for all job statuses */}
      <View style={styles.photosCard}>
        <JobForms 
          jobId={job.id} 
          readOnly={job.status === 'invoiced'} 
          onSubmissionsChange={setFormSubmissions}
          onFormsChange={setAvailableForms}
        />
      </View>

      {/* Client Signature Section */}
      {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && (
        <View style={styles.photosCard}>
          <View style={styles.photosHeader}>
            <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="edit-3" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.photosHeaderLabel}>Signatures</Text>
          </View>
          
          {showSignaturePad ? (
            <View style={{ gap: spacing.md }}>
              {/* Role Selector - Segmented Buttons */}
              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm }}>
                  Signer Role
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {(['client', 'worker', 'owner'] as const).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: 8,
                        backgroundColor: signerRole === role ? colors.primary : colors.muted,
                        borderWidth: 1,
                        borderColor: signerRole === role ? colors.primary : colors.border,
                        alignItems: 'center',
                        minHeight: 44,
                        justifyContent: 'center',
                      }}
                      onPress={() => setSignerRole(role)}
                      activeOpacity={0.7}
                      data-testid={`button-role-${role}`}
                    >
                      <Text style={{ 
                        color: signerRole === role ? colors.primaryForeground : colors.foreground,
                        fontWeight: '600',
                        fontSize: 14,
                        textTransform: 'capitalize',
                      }}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Use Saved Signature Button - Only show when role is client and client has saved signature */}
              {signerRole === 'client' && clientSavedSignature && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    backgroundColor: colors.success + '15',
                    paddingVertical: spacing.md,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.success + '30',
                    minHeight: 44,
                  }}
                  onPress={() => {
                    if (clientSavedSignature) {
                      handleSaveSignature({
                        signerName: clientSavedSignature.signerName || client?.name || 'Client',
                        signatureData: clientSavedSignature.signatureData,
                      });
                      setSignerName('');
                    }
                  }}
                  activeOpacity={0.7}
                  data-testid="button-use-saved-signature"
                >
                  <Feather name="check-circle" size={18} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: '600', fontSize: 14 }}>
                    Use Saved Signature
                  </Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: spacing.md,
                  fontSize: 16,
                  color: colors.foreground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 44,
                }}
                placeholder={`${signerRole.charAt(0).toUpperCase() + signerRole.slice(1)}'s name *`}
                placeholderTextColor={colors.mutedForeground}
                value={signerName}
                onChangeText={setSignerName}
                data-testid="input-signer-name"
              />

              <SignaturePad
                onSave={(signatureData) => {
                  if (!signerName.trim()) {
                    Alert.alert('Error', `Please enter the ${signerRole}'s name`);
                    return;
                  }
                  handleSaveSignature({
                    signerName: signerName.trim(),
                    signatureData,
                  });
                  setSignerName('');
                }}
                onClear={() => {}}
                showControls={true}
              />

              {/* Save to Client Checkbox - Only show when role is client */}
              {signerRole === 'client' && client?.id && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                  }}
                  onPress={() => setSaveToClient(!saveToClient)}
                  activeOpacity={0.7}
                  data-testid="checkbox-save-to-client"
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: saveToClient ? colors.primary : colors.border,
                    backgroundColor: saveToClient ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {saveToClient && (
                      <Feather name="check" size={14} color={colors.primaryForeground} />
                    )}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                    Save signature to client profile for future use
                  </Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.takePhotoInlineButton, { flex: 1, backgroundColor: colors.muted, minHeight: 44 }]}
                  onPress={() => {
                    setShowSignaturePad(false);
                    setSignerName('');
                    setSignerRole('client');
                    setSaveToClient(true);
                  }}
                  activeOpacity={0.7}
                  data-testid="button-cancel-signature"
                >
                  <Text style={[styles.takePhotoInlineText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : signatures.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {signatures.filter(s => s.documentType === 'job_completion').map((sig) => (
                <View key={sig.id} style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 8, 
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                          Signed by {sig.signerName}
                        </Text>
                        {/* Role Badge */}
                        <View style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: sig.signerRole === 'client' 
                            ? colors.primary + '20' 
                            : sig.signerRole === 'worker' 
                              ? colors.warning + '20'
                              : colors.success + '20',
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '600',
                            textTransform: 'capitalize',
                            color: sig.signerRole === 'client' 
                              ? colors.primary 
                              : sig.signerRole === 'worker' 
                                ? colors.warning
                                : colors.success,
                          }}>
                            {sig.signerRole || 'Client'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {new Date(sig.signedAt).toLocaleDateString('en-AU', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      <TouchableOpacity 
                        onPress={() => {
                          Alert.alert(
                            'Re-sign?',
                            'Delete this signature and capture a new one?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Re-sign',
                                onPress: async () => {
                                  const deleted = await deleteSignatureDirectly(sig.id);
                                  if (deleted) {
                                    setShowSignaturePad(true);
                                  }
                                },
                              },
                            ]
                          );
                        }}
                        style={{ padding: spacing.xs }}
                        data-testid={`button-resign-${sig.id}`}
                      >
                        <Feather name="edit-2" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteSignature(sig.id)}
                        style={{ padding: spacing.xs }}
                        data-testid={`button-delete-signature-${sig.id}`}
                      >
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Signature Preview */}
                  <View style={{ 
                    marginTop: spacing.sm, 
                    backgroundColor: colors.card, 
                    borderRadius: 8, 
                    padding: spacing.sm,
                    alignItems: 'center',
                  }}>
                    {sig.signatureData ? (
                      <Image
                        source={{ uri: sig.signatureData }}
                        style={{
                          width: '100%',
                          height: 120,
                          borderRadius: 4,
                        }}
                        resizeMode="contain"
                      />
                    ) : (
                      <>
                        <Feather name="check-circle" size={24} color={colors.success} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                          Signature captured
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              ))}
              {/* Add Another Signature Button */}
              <TouchableOpacity 
                style={[styles.takePhotoInlineButton, { marginTop: spacing.xs }]}
                onPress={() => setShowSignaturePad(true)}
                activeOpacity={0.7}
                data-testid="button-add-another-signature"
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
                <Text style={styles.takePhotoInlineText}>Add Another Signature</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyPhotosContainer}>
              <TouchableOpacity 
                style={styles.takePhotoInlineButton}
                onPress={() => setShowSignaturePad(true)}
                activeOpacity={0.7}
                data-testid="button-capture-signature"
              >
                <Feather name="edit-3" size={18} color={colors.primaryForeground} />
                <Text style={styles.takePhotoInlineText}>Capture Signature</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </>
  );

  const renderPhotosTab = () => (
    <>
      {/* Photos Section */}
      <View style={styles.photosCard}>
        <View style={styles.photosHeader}>
          <View style={styles.photosIconContainer}>
            <Feather name="camera" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.photosHeaderLabel}>Photos</Text>
          {photos.length > 0 && (
            <View style={styles.photosCountBadge}>
              <Text style={styles.photosCountText}>{photos.length}</Text>
            </View>
          )}
        </View>
        
        {photos.length > 0 ? (
          <>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.photosScrollView}
              contentContainerStyle={styles.photosScrollContent}
            >
              {photos.map((photo) => (
                <TouchableOpacity 
                  key={photo.id}
                  style={styles.inlinePhotoItem}
                  onPress={() => {
                    if (isVideo(photo)) {
                      setSelectedVideo(photo);
                      setShowVideoPlayer(true);
                    } else {
                      setSelectedPhoto(photo);
                    }
                  }}
                  onLongPress={() => handleChangePhotoCategory(photo)}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: photo.signedUrl || photo.thumbnailUrl || photo.url || '' }} 
                    style={styles.inlinePhotoImage}
                    resizeMode="cover"
                  />
                  {isVideo(photo) && (
                    <View style={styles.videoOverlay}>
                      <View style={styles.videoPlayIcon}>
                        <Feather name="play" size={16} color={colors.foreground} />
                      </View>
                    </View>
                  )}
                  {photo.category && photo.category !== 'general' && (
                    <View style={[styles.photoCategoryBadge, 
                      photo.category === 'before' && { backgroundColor: colors.info || '#3b82f6' },
                      photo.category === 'after' && { backgroundColor: colors.success || '#22c55e' },
                      photo.category === 'progress' && { backgroundColor: colors.warning || '#f59e0b' }
                    ]}>
                      <Text style={styles.photoCategoryBadgeText}>
                        {photo.category.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {/* Tap any photo to view full gallery */}
              <TouchableOpacity 
                style={styles.viewAllPhotosButton}
                onPress={() => setShowPhotosModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="grid" size={20} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.emptyPhotosContainer, { marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }]}>
              <TouchableOpacity 
                style={[styles.takePhotoInlineButton, { flex: 0, minWidth: '30%', paddingHorizontal: spacing.md }]}
                onPress={handleTakePhoto}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="camera" size={18} color={colors.primaryForeground} style={{ marginRight: spacing.xs }} />
                    <Text style={styles.takePhotoInlineText}>Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.recordVideoButton}
                onPress={handleRecordVideo}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
                data-testid="button-record-video"
              >
                <Feather name="video" size={18} color={colors.primaryForeground} style={styles.recordVideoButtonIcon} />
                <Text style={styles.recordVideoText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.galleryInlineButton, { flex: 1, marginRight: 0 }]}
                onPress={handlePickMedia}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                <Feather name="image" size={18} color={colors.foreground} style={{ marginRight: spacing.xs }} />
                <Text style={styles.galleryInlineText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={[styles.emptyPhotosContainer, { flexWrap: 'wrap', gap: spacing.sm }]}>
            <TouchableOpacity 
              style={[styles.takePhotoInlineButton, { flex: 0, minWidth: '30%', paddingHorizontal: spacing.md }]}
              onPress={handleTakePhoto}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="camera" size={18} color={colors.primaryForeground} style={{ marginRight: spacing.xs }} />
                  <Text style={styles.takePhotoInlineText}>Photo</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.recordVideoButton}
              onPress={handleRecordVideo}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
              data-testid="button-record-video"
            >
              <Feather name="video" size={18} color={colors.primaryForeground} style={styles.recordVideoButtonIcon} />
              <Text style={styles.recordVideoText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.galleryInlineButton, { flex: 1, marginRight: 0 }]}
              onPress={handlePickMedia}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
            >
              <Feather name="image" size={18} color={colors.foreground} style={{ marginRight: spacing.xs }} />
              <Text style={styles.galleryInlineText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Voice Notes Section */}
      <View style={styles.photosCard}>
        <View style={styles.photosHeader}>
          <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="mic" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.photosHeaderLabel}>Voice Notes</Text>
          {voiceNotes.length > 0 && (
            <View style={styles.photosCountBadge}>
              <Text style={styles.photosCountText}>{voiceNotes.length}</Text>
            </View>
          )}
        </View>
        
        {showVoiceRecorder ? (
          <VoiceRecorder
            onSave={handleUploadVoiceNote}
            onCancel={() => setShowVoiceRecorder(false)}
            isUploading={isUploadingVoiceNote}
          />
        ) : voiceNotes.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {voiceNotes.map((note) => (
              <VoiceNotePlayer
                key={note.id}
                noteId={note.id}
                jobId={id as string}
                uri={`${api.getBaseUrl()}/api/jobs/${id}/voice-notes/${note.id}/stream`}
                fallbackUri={note.signedUrl || ''}
                title={note.title || undefined}
                duration={note.duration || undefined}
                createdAt={note.createdAt || undefined}
                transcription={note.transcription}
                onDelete={() => handleDeleteVoiceNote(note.id)}
                onTranscriptionUpdate={(text) => {
                  // Update local state with new transcription
                  setVoiceNotes(prev => prev.map(v => 
                    v.id === note.id ? { ...v, transcription: text } : v
                  ));
                }}
                onAddToNotes={async (text) => {
                  // Append transcription to job notes
                  const currentNotes = job?.notes || '';
                  const newNotes = currentNotes 
                    ? `${currentNotes}\n\n[Voice Note Transcription]\n${text}`
                    : `[Voice Note Transcription]\n${text}`;
                  
                  const { isOnline } = useOfflineStore.getState();
                  const previousNotes = job?.notes;
                  
                  // Optimistic update
                  if (job) {
                    setJob({ ...job, notes: newNotes });
                  }
                  
                  try {
                    if (!isOnline) {
                      await offlineStorage.updateJobOffline(job!.id, { notes: newNotes });
                      Alert.alert('Saved Offline', 'Transcription added to notes - will sync when online');
                    } else {
                      await api.patch(`/api/jobs/${job?.id}`, { notes: newNotes });
                      Alert.alert('Added', 'Transcription added to job notes');
                    }
                  } catch (error: any) {
                    // Revert on error
                    if (job) {
                      setJob({ ...job, notes: previousNotes || '' });
                    }
                    if (error.message?.includes('Network')) {
                      await offlineStorage.updateJobOffline(job!.id, { notes: newNotes });
                      Alert.alert('Saved Offline', 'Will sync when connection is restored');
                    } else {
                      Alert.alert('Error', 'Failed to add transcription to notes');
                    }
                  }
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.takePhotoInlineButton}
              onPress={() => setShowVoiceRecorder(true)}
              activeOpacity={0.7}
            >
              <Feather name="mic" size={18} color={colors.primaryForeground} />
              <Text style={styles.takePhotoInlineText}>Record Voice Note</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyPhotosContainer}>
            <TouchableOpacity 
              style={styles.takePhotoInlineButton}
              onPress={() => setShowVoiceRecorder(true)}
              activeOpacity={0.7}
            >
              <Feather name="mic" size={18} color={colors.primaryForeground} />
              <Text style={styles.takePhotoInlineText}>Record Voice Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );

  const renderNotesTab = () => (
    <>
      {/* Notes Section */}
      <TouchableOpacity 
        style={styles.notesCard}
        onPress={() => {
          setEditedNotes(job.notes || '');
          setShowNotesModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.notesHeader}>
          <View style={styles.notesIconContainer}>
            <Feather name="file-text" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.notesLabel}>Notes</Text>
          <Feather name="edit-2" size={iconSizes.sm} color={colors.mutedForeground} />
        </View>
        {job.notes ? (
          <Text style={styles.notesText}>{job.notes}</Text>
        ) : (
          <View style={styles.emptyNotesPlaceholder}>
            <Text style={styles.emptyNotesText}>Tap to add notes about this job...</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Geofence Settings Section */}
      <View style={styles.geofenceCard}>
        <View style={styles.geofenceHeader}>
          <View style={styles.geofenceHeaderLeft}>
            <View style={styles.geofenceIconContainer}>
              <Feather name="map-pin" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.geofenceLabel}>Geofence Settings</Text>
          </View>
          {job.geofenceEnabled && (
            <View style={styles.geofenceBadge}>
              <Text style={styles.geofenceBadgeText}>Active</Text>
            </View>
          )}
        </View>
        
        {job.latitude && job.longitude ? (
          <>
            <View style={styles.geofenceSettingRow}>
              <View style={styles.geofenceSettingLeft}>
                <Feather name="circle" size={iconSizes.md} color={colors.mutedForeground} style={styles.geofenceSettingIcon} />
                <View>
                  <Text style={styles.geofenceSettingLabel}>Enable Geofence</Text>
                  <Text style={styles.geofenceSettingDescription}>Track arrival and departure from job site</Text>
                </View>
              </View>
              <Switch
                value={job.geofenceEnabled || false}
                onValueChange={async (value) => {
                  const { isOnline } = useOfflineStore.getState();
                  const previousValue = job.geofenceEnabled;
                  
                  // Optimistic UI update
                  setJob({ ...job, geofenceEnabled: value });
                  
                  if (!isOnline) {
                    await offlineStorage.updateJobOffline(job.id, { geofenceEnabled: value });
                    Alert.alert('Saved Offline', 'Settings will sync when online');
                    return;
                  }
                  
                  try {
                    await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceEnabled: value });
                  } catch (e: any) {
                    if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                      await offlineStorage.updateJobOffline(job.id, { geofenceEnabled: value });
                      Alert.alert('Saved Offline', 'Settings will sync when connection is restored');
                    } else {
                      setJob({ ...job, geofenceEnabled: previousValue });
                      Alert.alert('Error', 'Failed to update geofence settings');
                    }
                  }
                }}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            
            {job.geofenceEnabled && (
              <>
                <View style={styles.geofenceRadiusRow}>
                  <Text style={styles.geofenceRadiusLabel}>Detection Radius</Text>
                  <Text style={styles.geofenceRadiusValue}>{sliderRadius}m</Text>
                  <Slider
                    style={styles.geofenceSlider}
                    minimumValue={50}
                    maximumValue={500}
                    step={10}
                    value={sliderRadius}
                    onValueChange={(value) => setSliderRadius(value)}
                    onSlidingComplete={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceRadius;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceRadius: value });
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceRadius: value });
                        Alert.alert('Saved Offline', 'Radius will sync when online');
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceRadius: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceRadius: value });
                          Alert.alert('Saved Offline', 'Radius will sync when connection is restored');
                        } else {
                          setJob({ ...job, geofenceRadius: previousValue });
                          setSliderRadius(previousValue || 100);
                          Alert.alert('Error', 'Failed to update radius');
                        }
                      }
                    }}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.muted}
                    thumbTintColor={colors.primary}
                  />
                </View>
                
                <View style={styles.geofenceSettingRow}>
                  <View style={styles.geofenceSettingLeft}>
                    <Feather name="log-in" size={iconSizes.md} color={colors.success} style={styles.geofenceSettingIcon} />
                    <View>
                      <Text style={styles.geofenceSettingLabel}>Auto Clock-In</Text>
                      <Text style={styles.geofenceSettingDescription}>Start timer when arriving at job</Text>
                    </View>
                  </View>
                  <Switch
                    value={job.geofenceAutoClockIn || false}
                    onValueChange={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceAutoClockIn;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceAutoClockIn: value });
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockIn: value });
                        Alert.alert('Saved Offline', 'Settings will sync when online');
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockIn: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockIn: value });
                          Alert.alert('Saved Offline', 'Settings will sync when connection is restored');
                        } else {
                          setJob({ ...job, geofenceAutoClockIn: previousValue });
                          Alert.alert('Error', 'Failed to update setting');
                        }
                      }
                    }}
                    trackColor={{ false: colors.muted, true: colors.success }}
                    thumbColor={colors.white}
                  />
                </View>
                
                <View style={styles.geofenceSettingRow}>
                  <View style={styles.geofenceSettingLeft}>
                    <Feather name="log-out" size={iconSizes.md} color={colors.warning} style={styles.geofenceSettingIcon} />
                    <View>
                      <Text style={styles.geofenceSettingLabel}>Auto Clock-Out</Text>
                      <Text style={styles.geofenceSettingDescription}>Stop timer when leaving job site</Text>
                    </View>
                  </View>
                  <Switch
                    value={job.geofenceAutoClockOut || false}
                    onValueChange={async (value) => {
                      const { isOnline } = useOfflineStore.getState();
                      const previousValue = job.geofenceAutoClockOut;
                      
                      // Optimistic UI update
                      setJob({ ...job, geofenceAutoClockOut: value });
                      
                      if (!isOnline) {
                        await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockOut: value });
                        Alert.alert('Saved Offline', 'Settings will sync when online');
                        return;
                      }
                      
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockOut: value });
                      } catch (e: any) {
                        if (e.message?.includes('Network') || e.code === 'ECONNABORTED') {
                          await offlineStorage.updateJobOffline(job.id, { geofenceAutoClockOut: value });
                          Alert.alert('Saved Offline', 'Settings will sync when connection is restored');
                        } else {
                          setJob({ ...job, geofenceAutoClockOut: previousValue });
                          Alert.alert('Error', 'Failed to update setting');
                        }
                      }
                    }}
                    trackColor={{ false: colors.muted, true: colors.warning }}
                    thumbColor={colors.white}
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.geofenceNoLocation}>
            <Feather name="alert-circle" size={iconSizes.lg} color={colors.mutedForeground} />
            <Text style={styles.geofenceNoLocationText}>
              Add a job address to enable geofence tracking. The address will be geocoded automatically.
            </Text>
          </View>
        )}
      </View>

      {/* Activity Log Section */}
      {activityLog.length > 0 && (
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={[styles.activityIconContainer, { backgroundColor: `${colors.inProgress}15` }]}>
              <Feather name="activity" size={iconSizes.lg} color={colors.inProgress} />
            </View>
            <Text style={styles.activityTitle}>Activity Log</Text>
            <Text style={styles.activityCount}>{activityLog.length}</Text>
          </View>
          <View style={styles.activityList}>
            {activityLog.slice(0, 5).map((item, index) => (
              <View key={item.id || index} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityDescription}>{item.description}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(item.createdAt).toLocaleDateString('en-AU', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
            ))}
            {activityLog.length > 5 && (
              <Text style={styles.activityMore}>+{activityLog.length - 5} more activities</Text>
            )}
          </View>
        </View>
      )}
    </>
  );

  return (
    <>
      <View style={styles.container}>
        <Stack.Screen 
        options={{ 
          headerShown: true,
          title: '',
          headerBackVisible: false,
          headerLeft: () => <IOSBackButton />,
          headerRight: () => canDeleteJobs ? (
            <TouchableOpacity
              onPress={handleDeleteJob}
              disabled={isDeletingJob}
              style={{ 
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colorWithOpacity(colors.destructive, 0.1),
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.sm,
              }}
              data-testid="button-delete-job"
            >
              {isDeletingJob ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="trash-2" size={18} color={colors.destructive} />
              )}
            </TouchableOpacity>
          ) : undefined,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          headerTintColor: colors.foreground,
        }} 
      />

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.statusRow}>
          <StatusBadge status={job.status} />
          {(() => {
            const urgency = getJobUrgency(job.scheduledAt, job.status);
            if (!urgency) return null;
            return (
              <View style={[styles.headerUrgencyBadge, { backgroundColor: urgency.bgColor, borderColor: `${urgency.color}30` }]}>
                {urgency.animate && (
                  <View style={[styles.headerUrgencyDot, { backgroundColor: urgency.color }]} />
                )}
                <Text style={[styles.headerUrgencyText, { color: urgency.color }]}>
                  {urgency.label}
                </Text>
              </View>
            );
          })()}
        </View>
        <Text style={styles.title}>{job.title}</Text>
        {job.description && (
          <Text style={styles.description}>{job.description}</Text>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Feather 
              name={tab.icon} 
              size={iconSizes.md} 
              color={activeTab === tab.id ? colors.primaryForeground : colors.mutedForeground} 
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content - Scrollable */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'photos' && renderPhotosTab()}
        {activeTab === 'notes' && renderNotesTab()}
      </ScrollView>
      </View>

      {/* Notes Modal */}
      <Modal visible={showNotesModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Job Notes</Text>
                <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <TextInput
                  style={styles.notesInput}
                  value={editedNotes}
                  onChangeText={setEditedNotes}
                  placeholder="Add notes about this job..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Notes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photos Modal */}
      <Modal visible={showPhotosModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Photos ({photos.length})</Text>
              <TouchableOpacity onPress={() => setShowPhotosModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.photosContainer}>
              {photos.length === 0 ? (
                <View style={styles.photosEmpty}>
                  <Feather name="image" size={48} color={colors.mutedForeground} />
                  <Text style={styles.photosEmptyText}>No photos or videos yet</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {photos.map((photo) => (
                    <TouchableOpacity 
                      key={photo.id}
                      style={styles.photoItem}
                      onPress={() => {
                        if (isVideo(photo)) {
                          setShowPhotosModal(false);
                          setSelectedVideo(photo);
                          setShowVideoPlayer(true);
                        } else {
                          setSelectedPhoto(photo);
                        }
                      }}
                      onLongPress={() => handleChangePhotoCategory(photo)}
                    >
                      <Image 
                        source={{ uri: photo.signedUrl || photo.url || photo.thumbnailUrl || '' }} 
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      {isVideo(photo) && (
                        <View style={styles.videoOverlay}>
                          <View style={styles.videoPlayIcon}>
                            <Feather name="play" size={16} color={colors.foreground} />
                          </View>
                        </View>
                      )}
                      {photo.category && photo.category !== 'general' && (
                        <View style={[styles.photoCategoryBadge, 
                          photo.category === 'before' && { backgroundColor: colors.info || '#3b82f6' },
                          photo.category === 'after' && { backgroundColor: colors.success || '#22c55e' },
                          photo.category === 'progress' && { backgroundColor: colors.warning || '#f59e0b' }
                        ]}>
                          <Text style={styles.photoCategoryBadgeText}>
                            {photo.category.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
            
            {/* Floating AI Analysis Button */}
            {photos.filter(p => !isVideo(p)).length > 0 && businessSettings?.aiEnabled !== false && businessSettings?.aiPhotoAnalysisEnabled !== false && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  bottom: spacing.lg,
                  right: spacing.lg,
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.full || 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  ...shadows.lg,
                }}
                onPress={() => {
                  setShowPhotosModal(false);
                  setTimeout(() => setShowAIAnalysisModal(true), 300);
                }}
                activeOpacity={0.8}
              >
                <Feather name="zap" size={18} color={colors.primaryForeground} />
                <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 14 }}>Analyse with AI</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* AI Photo Analysis Modal */}
      {job && (
        <AIPhotoAnalysisModal
          visible={showAIAnalysisModal}
          onClose={() => setShowAIAnalysisModal(false)}
          jobId={job.id}
          photos={photos}
          existingNotes={job.notes || ''}
          onNotesUpdated={() => loadJob()}
          aiEnabled={businessSettings?.aiEnabled !== false}
          aiPhotoAnalysisEnabled={businessSettings?.aiPhotoAnalysisEnabled !== false}
        />
      )}

      {/* Full Photo Preview Modal */}
      <Modal visible={!!selectedPhoto && !showAnnotationEditor} animationType="fade" transparent>
        <View style={styles.photoPreviewModal}>
          {selectedPhoto && (
            <>
              <Image 
                source={{ uri: selectedPhoto.signedUrl || selectedPhoto.url || '' }} 
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              
              {/* Close button - top right */}
              <TouchableOpacity 
                style={styles.closePhotoButton}
                onPress={() => setSelectedPhoto(null)}
                data-testid="button-close-photo"
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
              
              {/* Bottom toolbar with all actions */}
              <View style={styles.photoToolbar}>
                {/* Category badge display */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                  <View style={{ 
                    backgroundColor: selectedPhoto.category === 'before' ? colors.info + '30' : 
                                    selectedPhoto.category === 'after' ? colors.success + '30' : 
                                    selectedPhoto.category === 'progress' ? colors.warning + '30' : 
                                    'rgba(255,255,255,0.15)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Feather 
                      name="tag" 
                      size={14} 
                      color={selectedPhoto.category === 'before' ? colors.info : 
                             selectedPhoto.category === 'after' ? colors.success : 
                             selectedPhoto.category === 'progress' ? colors.warning : '#fff'} 
                    />
                    <Text style={{ 
                      color: selectedPhoto.category === 'before' ? colors.info : 
                             selectedPhoto.category === 'after' ? colors.success : 
                             selectedPhoto.category === 'progress' ? colors.warning : '#fff',
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                      {selectedPhoto.category ? selectedPhoto.category.charAt(0).toUpperCase() + selectedPhoto.category.slice(1) : 'General'}
                    </Text>
                  </View>
                </View>
                
                {/* Action buttons row */}
                <View style={styles.photoToolbarRow}>
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => {
                      const photoToAnalyse = selectedPhoto;
                      setSelectedPhoto(null);
                      requestAnimationFrame(() => {
                        setShowAIAnalysisModal(true);
                      });
                    }}
                    data-testid="button-ai-analyse-photo"
                  >
                    <Feather name="zap" size={22} color={colors.warning} />
                    <Text style={[styles.photoToolbarButtonText, { color: colors.warning }]}>AI Analyse</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => handleSaveMedia(selectedPhoto)}
                    disabled={isSavingMedia}
                    data-testid="button-share-photo"
                  >
                    <Feather name={isSavingMedia ? "loader" : "share"} size={22} color="#fff" />
                    <Text style={styles.photoToolbarButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => setShowAnnotationEditor(true)}
                    data-testid="button-markup-photo"
                  >
                    <Feather name="edit-2" size={22} color="#fff" />
                    <Text style={styles.photoToolbarButtonText}>Markup</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.photoToolbarDivider} />
                  
                  <TouchableOpacity 
                    style={styles.photoToolbarButton}
                    onPress={() => handleDeletePhoto(selectedPhoto)}
                    data-testid="button-delete-photo"
                  >
                    <Feather name="trash-2" size={22} color={colors.destructive} />
                    <Text style={[styles.photoToolbarButtonText, { color: colors.destructive }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Photo Annotation Editor Modal */}
      {selectedPhoto && showAnnotationEditor && (
        <PhotoAnnotationEditor
          imageUri={selectedPhoto.signedUrl || selectedPhoto.url || ''}
          onSave={handleAnnotatedPhotoSave}
          onCancel={() => setShowAnnotationEditor(false)}
          visible={showAnnotationEditor}
        />
      )}

      {/* Video Player Modal */}
      <Modal visible={showVideoPlayer && !!selectedVideo} animationType="fade" transparent>
        <View style={styles.videoPlayerModal}>
          {selectedVideo && (
            <>
              <View style={styles.videoPlayerContainer}>
                <WebView
                  source={{
                    html: `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                        <style>
                          * { margin: 0; padding: 0; }
                          html, body { width: 100%; height: 100%; background: #000; }
                          video { width: 100%; height: 100%; object-fit: contain; }
                        </style>
                      </head>
                      <body>
                        <video controls autoplay playsinline>
                          <source src="${selectedVideo.signedUrl || selectedVideo.url || ''}" type="${selectedVideo.mimeType || 'video/mp4'}">
                          Your browser does not support the video tag.
                        </video>
                      </body>
                      </html>
                    `,
                  }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                />
              </View>
              <TouchableOpacity 
                style={styles.closeVideoButton}
                onPress={() => {
                  setShowVideoPlayer(false);
                  setSelectedVideo(null);
                }}
                data-testid="button-close-video"
              >
                <Feather name="x" size={24} color={colors.primaryForeground} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveVideoButton, isSavingMedia && { opacity: 0.6 }]}
                onPress={() => {
                  if (selectedVideo) {
                    handleSaveMedia(selectedVideo);
                  }
                }}
                disabled={isSavingMedia}
                data-testid="button-share-video"
              >
                <Feather name={isSavingMedia ? "loader" : "share"} size={18} color={colors.primaryForeground} />
                <Text style={styles.savePhotoText}>{isSavingMedia ? 'Preparing...' : 'Share Video'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteVideoButton}
                onPress={() => {
                  if (selectedVideo) {
                    handleDeletePhoto(selectedVideo);
                    setShowVideoPlayer(false);
                    setSelectedVideo(null);
                  }
                }}
                data-testid="button-delete-video"
              >
                <Feather name="trash-2" size={18} color={colors.primaryForeground} />
                <Text style={styles.deletePhotoText}>Delete Video</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Job Completion Summary Modal */}
      {job && (
        <Modal visible={showCompletionModal} animationType="slide">
          <View style={styles.completionModal}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>Complete Job</Text>
              <TouchableOpacity onPress={() => setShowCompletionModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.completionScrollContent}>
              {/* Job Title */}
              <View style={[styles.completionSection, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.completionSectionTitle, { color: colors.primary }]}>{job.title}</Text>
                {job.description && (
                  <Text style={[styles.completionSectionDetail, { marginTop: spacing.xs }]}>{job.description}</Text>
                )}
              </View>

              {/* Photos Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: photos.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="camera" size={18} color={photos.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Photos</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={photos.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={photos.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: photos.length > 0 ? colors.success : colors.destructive }]}>
                      {photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
                {photos.length > 0 && (
                  <View style={styles.photoThumbnailsRow}>
                    {photos.slice(0, 4).map((photo, idx) => (
                      <Image 
                        key={photo.id || idx} 
                        source={{ uri: photo.signedUrl || photo.url || photo.thumbnailUrl }} 
                        style={styles.photoThumbnail} 
                      />
                    ))}
                    {photos.length > 4 && (
                      <View style={[styles.photoThumbnail, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>+{photos.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Notes Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: (job.notes && job.notes.trim()) ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="file-text" size={18} color={(job.notes && job.notes.trim()) ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Notes</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={(job.notes && job.notes.trim()) ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={(job.notes && job.notes.trim()) ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: (job.notes && job.notes.trim()) ? colors.success : colors.destructive }]}>
                      {(job.notes && job.notes.trim()) ? 'Added' : 'None'}
                    </Text>
                  </View>
                </View>
                {job.notes && job.notes.trim() && (
                  <Text style={[styles.completionSectionDetail, { marginTop: spacing.xs }]} numberOfLines={3}>
                    {job.notes}
                  </Text>
                )}
              </View>

              {/* Time Tracked Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: timeEntries.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="clock" size={18} color={timeEntries.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Time Tracked</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={timeEntries.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={timeEntries.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: timeEntries.length > 0 ? colors.success : colors.destructive }]}>
                      {timeEntries.length > 0 ? (() => {
                        const totalMs = timeEntries.reduce((sum, entry) => {
                          if (!entry.startTime || !entry.endTime) return sum;
                          return sum + (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime());
                        }, 0);
                        const hours = Math.floor(totalMs / (1000 * 60 * 60));
                        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
                        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                      })() : 'None'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Signatures Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: signatures.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="edit-3" size={18} color={signatures.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Signatures</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={signatures.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={signatures.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: signatures.length > 0 ? colors.success : colors.destructive }]}>
                      {signatures.length > 0 ? `${signatures.length} signature${signatures.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Voice Notes Section */}
              <View style={styles.completionSection}>
                <View style={styles.completionSectionHeader}>
                  <View style={[styles.completionSectionIcon, { backgroundColor: voiceNotes.length > 0 ? colors.success + '15' : colors.destructive + '15' }]}>
                    <Feather name="mic" size={18} color={voiceNotes.length > 0 ? colors.success : colors.destructive} />
                  </View>
                  <Text style={styles.completionSectionTitle}>Voice Notes</Text>
                  <View style={styles.completionSectionStatus}>
                    <Feather 
                      name={voiceNotes.length > 0 ? 'check-circle' : 'x-circle'} 
                      size={18} 
                      color={voiceNotes.length > 0 ? colors.success : colors.destructive} 
                    />
                    <Text style={[styles.completionStatusText, { color: voiceNotes.length > 0 ? colors.success : colors.destructive }]}>
                      {voiceNotes.length > 0 ? `${voiceNotes.length} recording${voiceNotes.length !== 1 ? 's' : ''}` : 'None'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Empty Job Warning */}
              {photos.length === 0 && (!job.notes || !job.notes.trim()) && timeEntries.length === 0 && signatures.length === 0 && voiceNotes.length === 0 && (
                <View style={styles.completionWarning}>
                  <View style={styles.completionWarningHeader}>
                    <Feather name="alert-triangle" size={20} color={colors.warning} />
                    <Text style={styles.completionWarningTitle}>No Documentation</Text>
                  </View>
                  <Text style={styles.completionWarningText}>
                    This job has no photos, notes, time tracked, signatures, or voice notes. Consider adding documentation before completing to keep accurate records.
                  </Text>
                </View>
              )}
            </ScrollView>
            
            {/* Footer Buttons */}
            <View style={styles.completionFooter}>
              <TouchableOpacity 
                style={[styles.completionButton, styles.completionButtonSecondary]} 
                onPress={() => setShowCompletionModal(false)}
              >
                <Text style={[styles.completionButtonText, styles.completionButtonTextSecondary]}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.completionButton, styles.completionButtonPrimary]} 
                onPress={handleConfirmComplete}
                disabled={isCompletingJob}
              >
                {isCompletingJob ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.completionButtonText}>Complete Job</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Schedule Job Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Job</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <Feather name="x" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: spacing.md }}>
                Select date and time for this job:
              </Text>
              
              {/* Date Picker Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
                <Text style={{ color: colors.foreground, flex: 1, fontSize: 15 }}>
                  {scheduleDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              {/* Time Picker Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                }}
                onPress={() => setShowTimePicker(true)}
              >
                <Feather name="clock" size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
                <Text style={{ color: colors.foreground, flex: 1, fontSize: 15 }}>
                  {scheduleDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              {/* Custom Date Picker */}
              {showDatePicker && (
                <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' }}>Select Date</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 180 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {Array.from({ length: 30 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() + i);
                        const isSelected = scheduleDate.toDateString() === date.toDateString();
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              const newDate = new Date(scheduleDate);
                              newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                              setScheduleDate(newDate);
                            }}
                            style={{
                              padding: spacing.md,
                              backgroundColor: isSelected ? colors.primary : colors.background,
                              borderRadius: radius.md,
                              minWidth: 70,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: 12 }}>
                              {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                            </Text>
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: 18, fontWeight: '700' }}>
                              {date.getDate()}
                            </Text>
                            <Text style={{ color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontSize: 12 }}>
                              {date.toLocaleDateString('en-AU', { month: 'short' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md, alignItems: 'center' }}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Custom Time Picker */}
              {showTimePicker && (
                <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' }}>Select Time</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
                    {/* Hours */}
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: spacing.xs }}>Hour</Text>
                      <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                        {Array.from({ length: 24 }, (_, h) => {
                          const isSelected = scheduleDate.getHours() === h;
                          return (
                            <TouchableOpacity
                              key={h}
                              onPress={() => {
                                const newDate = new Date(scheduleDate);
                                newDate.setHours(h);
                                setScheduleDate(newDate);
                              }}
                              style={{
                                padding: spacing.sm,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                                borderRadius: radius.sm,
                                minWidth: 50,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: 16, fontWeight: isSelected ? '700' : '400' }}>
                                {h.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 24, alignSelf: 'center' }}>:</Text>
                    {/* Minutes */}
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: spacing.xs }}>Minute</Text>
                      <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                        {[0, 15, 30, 45].map((m) => {
                          const isSelected = scheduleDate.getMinutes() === m;
                          return (
                            <TouchableOpacity
                              key={m}
                              onPress={() => {
                                const newDate = new Date(scheduleDate);
                                newDate.setMinutes(m);
                                setScheduleDate(newDate);
                              }}
                              style={{
                                padding: spacing.sm,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                                borderRadius: radius.sm,
                                minWidth: 50,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontSize: 16, fontWeight: isSelected ? '700' : '400' }}>
                                {m.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md, alignItems: 'center' }}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                  }}
                  onPress={() => setShowScheduleModal(false)}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                  }}
                  onPress={handleConfirmSchedule}
                >
                  <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 15 }}>Schedule Job</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
