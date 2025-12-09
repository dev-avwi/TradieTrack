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
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import api from '../../src/lib/api';
import { useJobsStore, useTimeTrackingStore, useAuthStore } from '../../src/lib/store';
import { Button } from '../../src/components/ui/Button';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';
import { VoiceNotes } from '../../src/components/VoiceNotes';
import { JobCosting } from '../../src/components/JobCosting';
import { JobChat } from '../../src/components/JobChat';

interface Job {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  notes?: string;
  estimatedHours?: number;
  estimatedCost?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  completedAt?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceLabel?: string;
  parentJobId?: string;
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
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt: string;
}

interface JobSignature {
  id: string;
  signatureData: string;
  signerName: string;
  signatureType: 'customer' | 'technician';
  createdAt: string;
}

interface SignaturePoint {
  x: number;
  y: number;
}

interface FormField {
  id: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea' | 'signature' | 'photo' | 'date' | 'time';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  fields: FormField[];
  isActive: boolean;
}

interface FormResponse {
  id: string;
  jobId: string;
  templateId: string;
  userId: string;
  responses: Record<string, any>;
  submittedAt: string;
  photos?: string[];
}

interface JobActivity {
  id: string;
  jobId: string;
  userId?: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  isSystemGenerated?: boolean;
  createdAt: string;
  userName?: string;
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
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  recurringBadgeText: {
    fontSize: 11,
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
  signatureCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  signatureCountText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '600',
  },
  signatureModalContent: {
    padding: spacing.lg,
  },
  signatureInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  signatureInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  signatureTypeContainer: {
    marginBottom: spacing.lg,
  },
  signatureTypeRow: {
    flexDirection: 'row',
  },
  signatureTypeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  signatureTypeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  signatureTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  signatureTypeTextActive: {
    color: colors.primary,
  },
  signatureCanvasContainer: {
    marginBottom: spacing.lg,
  },
  signatureCanvasLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  signatureCanvas: {
    height: 200,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  signatureCanvasPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureCanvasPlaceholderText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  signatureButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  clearSignatureButton: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  clearSignatureButtonText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  saveSignatureButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  saveSignatureButtonDisabled: {
    backgroundColor: colors.muted,
  },
  saveSignatureButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  signaturesSection: {
    marginBottom: spacing.xl,
  },
  signaturesScrollView: {
    flexDirection: 'row',
  },
  signaturesScrollContent: {
    paddingRight: spacing.md,
  },
  signatureItem: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  signatureItemImage: {
    width: '100%',
    height: 80,
    backgroundColor: colors.white,
  },
  signatureItemInfo: {
    padding: spacing.sm,
  },
  signatureItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  signatureItemType: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  signatureTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  signatureTypeBadgeCustomer: {
    backgroundColor: `${colors.scheduled}20`,
  },
  signatureTypeBadgeTechnician: {
    backgroundColor: `${colors.success}20`,
  },
  signatureTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noSignaturesContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  noSignaturesText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontStyle: 'italic',
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
  
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatures, setSignatures] = useState<JobSignature[]>([]);
  const [signatureSignerName, setSignatureSignerName] = useState('');
  const [signatureType, setSignatureType] = useState<'customer' | 'technician'>('customer');
  const [signaturePoints, setSignaturePoints] = useState<SignaturePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignaturePoint[]>([]);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signatureCanvasLayout, setSignatureCanvasLayout] = useState({ width: 0, height: 0 });
  
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [selectedFormTemplate, setSelectedFormTemplate] = useState<FormTemplate | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  const [activities, setActivities] = useState<JobActivity[]>([]);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [showAddDiaryEntry, setShowAddDiaryEntry] = useState(false);
  const [newDiaryEntry, setNewDiaryEntry] = useState({ activityType: 'note', title: '', description: '' });
  const [isSubmittingDiaryEntry, setIsSubmittingDiaryEntry] = useState(false);
  
  const [linkedQuote, setLinkedQuote] = useState<Quote | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [isLoadingLinkedDocs, setIsLoadingLinkedDocs] = useState(true);
  const [linkedDocsError, setLinkedDocsError] = useState<string | null>(null);
  const [isDiaryExpanded, setIsDiaryExpanded] = useState(false);
  
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
  const { user } = useAuthStore();

  const isTimerForThisJob = activeTimer?.jobId === id;

  useEffect(() => {
    loadJob();
    fetchActiveTimer();
    loadPhotos();
    loadSignatures();
    loadRelatedDocuments();
    loadForms();
    loadActivities();
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

  const loadJob = async () => {
    setIsLoading(true);
    const response = await api.get<Job>(`/api/jobs/${id}`);
    if (response.data) {
      setJob(response.data);
      setEditedNotes(response.data.notes || '');
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

  const loadSignatures = async () => {
    try {
      const response = await api.get<JobSignature[]>(`/api/jobs/${id}/signatures`);
      if (response.data) {
        setSignatures(response.data);
      }
    } catch (error) {
      console.log('No signatures or error loading:', error);
      setSignatures([]);
    }
  };

  const loadForms = async () => {
    try {
      const [templatesRes, responsesRes] = await Promise.all([
        api.get<FormTemplate[]>('/api/job-forms/templates'),
        api.get<FormResponse[]>(`/api/jobs/${id}/forms`),
      ]);
      if (templatesRes.data) {
        setFormTemplates(templatesRes.data.filter(t => t.isActive));
      }
      if (responsesRes.data) {
        setFormResponses(responsesRes.data);
      }
    } catch (error) {
      console.log('Error loading forms:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const response = await api.get<JobActivity[]>(`/api/jobs/${id}/activities`);
      if (response.data) {
        setActivities(response.data);
      }
    } catch (error) {
      console.log('Error loading activities:', error);
      setActivities([]);
    }
  };

  const handleAddDiaryEntry = async () => {
    if (!newDiaryEntry.title.trim()) {
      Alert.alert('Required', 'Please enter a title for this entry');
      return;
    }
    
    setIsSubmittingDiaryEntry(true);
    try {
      const response = await api.post(`/api/jobs/${id}/activities`, newDiaryEntry);
      if (response.data) {
        await loadActivities();
        setShowAddDiaryEntry(false);
        setNewDiaryEntry({ activityType: 'note', title: '', description: '' });
        Alert.alert('Success', 'Diary entry added');
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add entry. Please try again.');
    } finally {
      setIsSubmittingDiaryEntry(false);
    }
  };

  const getActivityIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      note: 'edit-3',
      status_change: 'check-circle',
      photo: 'camera',
      email_sent: 'mail',
      sms_sent: 'message-square',
      call: 'phone',
      payment: 'dollar-sign',
      checkin: 'map-pin',
      checkout: 'log-out',
      form_submitted: 'file-text',
      signature: 'edit-2',
      issue: 'alert-triangle',
      material_added: 'package',
    };
    return iconMap[type] || 'activity';
  };

  const getActivityColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      note: colors.primary,
      status_change: '#22c55e',
      photo: '#a855f7',
      email_sent: '#f97316',
      sms_sent: '#14b8a6',
      call: '#06b6d4',
      payment: '#10b981',
      checkin: '#6366f1',
      checkout: '#f43f5e',
      form_submitted: '#f59e0b',
      issue: '#ef4444',
      material_added: '#eab308',
    };
    return colorMap[type] || colors.mutedForeground;
  };

  const formatActivityDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const handleFormSubmit = async (templateId: string, responses: Record<string, any>, photos: string[]) => {
    setIsSubmittingForm(true);
    try {
      const response = await api.post(`/api/jobs/${id}/forms`, {
        templateId,
        responses,
        photos,
      });
      
      if (response.data) {
        await loadForms();
        setShowFormsModal(false);
        setSelectedFormTemplate(null);
        Alert.alert('Success', 'Form submitted successfully');
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error: any) {
      console.error('Form submit error:', error);
      Alert.alert('Error', 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const getTemplateNameById = (templateId: string) => {
    const template = formTemplates.find(t => t.id === templateId);
    return template?.name || 'Unknown Form';
  };

  const handleSignatureTouch = (event: any, isStart: boolean) => {
    const { locationX, locationY } = event.nativeEvent;
    const point: SignaturePoint = { x: locationX, y: locationY };
    
    if (isStart) {
      setCurrentStroke([point]);
    } else {
      setCurrentStroke(prev => [...prev, point]);
    }
  };

  const handleSignatureTouchEnd = () => {
    if (currentStroke.length > 0) {
      setSignaturePoints(prev => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const clearSignature = () => {
    setSignaturePoints([]);
    setCurrentStroke([]);
  };

  const openSignatureModal = () => {
    setSignatureSignerName(client?.name || '');
    setSignatureType('customer');
    clearSignature();
    setShowSignatureModal(true);
  };

  const generateSignatureSvgPath = (): string => {
    const allStrokes = [...signaturePoints, currentStroke].filter(s => s.length > 0);
    let pathData = '';
    
    allStrokes.forEach(stroke => {
      if (stroke.length > 0) {
        pathData += `M ${stroke[0].x} ${stroke[0].y} `;
        for (let i = 1; i < stroke.length; i++) {
          pathData += `L ${stroke[i].x} ${stroke[i].y} `;
        }
      }
    });
    
    return pathData;
  };

  const generateSignatureDataUrl = (): string => {
    const { width, height } = signatureCanvasLayout;
    if (width === 0 || height === 0) return '';
    
    const pathData = generateSignatureSvgPath();
    if (!pathData) return '';
    
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="white"/>
      <path d="${pathData}" stroke="#1f2733" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    const base64 = btoa(svgContent);
    return `data:image/svg+xml;base64,${base64}`;
  };

  const handleSaveSignature = async () => {
    if (!job) return;
    
    if (!signatureSignerName.trim()) {
      Alert.alert('Error', 'Please enter the signer name');
      return;
    }
    
    if (signaturePoints.length === 0) {
      Alert.alert('Error', 'Please draw a signature');
      return;
    }
    
    setIsSavingSignature(true);
    try {
      const signatureData = generateSignatureDataUrl();
      
      const response = await api.post(`/api/jobs/${job.id}/signatures`, {
        signatureData,
        signerName: signatureSignerName.trim(),
        signatureType,
      });
      
      if (response.data) {
        await loadSignatures();
        setShowSignatureModal(false);
        clearSignature();
        setSignatureSignerName('');
        Alert.alert('Success', 'Signature saved successfully');
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error: any) {
      console.error('Save signature error:', error);
      Alert.alert('Error', 'Failed to save signature. Please try again.');
    }
    setIsSavingSignature(false);
  };

  const loadRelatedDocuments = async () => {
    setIsLoadingLinkedDocs(true);
    setLinkedDocsError(null);
    try {
      const response = await api.get<{
        jobId: string;
        linkedQuote: { id: string; quoteNumber?: string; title?: string; status: string; total: string } | null;
        linkedInvoice: { id: string; invoiceNumber?: string; title?: string; status: string; total: string; dueDate?: string } | null;
      }>(`/api/jobs/${id}/linked-documents`);
      
      if (response.data) {
        if (response.data.linkedQuote) {
          const q = response.data.linkedQuote;
          setLinkedQuote({
            id: q.id,
            number: q.quoteNumber || '',
            title: q.title || '',
            total: parseFloat(q.total) || 0,
            status: q.status as Quote['status'],
          });
          setQuote({
            id: q.id,
            number: q.quoteNumber || '',
            title: q.title || '',
            total: parseFloat(q.total) || 0,
            status: q.status as Quote['status'],
          });
        } else {
          setLinkedQuote(null);
          setQuote(null);
        }
        
        if (response.data.linkedInvoice) {
          const inv = response.data.linkedInvoice;
          setLinkedInvoice({
            id: inv.id,
            number: inv.invoiceNumber || '',
            title: inv.title || '',
            total: parseFloat(inv.total) || 0,
            status: inv.status as Invoice['status'],
            dueDate: inv.dueDate,
          });
          setInvoice({
            id: inv.id,
            number: inv.invoiceNumber || '',
            title: inv.title || '',
            total: parseFloat(inv.total) || 0,
            status: inv.status as Invoice['status'],
            dueDate: inv.dueDate,
          });
        } else {
          setLinkedInvoice(null);
          setInvoice(null);
        }
      }
    } catch (error) {
      console.error('Error loading linked documents:', error);
      setLinkedDocsError('Failed to load linked documents');
      setLinkedQuote(null);
      setLinkedInvoice(null);
    } finally {
      setIsLoadingLinkedDocs(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadJob(), loadPhotos(), loadRelatedDocuments()]);
    setRefreshing(false);
  };

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
            if (!success) {
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

  return (
    <>
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
      <ScrollView 
        style={styles.container}
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <StatusBadge status={job.status} />
            {job.isRecurring && (
              <View style={[styles.recurringBadge, { marginLeft: spacing.sm }]}>
                <Feather name="repeat" size={12} color={colors.primary} />
                <Text style={[styles.recurringBadgeText, { color: colors.primary }]}>
                  {job.recurrenceLabel || 'Recurring'}
                </Text>
              </View>
            )}
            {job.parentJobId && !job.isRecurring && (
              <View style={[styles.recurringBadge, { marginLeft: spacing.sm, backgroundColor: `${colors.border}80` }]}>
                <Feather name="repeat" size={12} color={colors.foreground} style={{ opacity: 0.7 }} />
                <Text style={[styles.recurringBadgeText, { color: colors.foreground, opacity: 0.8 }]}>Part of series</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{job.title}</Text>
          {job.description && (
            <Text style={styles.description}>{job.description}</Text>
          )}
        </View>

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

        {/* Linked Documents Section */}
        {(linkedQuote || linkedInvoice || job.status === 'done' || job.status === 'invoiced' || isLoadingLinkedDocs) && (
          <View style={[styles.card, { paddingVertical: spacing.lg }]} data-testid="section-linked-documents">
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${colors.invoiced}15`, marginRight: spacing.md }]}>
                <Feather name="link" size={iconSizes.lg} color={colors.invoiced} />
              </View>
              <Text style={{ ...typography.subtitle, color: colors.foreground, flex: 1 }}>Linked Documents</Text>
            </View>
            
            {isLoadingLinkedDocs ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.sm }}>
                  Loading linked documents...
                </Text>
              </View>
            ) : linkedDocsError ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Feather name="alert-circle" size={24} color={colors.destructive} />
                <Text style={{ ...typography.caption, color: colors.destructive, marginTop: spacing.sm }}>
                  {linkedDocsError}
                </Text>
                <TouchableOpacity 
                  style={{ marginTop: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}
                  onPress={loadRelatedDocuments}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : linkedQuote ? (
              <TouchableOpacity 
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={handleViewQuote}
                activeOpacity={0.7}
                data-testid="card-linked-quote"
              >
                <View style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: radius.md, 
                  backgroundColor: `${colors.scheduled}15`,
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}>
                  <Feather name="file" size={18} color={colors.scheduled} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600' }}>
                    Quote #{linkedQuote.number}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                    {formatCurrency(linkedQuote.total)}
                  </Text>
                </View>
                <View style={[
                  styles.documentStatusBadge, 
                  { backgroundColor: `${linkedQuote.status === 'accepted' ? colors.success : colors.scheduled}20` }
                ]}>
                  <Text style={[
                    styles.documentStatusText, 
                    { color: linkedQuote.status === 'accepted' ? colors.success : colors.scheduled }
                  ]}>
                    {linkedQuote.status}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
              </TouchableOpacity>
            ) : job.status !== 'invoiced' && (
              <TouchableOpacity 
                style={{
                  backgroundColor: `${colors.scheduled}10`,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: `${colors.scheduled}30`,
                  borderStyle: 'dashed',
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => router.push(`/quotes/create?jobId=${id}`)}
                activeOpacity={0.7}
                data-testid="button-create-quote"
              >
                <Feather name="plus" size={16} color={colors.scheduled} style={{ marginRight: spacing.xs }} />
                <Text style={{ color: colors.scheduled, fontWeight: '600' }}>Create Quote</Text>
              </TouchableOpacity>
            )}
            
            {linkedInvoice ? (
              <TouchableOpacity 
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={handleViewInvoice}
                activeOpacity={0.7}
                data-testid="card-linked-invoice"
              >
                <View style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: radius.md, 
                  backgroundColor: `${colors.invoiced}15`,
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}>
                  <Feather name="file-text" size={18} color={colors.invoiced} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600' }}>
                    Invoice #{linkedInvoice.number}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                    {formatCurrency(linkedInvoice.total)}
                  </Text>
                </View>
                <View style={[
                  styles.documentStatusBadge, 
                  { backgroundColor: `${getInvoiceStatusColor(linkedInvoice.status)}20` }
                ]}>
                  <Text style={[
                    styles.documentStatusText, 
                    { color: getInvoiceStatusColor(linkedInvoice.status) }
                  ]}>
                    {linkedInvoice.status}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
              </TouchableOpacity>
            ) : job.status === 'done' && (
              <TouchableOpacity 
                style={{
                  backgroundColor: `${colors.invoiced}10`,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: `${colors.invoiced}30`,
                  borderStyle: 'dashed',
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => router.push(`/invoices/create?jobId=${id}`)}
                activeOpacity={0.7}
                data-testid="button-create-invoice"
              >
                <Feather name="plus" size={16} color={colors.invoiced} style={{ marginRight: spacing.xs }} />
                <Text style={{ color: colors.invoiced, fontWeight: '600' }}>Create Invoice</Text>
              </TouchableOpacity>
            )}
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

        {/* Notes Section - Always visible */}
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
            <Text style={styles.notesText} numberOfLines={4}>{job.notes}</Text>
          ) : (
            <View style={styles.emptyNotesPlaceholder}>
              <Text style={styles.emptyNotesText}>Tap to add notes about this job...</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Photos Section - Always visible */}
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.photosScrollView}
              contentContainerStyle={styles.photosScrollContent}
            >
              {photos.slice(0, 5).map((photo) => (
                <TouchableOpacity 
                  key={photo.id}
                  style={styles.inlinePhotoItem}
                  onPress={() => setSelectedPhoto(photo)}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: photo.thumbnailUrl || photo.url }} 
                    style={styles.inlinePhotoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
              {photos.length > 5 && (
                <TouchableOpacity 
                  style={styles.morePhotosButton}
                  onPress={() => setShowPhotosModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.morePhotosText}>+{photos.length - 5}</Text>
                  <Text style={styles.morePhotosLabel}>more</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.addPhotoButton}
                onPress={() => setShowPhotosModal(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={iconSizes.xl} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
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

        {/* Inline Job Diary Section - Activity Timeline */}
        <View style={styles.photosCard} data-testid="section-job-diary">
          <TouchableOpacity 
            style={styles.photosHeader}
            onPress={() => setIsDiaryExpanded(!isDiaryExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.photosIconContainer}>
              <Feather name="book-open" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={styles.photosHeaderLabel}>Job Diary</Text>
            {activities.length > 0 && (
              <View style={styles.photosCountBadge}>
                <Text style={styles.photosCountText}>{activities.length}</Text>
              </View>
            )}
            <Feather 
              name={isDiaryExpanded ? "chevron-up" : "chevron-down"} 
              size={iconSizes.md} 
              color={colors.mutedForeground} 
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
          
          {isDiaryExpanded && (
            <View style={{ marginTop: spacing.sm }}>
              {activities.length > 0 ? (
                <>
                  {activities.slice(0, 5).map((activity, index) => (
                    <View 
                      key={activity.id}
                      style={{
                        flexDirection: 'row',
                        paddingVertical: spacing.sm,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: activity.activityType === 'issue' ? `${colors.destructive}15` : 
                                        activity.activityType === 'call' ? `${colors.success}15` : 
                                        activity.activityType === 'material_added' ? `${colors.invoiced}15` :
                                        `${colors.primary}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}>
                        <Feather 
                          name={activity.activityType === 'issue' ? 'alert-triangle' : 
                                activity.activityType === 'call' ? 'phone' : 
                                activity.activityType === 'material_added' ? 'package' :
                                'file-text'} 
                          size={14} 
                          color={activity.activityType === 'issue' ? colors.destructive : 
                                 activity.activityType === 'call' ? colors.success : 
                                 activity.activityType === 'material_added' ? colors.invoiced :
                                 colors.primary} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...typography.body, color: colors.foreground, fontSize: 13 }} numberOfLines={1}>
                          {activity.title}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.mutedForeground, fontSize: 11 }}>
                          {new Date(activity.timestamp).toLocaleDateString('en-AU', { 
                            day: 'numeric', 
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                          {activity.performedBy && ` • ${activity.performedBy}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {activities.length > 5 && (
                    <TouchableOpacity 
                      style={{
                        paddingVertical: spacing.sm,
                        alignItems: 'center',
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                      onPress={() => setShowDiaryModal(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '500', fontSize: 13 }}>
                        View all {activities.length} entries
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                    No diary entries yet
                  </Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: spacing.sm,
                }}
                onPress={() => {
                  setShowAddDiaryEntry(true);
                  setShowDiaryModal(true);
                }}
                activeOpacity={0.7}
                data-testid="button-add-diary-entry"
              >
                <Feather name="plus" size={16} color={colors.primaryForeground} style={{ marginRight: spacing.xs }} />
                <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 14 }}>Add Entry</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!isDiaryExpanded && activities.length > 0 && (
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>
              {activities.length} {activities.length === 1 ? 'entry' : 'entries'} • Tap to expand
            </Text>
          )}
        </View>

        {/* Voice Notes - Hands-free recording for on-site updates */}
        {(job.status === 'in_progress' || job.status === 'done') && (
          <VoiceNotes jobId={job.id} canRecord={job.status === 'in_progress'} />
        )}

        {/* Job Costing - Budget vs Actual comparison */}
        <JobCosting jobId={job.id} />

        {/* Job Chat - Team discussion for this job */}
        <JobChat jobId={job.id} currentUserId={user?.id || ''} />

        {/* Invoice Card - Show if job has an invoice */}
        {invoice && (
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <View style={[styles.documentIconContainer, { backgroundColor: `${colors.invoiced}15` }]}>
                <Feather name="file-text" size={iconSizes.xl} color={colors.invoiced} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Invoice #{invoice.number}</Text>
                <Text style={styles.documentNumber}>{invoice.title}</Text>
              </View>
              <View style={[styles.documentStatusBadge, { backgroundColor: `${getInvoiceStatusColor(invoice.status)}20` }]}>
                <Text style={[styles.documentStatusText, { color: getInvoiceStatusColor(invoice.status) }]}>
                  {invoice.status}
                </Text>
              </View>
            </View>
            <View style={styles.documentDetails}>
              <Text style={styles.documentAmount}>{formatCurrency(invoice.total)}</Text>
              <TouchableOpacity 
                style={styles.documentViewButton}
                onPress={handleViewInvoice}
                activeOpacity={0.7}
              >
                <Text style={styles.documentViewButtonText}>View Invoice</Text>
                <Feather name="chevron-right" size={16} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quote Card - Show if job has an associated quote */}
        {quote && (
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <View style={[styles.documentIconContainer, { backgroundColor: `${colors.scheduled}15` }]}>
                <Feather name="file" size={iconSizes.xl} color={colors.scheduled} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Quote #{quote.number}</Text>
                <Text style={styles.documentNumber}>{quote.title}</Text>
              </View>
              <View style={[styles.documentStatusBadge, { backgroundColor: `${quote.status === 'accepted' ? colors.success : colors.scheduled}20` }]}>
                <Text style={[styles.documentStatusText, { color: quote.status === 'accepted' ? colors.success : colors.scheduled }]}>
                  {quote.status}
                </Text>
              </View>
            </View>
            <View style={styles.documentDetails}>
              <Text style={styles.documentAmount}>{formatCurrency(quote.total)}</Text>
              <TouchableOpacity 
                style={[styles.documentViewButton, { backgroundColor: colors.scheduled }]}
                onPress={handleViewQuote}
                activeOpacity={0.7}
              >
                <Text style={styles.documentViewButtonText}>View Quote</Text>
                <Feather name="chevron-right" size={16} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.quickActionButton}
              onPress={() => setShowPhotosModal(true)}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="camera" size={iconSizes['2xl']} color={colors.primary} />
                {photos.length > 0 && (
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>{photos.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionText}>Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.quickActionButton}
              onPress={() => {
                setEditedNotes(job.notes || '');
                setShowNotesModal(true);
              }}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="file-text" size={iconSizes['2xl']} color={colors.primary} />
              </View>
              <Text style={styles.quickActionText}>Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.quickActionButton}
              onPress={openSignatureModal}
            >
              <View style={styles.quickActionIcon}>
                <Feather name="edit-3" size={iconSizes['2xl']} color={colors.primary} />
                {signatures.length > 0 && (
                  <View style={styles.signatureCountBadge}>
                    <Text style={styles.signatureCountText}>{signatures.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionText}>Signature</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.quickActionButton}
              onPress={() => setShowFormsModal(true)}
              data-testid="button-forms"
            >
              <View style={styles.quickActionIcon}>
                <Feather name="clipboard" size={iconSizes['2xl']} color={colors.primary} />
                {formResponses.length > 0 && (
                  <View style={styles.signatureCountBadge}>
                    <Text style={styles.signatureCountText}>{formResponses.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionText}>Forms</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.quickActionButton}
              onPress={() => setShowDiaryModal(true)}
              data-testid="button-diary"
            >
              <View style={styles.quickActionIcon}>
                <Feather name="book-open" size={iconSizes['2xl']} color={colors.primary} />
                {activities.length > 0 && (
                  <View style={styles.signatureCountBadge}>
                    <Text style={styles.signatureCountText}>{activities.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionText}>Diary</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Completed Forms Section */}
        {formResponses.length > 0 && (
          <View style={styles.signaturesSection}>
            <Text style={styles.sectionTitle}>Completed Forms</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.signaturesScrollView}
              contentContainerStyle={styles.signaturesScrollContent}
            >
              {formResponses.map((form) => (
                <TouchableOpacity
                  key={form.id}
                  style={[styles.signatureItem, { width: 160 }]}
                  onPress={() => {
                    const submittedDate = new Date(form.submittedAt).toLocaleDateString('en-AU');
                    Alert.alert(
                      getTemplateNameById(form.templateId),
                      `Submitted: ${submittedDate}\n\nFields completed: ${Object.keys(form.responses).length}`
                    );
                  }}
                  activeOpacity={0.7}
                  data-testid={`form-response-${form.id}`}
                >
                  <View style={{ padding: spacing.md, alignItems: 'center' }}>
                    <Feather name="check-circle" size={28} color={colors.success} />
                    <Text style={[styles.signatureItemName, { marginTop: spacing.sm, textAlign: 'center' }]} numberOfLines={2}>
                      {getTemplateNameById(form.templateId)}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>
                      {new Date(form.submittedAt).toLocaleDateString('en-AU')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Signatures Section */}
        {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && signatures.length > 0 && (
          <View style={styles.signaturesSection}>
            <Text style={styles.sectionTitle}>Signatures</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.signaturesScrollView}
              contentContainerStyle={styles.signaturesScrollContent}
            >
              {signatures.map((sig) => (
                <View key={sig.id} style={styles.signatureItem}>
                  <Image 
                    source={{ uri: sig.signatureData }} 
                    style={styles.signatureItemImage}
                    resizeMode="contain"
                  />
                  <View style={styles.signatureItemInfo}>
                    <Text style={styles.signatureItemName} numberOfLines={1}>{sig.signerName}</Text>
                    <View style={[
                      styles.signatureTypeBadge,
                      sig.signatureType === 'customer' ? styles.signatureTypeBadgeCustomer : styles.signatureTypeBadgeTechnician
                    ]}>
                      <Text style={[
                        styles.signatureTypeBadgeText, 
                        { color: sig.signatureType === 'customer' ? colors.scheduled : colors.success }
                      ]}>
                        {sig.signatureType}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
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
      </ScrollView>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Capture Signature</Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.signatureModalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.signatureInputLabel}>Signer Name</Text>
              <TextInput
                style={styles.signatureInput}
                value={signatureSignerName}
                onChangeText={setSignatureSignerName}
                placeholder="Enter signer's name..."
                placeholderTextColor={colors.mutedForeground}
              />
              
              <View style={styles.signatureTypeContainer}>
                <Text style={styles.signatureInputLabel}>Signature Type</Text>
                <View style={styles.signatureTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.signatureTypeButton,
                      signatureType === 'customer' && styles.signatureTypeButtonActive,
                      { marginRight: spacing.sm }
                    ]}
                    onPress={() => setSignatureType('customer')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.signatureTypeText,
                      signatureType === 'customer' && styles.signatureTypeTextActive
                    ]}>Customer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.signatureTypeButton,
                      signatureType === 'technician' && styles.signatureTypeButtonActive,
                      { marginLeft: spacing.sm }
                    ]}
                    onPress={() => setSignatureType('technician')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.signatureTypeText,
                      signatureType === 'technician' && styles.signatureTypeTextActive
                    ]}>Technician</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.signatureCanvasContainer}>
                <Text style={styles.signatureCanvasLabel}>Draw Signature</Text>
                <View 
                  style={styles.signatureCanvas}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setSignatureCanvasLayout({ width, height });
                  }}
                  onTouchStart={(e) => handleSignatureTouch(e, true)}
                  onTouchMove={(e) => handleSignatureTouch(e, false)}
                  onTouchEnd={handleSignatureTouchEnd}
                >
                  {signaturePoints.length === 0 && currentStroke.length === 0 && (
                    <View style={styles.signatureCanvasPlaceholder}>
                      <Text style={styles.signatureCanvasPlaceholderText}>Sign here</Text>
                    </View>
                  )}
                  <Svg 
                    width="100%" 
                    height="100%" 
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  >
                    <Path
                      d={generateSignatureSvgPath()}
                      stroke={colors.foreground}
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </View>
              
              <View style={styles.signatureButtonsRow}>
                <TouchableOpacity
                  style={styles.clearSignatureButton}
                  onPress={clearSignature}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSignatureButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveSignatureButton,
                    (signaturePoints.length === 0 || !signatureSignerName.trim()) && styles.saveSignatureButtonDisabled
                  ]}
                  onPress={handleSaveSignature}
                  disabled={isSavingSignature || signaturePoints.length === 0 || !signatureSignerName.trim()}
                  activeOpacity={0.7}
                >
                  {isSavingSignature ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveSignatureButtonText}>Save Signature</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal visible={showNotesModal} animationType="slide" transparent>
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
                        source={{ uri: photo.url || photo.thumbnailUrl }} 
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

      {/* Forms Selection Modal */}
      <Modal visible={showFormsModal && !selectedFormTemplate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Forms</Text>
              <TouchableOpacity onPress={() => setShowFormsModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {formTemplates.length === 0 ? (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Feather name="clipboard" size={48} color={colors.mutedForeground} />
                  <Text style={{ ...typography.subtitle, color: colors.foreground, marginTop: spacing.md }}>
                    No form templates
                  </Text>
                  <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.sm }}>
                    Add templates in Settings {'->'} Job Forms to collect safety checklists, site inductions, and more.
                  </Text>
                  <TouchableOpacity
                    style={{ marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.lg }}
                    onPress={() => {
                      setShowFormsModal(false);
                      router.push('/more/job-forms');
                    }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Add Templates</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.md }}>
                    Select a form to fill out for this job
                  </Text>
                  {formTemplates.map((template) => {
                    const alreadyCompleted = formResponses.some(r => r.templateId === template.id);
                    return (
                      <TouchableOpacity
                        key={template.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: alreadyCompleted ? colors.success : colors.border,
                          padding: spacing.md,
                          marginBottom: spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          if (!alreadyCompleted) {
                            setSelectedFormTemplate(template);
                          } else {
                            Alert.alert(
                              'Form Already Completed',
                              'This form has already been filled out for this job. Would you like to fill it out again?',
                              [
                                { text: 'Cancel', onPress: () => {} },
                                { text: 'Fill Again', onPress: () => setSelectedFormTemplate(template) },
                              ]
                            );
                          }
                        }}
                        activeOpacity={0.7}
                        data-testid={`select-form-${template.id}`}
                      >
                        <View style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: radius.lg, 
                          backgroundColor: alreadyCompleted ? `${colors.success}20` : colors.primaryLight,
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: spacing.md,
                        }}>
                          <Feather 
                            name={alreadyCompleted ? 'check-circle' : 'clipboard'} 
                            size={20} 
                            color={alreadyCompleted ? colors.success : colors.primary} 
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...typography.subtitle, color: colors.foreground }}>{template.name}</Text>
                          {template.description && (
                            <Text style={{ ...typography.caption, color: colors.mutedForeground }} numberOfLines={1}>
                              {template.description}
                            </Text>
                          )}
                          <Text style={{ ...typography.caption, color: alreadyCompleted ? colors.success : colors.primary, marginTop: 2 }}>
                            {alreadyCompleted ? 'Completed' : `${Array.isArray(template.fields) ? template.fields.length : 0} fields`}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Form Fillout Modal */}
      {selectedFormTemplate && (
        <Modal visible={!!selectedFormTemplate} animationType="slide">
          <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing['3xl'] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setSelectedFormTemplate(null)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={{ ...typography.subtitle, color: colors.foreground, flex: 1, textAlign: 'center' }} numberOfLines={1}>
                {selectedFormTemplate.name}
              </Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={{ flex: 1, padding: spacing.lg }}>
              {Array.isArray(selectedFormTemplate.fields) && selectedFormTemplate.fields.map((field) => (
                <View key={field.id} style={{ marginBottom: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Text style={{ ...typography.label, color: colors.foreground, flex: 1 }}>{field.label}</Text>
                    {field.required && <Text style={{ color: colors.destructive }}>*</Text>}
                  </View>
                  <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                    <Text style={{ ...typography.body, color: colors.mutedForeground }}>
                      {field.type === 'checkbox' ? 'Tap to check' : 
                       field.type === 'signature' ? 'Tap to sign' : 
                       field.type === 'photo' ? 'Tap to take photo' : 
                       field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}
                  onPress={async () => {
                    const mockResponses: Record<string, any> = {};
                    if (Array.isArray(selectedFormTemplate.fields)) {
                      selectedFormTemplate.fields.forEach(field => {
                        if (field.type === 'checkbox') mockResponses[field.id] = true;
                        else if (field.type === 'date') mockResponses[field.id] = new Date().toISOString().split('T')[0];
                        else if (field.type === 'time') {
                          const now = new Date();
                          mockResponses[field.id] = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                        }
                        else if (field.type === 'select' && field.options?.length) mockResponses[field.id] = field.options[0];
                        else mockResponses[field.id] = 'Completed';
                      });
                    }
                    await handleFormSubmit(selectedFormTemplate.id, mockResponses, []);
                  }}
                  disabled={isSubmittingForm}
                >
                  <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 16 }}>
                    {isSubmittingForm ? 'Submitting...' : 'Submit Form'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: colors.muted, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}
                  onPress={() => setSelectedFormTemplate(null)}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Job Diary Modal */}
      <Modal visible={showDiaryModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowDiaryModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={{ ...typography.subtitle, color: colors.foreground }}>Job Diary</Text>
              <TouchableOpacity onPress={() => setShowAddDiaryEntry(true)}>
                <Feather name="plus" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {showAddDiaryEntry ? (
              <View style={{ padding: spacing.lg }}>
                <Text style={{ ...typography.subtitle, color: colors.foreground, marginBottom: spacing.md }}>Add Entry</Text>
                
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ ...typography.label, color: colors.foreground, marginBottom: spacing.xs }}>Type</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {['note', 'call', 'issue', 'material_added'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={{ 
                          paddingHorizontal: spacing.md, 
                          paddingVertical: spacing.sm, 
                          borderRadius: radius.md, 
                          backgroundColor: newDiaryEntry.activityType === type ? colors.primary : colors.muted 
                        }}
                        onPress={() => setNewDiaryEntry({ ...newDiaryEntry, activityType: type })}
                      >
                        <Text style={{ color: newDiaryEntry.activityType === type ? colors.primaryForeground : colors.foreground, fontSize: 13 }}>
                          {type === 'note' ? 'Note' : type === 'call' ? 'Call' : type === 'issue' ? 'Issue' : 'Material'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ ...typography.label, color: colors.foreground, marginBottom: spacing.xs }}>Title *</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.foreground, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Brief summary..."
                    placeholderTextColor={colors.mutedForeground}
                    value={newDiaryEntry.title}
                    onChangeText={(text) => setNewDiaryEntry({ ...newDiaryEntry, title: text })}
                  />
                </View>
                
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ ...typography.label, color: colors.foreground, marginBottom: spacing.xs }}>Details (optional)</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.foreground, borderWidth: 1, borderColor: colors.border, height: 80, textAlignVertical: 'top' }}
                    placeholder="Add more details..."
                    placeholderTextColor={colors.mutedForeground}
                    value={newDiaryEntry.description}
                    onChangeText={(text) => setNewDiaryEntry({ ...newDiaryEntry, description: text })}
                    multiline
                  />
                </View>
                
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: colors.muted, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' }}
                    onPress={() => {
                      setShowAddDiaryEntry(false);
                      setNewDiaryEntry({ activityType: 'note', title: '', description: '' });
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' }}
                    onPress={handleAddDiaryEntry}
                    disabled={isSubmittingDiaryEntry}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>
                      {isSubmittingDiaryEntry ? 'Adding...' : 'Add Entry'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <FlatList
                data={activities}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ padding: spacing.md }}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'] }}>
                    <Feather name="book-open" size={48} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
                    <Text style={{ ...typography.body, color: colors.mutedForeground, marginTop: spacing.md }}>No diary entries yet</Text>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>Tap + to add notes, calls, or issues</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getActivityColor(item.activityType), alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name={getActivityIcon(item.activityType) as any} size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '500' }}>{item.title}</Text>
                      {item.description && (
                        <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>{item.description}</Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
                        <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                          {formatActivityDate(item.createdAt)}
                        </Text>
                        {item.userName && (
                          <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                            by {item.userName}
                          </Text>
                        )}
                        {item.isSystemGenerated && (
                          <View style={{ backgroundColor: colors.muted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Auto</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Full Photo Preview Modal */}
      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <View style={styles.photoPreviewModal}>
          {selectedPhoto && (
            <>
              <Image 
                source={{ uri: selectedPhoto.url }} 
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
