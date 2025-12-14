import { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Slider } from '../../src/components/ui/Slider';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/lib/api';
import { useJobsStore, useTimeTrackingStore } from '../../src/lib/store';
import { Button } from '../../src/components/ui/Button';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';
import { VoiceRecorder, VoiceNotePlayer } from '../../src/components/VoiceRecorder';
import { SignaturePad } from '../../src/components/SignaturePad';
import { JobForms } from '../../src/components/FormRenderer';
import SmartActionsPanel, { SmartAction, getJobSmartActions } from '../../src/components/SmartActionsPanel';
import { JobProgressBar, LinkedDocumentsCard, NextActionCard } from '../../src/components/JobWorkflowComponents';

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
}

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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginRight: spacing.sm,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoButton: {
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
  deletePhotoText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
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
});

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isUploadingVoiceNote, setIsUploadingVoiceNote] = useState(false);
  
  const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  
  const [sliderRadius, setSliderRadius] = useState(100);
  
  const [timeEntries, setTimeEntries] = useState<CompletedTimeEntry[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [isConvertingToInvoice, setIsConvertingToInvoice] = useState(false);
  
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'photos' | 'notes'>('overview');
  
  const { updateJobStatus, updateJobNotes } = useJobsStore();
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

  useEffect(() => {
    loadJob();
    fetchActiveTimer();
    loadPhotos();
    loadVoiceNotes();
    loadSignatures();
    loadRelatedDocuments();
    loadTimeEntries();
    loadActivityLog();
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
          router.push(`/more/create-invoice?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'create_quote':
          router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`);
          return true;

        case 'mark_complete':
          await api.patch(`/api/jobs/${job.id}/status`, { status: 'done' });
          await loadJob();
          Alert.alert('Success', 'Job marked as complete');
          return true;

        case 'send_invoice_email':
          // Use the API endpoint that sends invoice with PDF (matching web behavior)
          if (invoice?.id) {
            try {
              await api.post(`/api/invoices/${invoice.id}/send`, {});
              Alert.alert('Success', 'Invoice sent to client');
            } catch {
              // Fall back to native email if API fails
              if (client?.email) {
                await Linking.openURL(`mailto:${client.email}?subject=Invoice for ${job.title}`);
              }
            }
          } else if (client?.email) {
            await Linking.openURL(`mailto:${client.email}?subject=Invoice for ${job.title}`);
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
          if (quote?.id) {
            try {
              await api.post(`/api/quotes/${quote.id}/send`, {});
              Alert.alert('Success', 'Quote sent to client');
            } catch {
              if (client?.email) {
                await Linking.openURL(`mailto:${client.email}?subject=Quote for ${job.title}`);
              }
            }
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
    setIsLoading(true);
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
    setIsLoading(false);
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
      await api.post(`/api/jobs/${job.id}/signatures`, data);
      await loadSignatures();
      setShowSignaturePad(false);
      Alert.alert('Success', 'Signature captured successfully');
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'Failed to save signature');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const handleDeleteSignature = async (signatureId: string) => {
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
            try {
              await api.delete(`/api/jobs/${job.id}/signatures/${signatureId}`);
              setSignatures(signatures.filter(s => s.id !== signatureId));
            } catch (error) {
              console.error('Error deleting signature:', error);
              Alert.alert('Error', 'Failed to delete signature');
            }
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
          setInvoice({
            id: response.data.linkedInvoice.id,
            number: response.data.linkedInvoice.number,
            title: response.data.linkedInvoice.title,
            total: parseFloat(response.data.linkedInvoice.total) || 0,
            status: response.data.linkedInvoice.status,
            dueDate: response.data.linkedInvoice.dueDate,
            paidAmount: 0, // Not in the response, default to 0
          });
        } else {
          setInvoice(null);
        }
      }
    } catch (error) {
      console.log('Error loading linked documents:', error);
      // Clear the state on error
      setQuote(null);
      setInvoice(null);
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
      loadActivityLog()
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
    if (job?.address) {
      const encodedAddress = encodeURIComponent(job.address);
      const url = Platform.select({
        ios: `maps:?q=${encodedAddress}`,
        android: `geo:0,0?q=${encodedAddress}`,
        default: `https://maps.google.com/?q=${encodedAddress}`,
      });
      Linking.openURL(url);
    }
  };

  const handleViewClient = () => {
    if (client?.id) {
      router.push(`/more/client/${client.id}`);
    }
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
      router.push(`/more/create-invoice?jobId=${job.id}`);
      return;
    }

    // Guardrail: Warn if completing an "empty" job (no photos, notes, or time tracked)
    if (action.next === 'done') {
      const hasPhotos = photos.length > 0;
      const hasNotes = job.notes && job.notes.trim().length > 0;
      // Count ANY time entries (active or completed) - not just completed ones
      const hasTimeTracked = timeEntries.length > 0;
      const hasSignatures = signatures.length > 0;
      const hasVoiceNotes = voiceNotes.length > 0;
      
      const isEmptyJob = !hasPhotos && !hasNotes && !hasTimeTracked && !hasSignatures && !hasVoiceNotes;
      
      if (isEmptyJob) {
        Alert.alert(
          'Complete Job?',
          'This job has no photos, notes, time tracked, or signatures. Are you sure you want to mark it as complete?\n\nConsider adding documentation before completing.',
          [
            { text: 'Go Back', style: 'cancel' },
            {
              text: 'Complete Anyway',
              style: 'destructive',
              onPress: async () => {
                const success = await updateJobStatus(job.id, 'done');
                if (success) {
                  setJob({ ...job, status: 'done' });
                }
              }
            }
          ]
        );
        return;
      }
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

  const handleSaveNotes = async () => {
    if (!job) return;
    
    setIsSavingNotes(true);
    try {
      const response = await api.patch(`/api/jobs/${job.id}`, { notes: editedNotes });
      if (response.data) {
        setJob({ ...job, notes: editedNotes });
        setShowNotesModal(false);
        Alert.alert('Saved', 'Notes updated successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save notes. Please try again.');
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
      uploadPhoto(result.assets[0].uri);
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
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!job) return;
    
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('photo', {
        uri,
        name: filename,
        type,
      } as any);
      formData.append('jobId', job.id);

      const response = await api.post(`/api/jobs/${job.id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data) {
        await loadPhotos();
        Alert.alert('Success', 'Photo uploaded successfully');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const newPhoto: JobPhoto = {
        id: Date.now().toString(),
        url: uri,
        createdAt: new Date().toISOString(),
      };
      setPhotos([...photos, newPhoto]);
      Alert.alert('Photo Saved', 'Photo saved locally. Will sync when online.');
    }
    setIsUploadingPhoto(false);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const action = STATUS_ACTIONS[job.status];
  const statusColor = getStatusColor(job.status);
  const clientInitials = client?.name ? client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

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

      {/* Next Action Card - CTA when job is done without invoice */}
      <NextActionCard
        jobStatus={job.status}
        hasInvoice={!!invoice}
        hasQuote={!!quote}
        onCreateInvoice={() => router.push(`/more/create-invoice?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

      {/* Smart Actions Panel - Show when job has suggested actions */}
      {smartActions.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <SmartActionsPanel
            title="Next Steps"
            subtitle="Suggested actions for this job"
            actions={smartActions}
            onActionToggle={handleSmartActionToggle}
            onActionExecute={handleSmartActionExecute}
            onExecuteAll={handleExecuteAllActions}
            onSkipAll={handleSkipAllActions}
            isExecuting={isExecutingActions}
            entityType="job"
          />
        </View>
      )}

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

      {/* Scheduled Date Card */}
      <View style={styles.card}>
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
      </View>

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

      {/* Time Tracking Card */}
      {(job.status === 'scheduled' || job.status === 'in_progress') && (
        <View style={[styles.timerCard, isTimerForThisJob && styles.timerActiveCard]}>
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
        </View>
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
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={() => router.push(`/more/create-invoice?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

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

      {/* Main Action Button */}
      <View style={styles.actionButtonContainer}>
        {action ? (
          <TouchableOpacity
            style={[styles.mainActionButton, { backgroundColor: statusColor }]}
            onPress={handleStatusChange}
            activeOpacity={0.8}
          >
            <View style={styles.mainActionButtonIcon}>
              <Feather name={action.icon} size={action.iconSize} color={colors.primaryForeground} />
            </View>
            <Text style={styles.mainActionText}>{action.label}</Text>
          </TouchableOpacity>
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
        jobStatus={job.status}
        onViewQuote={handleViewQuote}
        onViewInvoice={handleViewInvoice}
        onCreateQuote={() => router.push(`/more/quote/new?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
        onCreateInvoice={() => router.push(`/more/create-invoice?jobId=${job.id}${client ? `&clientId=${client.id}` : ''}`)}
      />

      {/* Custom Forms Section */}
      {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && (
        <View style={styles.photosCard}>
          <JobForms jobId={job.id} readOnly={job.status === 'invoiced'} />
        </View>
      )}

      {/* Client Signature Section */}
      {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && (
        <View style={styles.photosCard}>
          <View style={styles.photosHeader}>
            <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="edit-3" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.photosHeaderLabel}>Client Signature</Text>
          </View>
          
          {showSignaturePad ? (
            <View style={{ gap: spacing.md }}>
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
                placeholder="Client's name *"
                placeholderTextColor={colors.mutedForeground}
                value={signerName}
                onChangeText={setSignerName}
              />
              <SignaturePad
                onSave={(signatureData) => {
                  if (!signerName.trim()) {
                    Alert.alert('Error', 'Please enter the client\'s name');
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
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.takePhotoInlineButton, { flex: 1, backgroundColor: colors.muted, minHeight: 44 }]}
                  onPress={() => {
                    setShowSignaturePad(false);
                    setSignerName('');
                  }}
                  activeOpacity={0.7}
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
                    <View>
                      <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                        Signed by {sig.signerName}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {new Date(sig.signedAt).toLocaleDateString('en-AU', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => handleDeleteSignature(sig.id)}
                      style={{ padding: spacing.xs }}
                    >
                      <Feather name="trash-2" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ 
                    marginTop: spacing.sm, 
                    backgroundColor: colors.card, 
                    borderRadius: 8, 
                    padding: spacing.sm,
                    alignItems: 'center',
                  }}>
                    <Feather name="check-circle" size={24} color={colors.success} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      Signature captured
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyPhotosContainer}>
              <TouchableOpacity 
                style={styles.takePhotoInlineButton}
                onPress={() => setShowSignaturePad(true)}
                activeOpacity={0.7}
              >
                <Feather name="edit-3" size={18} color={colors.primaryForeground} />
                <Text style={styles.takePhotoInlineText}>Capture Client Signature</Text>
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
                  onPress={() => setSelectedPhoto(photo)}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: photo.signedUrl || photo.thumbnailUrl || photo.url || '' }} 
                    style={styles.inlinePhotoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.addPhotoButton}
                onPress={() => setShowPhotosModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={iconSizes.xl} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.emptyPhotosContainer, { marginTop: spacing.md }]}>
              <TouchableOpacity 
                style={styles.takePhotoInlineButton}
                onPress={handleTakePhoto}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <View style={styles.takePhotoInlineButtonIcon}>
                      <Feather name="camera" size={18} color={colors.primaryForeground} />
                    </View>
                    <Text style={styles.takePhotoInlineText}>Take Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.galleryInlineButton}
                onPress={handlePickPhoto}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                <View style={styles.galleryInlineButtonIcon}>
                  <Feather name="image" size={18} color={colors.foreground} />
                </View>
                <Text style={styles.galleryInlineText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyPhotosContainer}>
            <TouchableOpacity 
              style={styles.takePhotoInlineButton}
              onPress={handleTakePhoto}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <View style={styles.takePhotoInlineButtonIcon}>
                    <Feather name="camera" size={18} color={colors.primaryForeground} />
                  </View>
                  <Text style={styles.takePhotoInlineText}>Take Photo</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.galleryInlineButton}
              onPress={handlePickPhoto}
              disabled={isUploadingPhoto}
              activeOpacity={0.7}
            >
              <View style={styles.galleryInlineButtonIcon}>
                <Feather name="image" size={18} color={colors.foreground} />
              </View>
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
                uri={note.signedUrl || ''}
                title={note.title || undefined}
                duration={note.duration || undefined}
                createdAt={note.createdAt || undefined}
                onDelete={() => handleDeleteVoiceNote(note.id)}
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
                  try {
                    await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceEnabled: value });
                    setJob({ ...job, geofenceEnabled: value });
                  } catch (e) {
                    Alert.alert('Error', 'Failed to update geofence settings');
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
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceRadius: value });
                        setJob({ ...job, geofenceRadius: value });
                      } catch (e) {
                        Alert.alert('Error', 'Failed to update radius');
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
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockIn: value });
                        setJob({ ...job, geofenceAutoClockIn: value });
                      } catch (e) {
                        Alert.alert('Error', 'Failed to update setting');
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
                      try {
                        await api.patch(`/api/jobs/${job.id}/geofence`, { geofenceAutoClockOut: value });
                        setJob({ ...job, geofenceAutoClockOut: value });
                      } catch (e) {
                        Alert.alert('Error', 'Failed to update setting');
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
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: '',
          headerBackTitle: 'Back',
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
                  <Text style={styles.photosEmptyText}>No photos yet</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {photos.map((photo) => (
                    <TouchableOpacity 
                      key={photo.id}
                      style={styles.photoItem}
                      onPress={() => setSelectedPhoto(photo)}
                    >
                      <Image 
                        source={{ uri: photo.signedUrl || photo.url || photo.thumbnailUrl || '' }} 
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.photoActions}>
                <TouchableOpacity 
                  style={styles.photoActionButton}
                  onPress={handleTakePhoto}
                  disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="camera" size={18} color={colors.primaryForeground} />
                      <Text style={styles.photoActionText}>Take Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.photoActionButton, styles.photoActionButtonSecondary]}
                  onPress={handlePickPhoto}
                  disabled={isUploadingPhoto}
                >
                  <Feather name="image" size={18} color={colors.foreground} />
                  <Text style={[styles.photoActionText, styles.photoActionTextSecondary]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Photo Preview Modal */}
      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <View style={styles.photoPreviewModal}>
          {selectedPhoto && (
            <>
              <Image 
                source={{ uri: selectedPhoto.signedUrl || selectedPhoto.url || '' }} 
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              <TouchableOpacity 
                style={styles.closePhotoButton}
                onPress={() => setSelectedPhoto(null)}
              >
                <Feather name="x" size={24} color={colors.primaryForeground} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deletePhotoButton}
                onPress={() => handleDeletePhoto(selectedPhoto)}
              >
                <Feather name="trash-2" size={18} color={colors.primaryForeground} />
                <Text style={styles.deletePhotoText}>Delete Photo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}
