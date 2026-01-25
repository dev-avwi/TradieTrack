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
  Linking,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'trial';
  status: 'active' | 'past_due' | 'canceled' | 'none';
  seatCount?: number;
}

const BETA_MODE = false;
const TEAM_BASE_PRICE = 59;
const TEAM_SEAT_PRICE = 29;

const TEAM_BENEFITS = [
  { icon: 'users', title: 'Add Team Members', description: 'Invite staff, apprentices, and managers' },
  { icon: 'shield', title: 'Role-Based Access', description: 'Control what each team member can see and do' },
  { icon: 'map-pin', title: 'Live GPS Tracking', description: 'See where your team is in real-time' },
  { icon: 'clipboard', title: 'Job Assignment', description: 'Assign and track jobs for each team member' },
  { icon: 'message-circle', title: 'Team Chat', description: 'Built-in communication with your crew' },
  { icon: 'clock', title: 'Time Tracking', description: 'Track hours and generate timesheets' },
];

interface TeamMember {
  id: string;
  userId: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  hourlyRate?: string;
  role: 'owner' | 'admin' | 'supervisor' | 'staff';
  permissions: string[];
  inviteStatus: 'pending' | 'accepted' | 'rejected';
  useCustomPermissions?: boolean;
  customPermissions?: string[];
  locationEnabledByOwner?: boolean;
  allowLocationSharing?: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  createdAt: string;
}

interface PermissionItem {
  key: string;
  label: string;
  category: string;
}

interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  address?: string;
  scheduledAt?: string;
  completedAt?: string;
  assignedTo?: string;
}

interface TimeEntry {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  jobId?: string;
  notes?: string;
}

const ROLE_PERMISSION_SUMMARY = {
  owner: [
    'Full access to all features',
    'Manage team members & roles',
    'Manage payments & billing',
    'View all reports',
  ],
  admin: [
    'Manage jobs, quotes & invoices',
    'Manage clients & team',
    'View reports & templates',
    'Access time tracking',
  ],
  supervisor: [
    'Manage jobs & time entries',
    'View quotes & invoices',
    'View clients & reports',
    'Limited write access',
  ],
  staff: [
    'View assigned jobs',
    'Add photos, notes & voice memos',
    'Manage own time entries',
    'View client info',
  ],
};

// Category metadata with icons and descriptions
const PERMISSION_CATEGORY_META: Record<string, { icon: string; description: string; isSensitive?: boolean }> = {
  'Jobs': {
    icon: 'briefcase',
    description: 'Create, view and manage jobs',
  },
  'Clients': {
    icon: 'users',
    description: 'Access customer information',
  },
  'Quotes': {
    icon: 'file-text',
    description: 'Create and send price quotes',
    isSensitive: true,
  },
  'Invoices': {
    icon: 'credit-card',
    description: 'Bill customers and track payments',
    isSensitive: true,
  },
  'Team': {
    icon: 'user-plus',
    description: 'Manage team members and roles',
    isSensitive: true,
  },
  'Settings': {
    icon: 'settings',
    description: 'Business settings and preferences',
  },
  'Payments': {
    icon: 'dollar-sign',
    description: 'Payment processing and records',
    isSensitive: true,
  },
  'Reports': {
    icon: 'bar-chart-2',
    description: 'Business reports and analytics',
    isSensitive: true,
  },
  'Templates': {
    icon: 'copy',
    description: 'Quote and invoice templates',
  },
  'Time Tracking': {
    icon: 'clock',
    description: 'Track work hours and timesheets',
  },
  'Expenses': {
    icon: 'shopping-bag',
    description: 'Track business expenses',
  },
  'Catalog': {
    icon: 'package',
    description: 'Manage service and product catalog',
  },
  'Job Media': {
    icon: 'camera',
    description: 'Photos, notes and files on jobs',
  },
  'Other': {
    icon: 'more-horizontal',
    description: 'Additional permissions',
  },
};

// Quick permission presets for common use cases
const PERMISSION_PRESETS = [
  {
    id: 'field_worker',
    name: 'Field Worker',
    icon: 'tool',
    description: 'On-site jobs, photos, notes & time',
    permissions: [
      'read_jobs', 'read_clients',
      'read_time_entries', 'write_time_entries',
      'write_job_notes', 'write_job_media',
    ],
  },
  {
    id: 'office_admin',
    name: 'Office Admin',
    icon: 'monitor',
    description: 'Full job, quote & invoice access',
    permissions: [
      'read_jobs', 'write_jobs',
      'read_quotes', 'write_quotes',
      'read_invoices', 'write_invoices',
      'read_clients', 'write_clients',
      'read_reports', 'manage_templates',
    ],
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    icon: 'user-check',
    description: 'Manage jobs & view financials',
    permissions: [
      'read_jobs', 'write_jobs',
      'read_quotes', 'read_invoices',
      'read_clients', 'write_clients',
      'read_time_entries', 'write_time_entries',
      'view_all',
    ],
  },
];

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
  inviteButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  rolesInfoCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolesInfoTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  roleInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  roleInfoBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  roleInfoContent: {
    flex: 1,
  },
  roleInfoLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleInfoDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    lineHeight: 16,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.subtitle,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  memberEmail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  memberDetails: {
    marginBottom: spacing.md,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  roleBadgeText: {
    ...typography.captionSmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  roleDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    minHeight: 36,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  viewButton: {
    backgroundColor: colors.primary + '10',
  },
  removeButton: {
    borderColor: colors.destructive,
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
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  emptyStateButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
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
    flex: 1,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  inputLabelFirst: {
    marginTop: 0,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  roleOptions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  roleOption: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOptionSelected: {
    borderWidth: 2,
    backgroundColor: colors.primary + '10',
  },
  roleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  roleOptionLabel: {
    ...typography.subtitle,
    color: colors.foreground,
    flex: 1,
  },
  roleOptionCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  rolePermissionsList: {
    marginTop: spacing.xs,
  },
  rolePermissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  rolePermissionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.destructive,
  },
  permissionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  permissionsButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '20',
  },
  customBadgeText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  permissionsModalBody: {
    padding: spacing.lg,
    maxHeight: '60%',
  },
  customToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customToggleLabel: {
    flex: 1,
  },
  customToggleLabelTitle: {
    ...typography.label,
    color: colors.foreground,
  },
  customToggleLabelSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  permissionCategory: {
    marginBottom: spacing.md,
  },
  permissionCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  permissionCategoryTitle: {
    ...typography.label,
    color: colors.foreground,
    fontWeight: '600',
  },
  selectAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectAllText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '500',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  permissionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  permissionLabel: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  roleDefaultHint: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  rolePermissionsDisplay: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePermissionsTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  permissionBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  permissionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
  },
  permissionBadgeText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  applyDefaultsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  applyDefaultsText: {
    ...typography.caption,
    color: colors.foreground,
  },
  permissionCount: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginLeft: 'auto',
  },
  presetsSection: {
    marginBottom: spacing.lg,
  },
  presetsSectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetButtonSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  presetIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  presetIconSelected: {
    backgroundColor: colors.primary,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  presetDesc: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
  },
  categoryIconSensitive: {
    backgroundColor: colors.destructive + '15',
  },
  categoryTitleContainer: {
    flex: 1,
  },
  categoryDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sensitiveWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.destructive + '10',
    borderRadius: radius.sm,
  },
  sensitiveWarningText: {
    ...typography.captionSmall,
    color: colors.destructive,
    fontWeight: '500',
  },
  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  detailValue: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jobItemLast: {
    borderBottomWidth: 0,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  jobAddress: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  jobStatusText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  timeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timeStat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeStatValue: {
    ...typography.subtitle,
    color: colors.foreground,
    fontWeight: '700',
  },
  timeStatLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyDetail: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  memberDetailHeader: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  memberDetailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  memberDetailAvatarText: {
    ...typography.pageTitle,
    fontWeight: '700',
  },
  memberDetailName: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: 4,
  },
  memberDetailRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  memberDetailRoleText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  upgradeContainer: {
    paddingBottom: spacing['3xl'],
  },
  upgradeHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  upgradeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  upgradeTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  upgradeSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  upgradeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  upgradeCardTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  upgradeCardSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
  },
  pricePeriod: {
    ...typography.body,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  priceNote: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  seatSelectorLabel: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  seatButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  seatCount: {
    ...typography.subtitle,
    color: colors.foreground,
    minWidth: 40,
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  ctaButtonDisabled: {
    backgroundColor: colors.muted,
  },
  ctaButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 16,
  },
  ctaSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  benefitsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  benefitDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  betaBanner: {
    backgroundColor: colors.successLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  betaBannerText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
    flex: 1,
  },
});

export default function TeamManagementScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isOwner } = useAuthStore();
  
  // Get subscription tier from auth store (single source of truth)
  const userSubscriptionTier = user?.subscriptionTier || 'free';
  
  const ROLE_CONFIG = useMemo(() => ({
    owner: { 
      label: 'Owner', 
      color: colors.primary, 
      icon: 'shield',
      description: 'Full access to everything' 
    },
    admin: { 
      label: 'Admin', 
      color: colors.success, 
      icon: 'user-check',
      description: 'Manage team and all operations' 
    },
    administrator: { 
      label: 'Administrator', 
      color: colors.success, 
      icon: 'user-check',
      description: 'Full access to all features' 
    },
    manager: { 
      label: 'Manager', 
      color: colors.success, 
      icon: 'users',
      description: 'Manages jobs, team, quotes and invoices' 
    },
    office_manager: { 
      label: 'Office Manager', 
      color: colors.success, 
      icon: 'briefcase',
      description: 'Manages scheduling and invoicing' 
    },
    supervisor: { 
      label: 'Supervisor', 
      color: colors.warning, 
      icon: 'users',
      description: 'Manage assigned workers' 
    },
    worker: { 
      label: 'Worker', 
      color: colors.info, 
      icon: 'user',
      description: 'Field worker - works on assigned jobs' 
    },
    technician: { 
      label: 'Technician', 
      color: colors.info, 
      icon: 'tool',
      description: 'Field technician who performs job work' 
    },
    apprentice: { 
      label: 'Apprentice', 
      color: colors.info, 
      icon: 'user',
      description: 'Junior technician with limited permissions' 
    },
    team_member: { 
      label: 'Team Member', 
      color: colors.info, 
      icon: 'user',
      description: 'Basic team member access' 
    },
    staff: { 
      label: 'Staff', 
      color: colors.info, 
      icon: 'user',
      description: 'Access own jobs and time tracking' 
    },
  }), [colors]);

  const STATUS_CONFIG = useMemo(() => ({
    pending: { label: 'Pending', color: colors.warning },
    accepted: { label: 'Active', color: colors.success },
    rejected: { label: 'Rejected', color: colors.destructive },
  }), [colors]);

  const JOB_STATUS_CONFIG = useMemo(() => ({
    todo: { label: 'To Do', color: colors.muted, textColor: colors.foreground },
    in_progress: { label: 'In Progress', color: colors.info, textColor: '#FFFFFF' },
    done: { label: 'Done', color: colors.success, textColor: '#FFFFFF' },
    cancelled: { label: 'Cancelled', color: colors.destructive, textColor: '#FFFFFF' },
  }), [colors]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [seatCount, setSeatCount] = useState(1);
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteHourlyRate, setInviteHourlyRate] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Member detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberJobs, setMemberJobs] = useState<Job[]>([]);
  const [memberTimeStats, setMemberTimeStats] = useState({ today: 0, week: 0, month: 0 });
  const [memberStatus, setMemberStatus] = useState<'active' | 'offline' | 'on_job'>('offline');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // Edit member modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Permissions modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  
  // Assign job modal state
  const [showAssignJobModal, setShowAssignJobModal] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isAssigningJob, setIsAssigningJob] = useState(false);
  const [isResendingInvite, setIsResendingInvite] = useState<string | null>(null);
  const [isTogglingLocation, setIsTogglingLocation] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    setIsLoading(true);
    try {
      const [membersRes, rolesRes, permissionsRes, myRoleRes, statusRes] = await Promise.all([
        api.get<TeamMember[]>('/api/team/members'),
        api.get<UserRole[]>('/api/team/roles'),
        api.get<PermissionItem[]>('/api/team/permissions'),
        api.get<{ isOwner: boolean; role?: string }>('/api/team/my-role'),
        api.get<SubscriptionStatus>('/api/billing/status'),
      ]);
      
      if (membersRes.data) {
        setTeamMembers(membersRes.data);
      }
      if (rolesRes.data) {
        setRoles(rolesRes.data);
      }
      if (permissionsRes.data) {
        setAvailablePermissions(permissionsRes.data);
      }
      if (myRoleRes.data) {
        setCurrentUserRole(myRoleRes.data.isOwner ? 'owner' : (myRoleRes.data.role || ''));
      }
      if (statusRes.data) {
        setSubscriptionStatus(statusRes.data);
      }
    } catch (error) {
      console.log('Error fetching team:', error);
    }
    setIsLoading(false);
  }, []);
  
  const handleUpgradeToTeam = async () => {
    setIsUpgrading(true);
    try {
      const response = await api.post<{ success: boolean; sessionUrl?: string; error?: string }>('/api/billing/checkout/team', {
        seatCount: seatCount,
        successUrl: 'tradietrack://team-management?success=true',
        cancelUrl: 'tradietrack://team-management?canceled=true',
      });

      if (response.data?.success && response.data?.sessionUrl) {
        const canOpen = await Linking.canOpenURL(response.data.sessionUrl);
        if (canOpen) {
          await Linking.openURL(response.data.sessionUrl);
        } else {
          Alert.alert('Error', 'Unable to open payment page. Please try again.');
        }
      } else {
        Alert.alert('Error', response.data?.error || response.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', 'Failed to start upgrade process. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };
  
  // Use auth store tier as source of truth, fall back to API response
  const currentTier = userSubscriptionTier || subscriptionStatus?.tier || 'free';
  // Show team interface if user has team plan OR if they already have team members
  // This ensures users with existing teams (like demo accounts) can manage them
  const hasTeamPlan = currentTier === 'team' || BETA_MODE || teamMembers.length > 0;
  const teamPrice = TEAM_BASE_PRICE + (seatCount * TEAM_SEAT_PRICE);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      fetchTeam();
    }, [fetchTeam])
  );
  
  const getRolePermissions = useCallback((roleId: string): string[] => {
    const role = roles.find(r => r.id === roleId);
    return (role?.permissions as string[]) || [];
  }, [roles]);
  
  const groupedPermissions = useMemo(() => {
    return availablePermissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, PermissionItem[]>);
  }, [availablePermissions]);

  const currentUserIsOwner = currentUserRole === 'owner';

  const fetchMemberDetails = useCallback(async (member: TeamMember) => {
    setIsLoadingDetail(true);
    try {
      const [jobsRes, timeRes] = await Promise.all([
        api.get<Job[]>(`/api/jobs?assignedTo=${member.userId}`).catch(() => ({ data: [] })),
        api.get<TimeEntry[]>(`/api/time-entries?userId=${member.userId}`).catch(() => ({ data: [] })),
      ]);
      
      const jobs = jobsRes.data || [];
      setMemberJobs(jobs.slice(0, 5));
      
      const timeEntries = timeRes.data || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let todayHours = 0, weekHours = 0, monthHours = 0;
      timeEntries.forEach((entry: TimeEntry) => {
        const entryDate = new Date(entry.startTime);
        const duration = entry.duration || 0;
        const hours = duration / 60;
        
        if (entryDate >= todayStart) todayHours += hours;
        if (entryDate >= weekStart) weekHours += hours;
        if (entryDate >= monthStart) monthHours += hours;
      });
      
      setMemberTimeStats({
        today: Math.round(todayHours * 10) / 10,
        week: Math.round(weekHours * 10) / 10,
        month: Math.round(monthHours * 10) / 10,
      });
      
      const activeJobs = jobs.filter((j: Job) => j.status === 'in_progress');
      if (activeJobs.length > 0) {
        setMemberStatus('on_job');
      } else if (member.inviteStatus === 'accepted') {
        setMemberStatus('active');
      } else {
        setMemberStatus('offline');
      }
      
    } catch (error) {
      console.log('Error fetching member details:', error);
    }
    setIsLoadingDetail(false);
  }, []);

  const openDetailModal = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setShowDetailModal(true);
    fetchMemberDetails(member);
  }, [fetchMemberDetails]);

  const openEditModal = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setEditFirstName(member.firstName || member.user?.firstName || '');
    setEditLastName(member.lastName || member.user?.lastName || '');
    setEditPhone(member.phone || member.user?.phone || '');
    setEditHourlyRate(member.hourlyRate || '');
    setShowEditModal(true);
  }, []);

  const openPermissionsModal = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setUseCustomPermissions(member.useCustomPermissions || false);
    setSelectedPermissions((member.customPermissions as string[]) || []);
    setShowPermissionsModal(true);
  }, []);
  
  const togglePermission = useCallback((permKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permKey) 
        ? prev.filter(p => p !== permKey)
        : [...prev, permKey]
    );
  }, []);
  
  const toggleCategory = useCallback((category: string) => {
    const categoryPerms = groupedPermissions[category]?.map(p => p.key) || [];
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  }, [groupedPermissions, selectedPermissions]);
  
  const applyRoleDefaults = useCallback(() => {
    if (selectedMember) {
      const rolePerms = getRolePermissions(selectedMember.roleId);
      setSelectedPermissions([...rolePerms]);
    }
  }, [selectedMember, getRolePermissions]);
  
  const savePermissions = useCallback(async () => {
    if (!selectedMember) return;
    
    setIsSavingPermissions(true);
    try {
      await api.patch(`/api/team/members/${selectedMember.id}/permissions`, {
        permissions: selectedPermissions,
        useCustomPermissions: useCustomPermissions,
      });
      
      setTeamMembers(prev => 
        prev.map(m => m.id === selectedMember.id 
          ? { ...m, useCustomPermissions, customPermissions: selectedPermissions }
          : m
        )
      );
      
      Alert.alert('Success', 'Permissions updated successfully');
      setShowPermissionsModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update permissions');
    }
    setIsSavingPermissions(false);
  }, [selectedMember, selectedPermissions, useCustomPermissions]);

  const handleInvite = async () => {
    if (!inviteEmail) {
      Alert.alert('Required', 'Please enter an email address');
      return;
    }
    if (!inviteFirstName || !inviteLastName) {
      Alert.alert('Required', 'Please enter first and last name');
      return;
    }
    
    setIsSending(true);
    try {
      const roleNameMapping: Record<string, string[]> = {
        'admin': ['administrator', 'admin'],
        'supervisor': ['manager', 'supervisor', 'office manager'],
        'staff': ['worker', 'staff', 'technician', 'apprentice', 'team member'],
      };
      
      const possibleNames = roleNameMapping[inviteRole.toLowerCase()] || [inviteRole.toLowerCase()];
      const roleObj = roles.find(r => possibleNames.includes(r.name.toLowerCase()));
      
      if (!roleObj) {
        Alert.alert('Error', `No matching role found for ${inviteRole}. Please try again.`);
        setIsSending(false);
        return;
      }
      
      await api.post('/api/team/members/invite', {
        email: inviteEmail,
        firstName: inviteFirstName,
        lastName: inviteLastName,
        roleId: roleObj.id,
        hourlyRate: inviteHourlyRate ? parseFloat(inviteHourlyRate) : undefined,
      });
      Alert.alert('Invite Sent', `Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      setInviteRole('staff');
      setInviteHourlyRate('');
      fetchTeam();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    }
    setIsSending(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    
    setIsSavingEdit(true);
    try {
      await api.patch(`/api/team/members/${selectedMember.id}`, {
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        hourlyRate: editHourlyRate ? parseFloat(editHourlyRate) : undefined,
      });
      
      setTeamMembers(prev => 
        prev.map(m => m.id === selectedMember.id 
          ? { 
              ...m, 
              firstName: editFirstName, 
              lastName: editLastName,
              phone: editPhone,
              hourlyRate: editHourlyRate,
            }
          : m
        )
      );
      
      Alert.alert('Success', 'Member details updated');
      setShowEditModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update member');
    }
    setIsSavingEdit(false);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const roleObj = roles.find(r => r.name.toLowerCase() === newRole.toLowerCase());
      await api.patch(`/api/team/members/${memberId}`, { 
        role: newRole,
        roleId: roleObj?.id,
      });
      setTeamMembers(prev => 
        prev.map(m => m.id === memberId ? { ...m, role: newRole as any, roleId: roleObj?.id || m.roleId } : m)
      );
      Alert.alert('Updated', 'Role changed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update role');
    }
  };

  const handleRemove = async (member: TeamMember) => {
    const userName = member.firstName && member.lastName
      ? `${member.firstName} ${member.lastName}`
      : member.user 
        ? `${member.user.firstName} ${member.user.lastName}`
        : 'this member';
      
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${userName} from the team? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/team/members/${member.id}`);
              setTeamMembers(prev => prev.filter(m => m.id !== member.id));
              Alert.alert('Removed', 'Team member has been removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  // Toggle location sharing for a team member
  const handleToggleLocation = async (member: TeamMember, enabled: boolean) => {
    setIsTogglingLocation(member.id);
    try {
      await api.patch(`/api/team/members/${member.id}/location`, {
        locationEnabledByOwner: enabled,
      });
      setTeamMembers(prev =>
        prev.map(m => m.id === member.id ? { ...m, locationEnabledByOwner: enabled } : m)
      );
      Alert.alert(
        enabled ? 'Location Enabled' : 'Location Disabled',
        `Location tracking has been ${enabled ? 'enabled' : 'disabled'} for this team member.`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update location settings');
    }
    setIsTogglingLocation(null);
  };

  // Resend invite to pending member
  const handleResendInvite = async (member: TeamMember) => {
    setIsResendingInvite(member.id);
    try {
      await api.post(`/api/team/members/${member.id}/resend-invite`);
      Alert.alert('Invite Sent', `Invitation has been resent to ${member.email}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend invite');
    }
    setIsResendingInvite(null);
  };

  // Open assign job modal
  const openAssignJobModal = async (member: TeamMember) => {
    setSelectedMember(member);
    setShowAssignJobModal(true);
    setIsLoadingJobs(true);
    setSelectedJobId('');
    
    try {
      const response = await api.get<Job[]>('/api/jobs');
      // Handle both array response and wrapped response
      const jobsArray = Array.isArray(response.data) 
        ? response.data 
        : (response.data as any)?.jobs || [];
      
      // Filter to active jobs that can be assigned
      const jobs = jobsArray.filter(
        (j: Job) => j.status !== 'done' && j.status !== 'cancelled'
      ).slice(0, 50); // Limit to 50 jobs
      setAvailableJobs(jobs);
    } catch (error) {
      console.log('Error fetching jobs:', error);
      setAvailableJobs([]);
    }
    setIsLoadingJobs(false);
  };

  // Assign job to member
  const handleAssignJob = async () => {
    if (!selectedMember || !selectedJobId) {
      Alert.alert('Required', 'Please select a job to assign');
      return;
    }
    
    setIsAssigningJob(true);
    try {
      await api.post(`/api/jobs/${selectedJobId}/assign`, {
        assignedTo: selectedMember.userId,
      });
      Alert.alert(
        'Job Assigned',
        `Job has been assigned to ${getMemberName(selectedMember)}`
      );
      setShowAssignJobModal(false);
      setSelectedJobId('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign job');
    }
    setIsAssigningJob(false);
  };

  const getRoleCategory = (role: string | undefined): 'owner' | 'admin' | 'staff' => {
    if (!role) return 'staff';
    const r = role.toLowerCase();
    if (r === 'owner') return 'owner';
    if (r === 'admin' || r === 'administrator' || r === 'manager' || r === 'office_manager') return 'admin';
    return 'staff';
  };
  
  const ownerCount = teamMembers.filter(m => getRoleCategory(m.role) === 'owner').length;
  const adminCount = teamMembers.filter(m => getRoleCategory(m.role) === 'admin').length;
  const staffCount = teamMembers.filter(m => getRoleCategory(m.role) === 'staff').length;

  const renderMemberCard = (member: TeamMember) => {
    const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.staff;
    const statusConfig = STATUS_CONFIG[member.inviteStatus] || STATUS_CONFIG.pending;
    const userName = member.firstName && member.lastName 
      ? `${member.firstName} ${member.lastName}`
      : member.user 
        ? `${member.user.firstName} ${member.user.lastName}`
        : 'Unnamed User';
    const memberEmail = member.email || member.user?.email || 'No email';

    const getInitials = () => {
      if (member.firstName && member.lastName) {
        return (member.firstName[0] + member.lastName[0]).toUpperCase();
      }
      if (!member.user) return '??';
      const first = member.user.firstName?.[0] || '';
      const last = member.user.lastName?.[0] || '';
      return (first + last).toUpperCase();
    };

    return (
      <TouchableOpacity 
        key={member.id} 
        testID={`card-member-${member.id}`}
        style={styles.memberCard}
        onPress={() => openDetailModal(member)}
        activeOpacity={0.7}
      >
        <View style={styles.memberHeader}>
          <View style={[styles.avatar, { backgroundColor: roleConfig.color + '20' }]}>
            <Text style={[styles.avatarText, { color: roleConfig.color }]}>{getInitials()}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{userName}</Text>
            <Text style={styles.memberEmail}>{memberEmail}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.memberDetails}>
          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleConfig.color }]}>
              <Feather name={roleConfig.icon as any} size={12} color="#FFFFFF" />
              <Text style={styles.roleBadgeText}>{roleConfig.label}</Text>
            </View>
            {member.useCustomPermissions && (
              <View style={styles.customBadge}>
                <Feather name="key" size={10} color={colors.primary} />
                <Text style={styles.customBadgeText}>Custom</Text>
              </View>
            )}
            <Text style={styles.roleDescription} numberOfLines={1}>{roleConfig.description}</Text>
          </View>
        </View>

        {/* Location toggle for accepted members */}
        {member.role !== 'owner' && member.inviteStatus === 'accepted' && currentUserIsOwner && (
          <View style={[styles.memberActions, { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Feather 
                name="map-pin" 
                size={14} 
                color={member.locationEnabledByOwner !== false ? colors.success : colors.mutedForeground} 
              />
              <Text style={[styles.actionButtonText, { marginLeft: spacing.xs, color: colors.foreground }]}>
                Location Access
              </Text>
            </View>
            <TouchableOpacity
              testID={`toggle-location-${member.id}`}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: member.locationEnabledByOwner !== false ? colors.success : colors.muted,
                padding: 2,
                opacity: isTogglingLocation === member.id ? 0.5 : 1,
              }}
              onPress={() => handleToggleLocation(member, member.locationEnabledByOwner === false)}
              disabled={isTogglingLocation === member.id}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                transform: [{ translateX: member.locationEnabledByOwner !== false ? 20 : 0 }],
              }} />
            </TouchableOpacity>
          </View>
        )}

        {member.role !== 'owner' && currentUserIsOwner && (
          <View style={styles.memberActions}>
            <TouchableOpacity 
              testID={`button-view-${member.id}`}
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => openDetailModal(member)}
            >
              <Feather name="eye" size={14} color={colors.primary} />
              <Text style={styles.actionButtonText}>View</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              testID={`button-edit-${member.id}`}
              style={styles.actionButton}
              onPress={() => openEditModal(member)}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            
            {member.inviteStatus === 'accepted' && (
              <>
                <TouchableOpacity 
                  testID={`button-role-${member.id}`}
                  style={styles.actionButton}
                  onPress={() => {
                    Alert.alert(
                      'Change Role',
                      `Select new role for ${member.firstName || member.user?.firstName || 'this member'}`,
                      [
                        { text: 'Admin', onPress: () => handleRoleChange(member.id, 'admin') },
                        { text: 'Supervisor', onPress: () => handleRoleChange(member.id, 'supervisor') },
                        { text: 'Staff', onPress: () => handleRoleChange(member.id, 'staff') },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                >
                  <Feather name="shield" size={14} color={colors.primary} />
                  <Text style={styles.actionButtonText}>Role</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  testID={`button-permissions-${member.id}`}
                  style={styles.permissionsButton}
                  onPress={() => openPermissionsModal(member)}
                >
                  <Feather name="key" size={14} color={colors.primary} />
                  <Text style={styles.permissionsButtonText}>Permissions</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  testID={`button-assign-${member.id}`}
                  style={styles.actionButton}
                  onPress={() => openAssignJobModal(member)}
                >
                  <Feather name="briefcase" size={14} color={colors.primary} />
                  <Text style={styles.actionButtonText}>Assign</Text>
                </TouchableOpacity>
              </>
            )}
            
            {member.inviteStatus === 'pending' && (
              <TouchableOpacity 
                testID={`button-resend-${member.id}`}
                style={[styles.actionButton, { borderColor: colors.warning }]}
                onPress={() => handleResendInvite(member)}
                disabled={isResendingInvite === member.id}
              >
                {isResendingInvite === member.id ? (
                  <ActivityIndicator size="small" color={colors.warning} />
                ) : (
                  <>
                    <Feather name="send" size={14} color={colors.warning} />
                    <Text style={[styles.actionButtonText, { color: colors.warning }]}>Resend</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              testID={`button-remove-${member.id}`}
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => handleRemove(member)}
            >
              <Feather name="user-minus" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderRoleOption = (roleKey: string) => {
    const config = ROLE_CONFIG[roleKey as keyof typeof ROLE_CONFIG];
    const permissions = ROLE_PERMISSION_SUMMARY[roleKey as keyof typeof ROLE_PERMISSION_SUMMARY] || [];
    const isSelected = inviteRole === roleKey;
    
    return (
      <TouchableOpacity
        key={roleKey}
        testID={`option-role-${roleKey}`}
        style={[
          styles.roleOption,
          isSelected && styles.roleOptionSelected,
          isSelected && { borderColor: config.color }
        ]}
        onPress={() => setInviteRole(roleKey)}
      >
        <View style={styles.roleOptionHeader}>
          <View style={[styles.roleOptionIcon, { backgroundColor: config.color + '20' }]}>
            <Feather name={config.icon as any} size={16} color={config.color} />
          </View>
          <Text style={styles.roleOptionLabel}>{config.label}</Text>
          <View style={[
            styles.roleOptionCheck, 
            { 
              borderColor: isSelected ? config.color : colors.border,
              backgroundColor: isSelected ? config.color : 'transparent',
            }
          ]}>
            {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
          </View>
        </View>
        <Text style={styles.roleOptionDesc}>{config.description}</Text>
        <View style={styles.rolePermissionsList}>
          {permissions.slice(0, 3).map((perm, idx) => (
            <View key={idx} style={styles.rolePermissionItem}>
              <Feather name="check" size={10} color={colors.success} />
              <Text style={styles.rolePermissionText}>{perm}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const getMemberName = (member: TeamMember | null) => {
    if (!member) return '';
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.user) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return 'Unknown';
  };

  const getMemberInitials = (member: TeamMember | null) => {
    if (!member) return '??';
    if (member.firstName && member.lastName) {
      return (member.firstName[0] + member.lastName[0]).toUpperCase();
    }
    if (member.user) {
      return ((member.user.firstName?.[0] || '') + (member.user.lastName?.[0] || '')).toUpperCase();
    }
    return '??';
  };

  const renderUpgradeView = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.upgradeContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={fetchTeam} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Team Management</Text>
          <Text style={styles.headerSubtitle}>Grow your business</Text>
        </View>
      </View>

      <View style={styles.upgradeHeader}>
        <View style={styles.upgradeIcon}>
          <Feather name="users" size={40} color={colors.primary} />
        </View>
        <Text style={styles.upgradeTitle}>Ready to Expand?</Text>
        <Text style={styles.upgradeSubtitle}>
          Add team members to help manage jobs, track time, and grow your business together.
        </Text>
      </View>

      <View style={styles.upgradeCard}>
        <Text style={styles.upgradeCardTitle}>Team Plan</Text>
        <Text style={styles.upgradeCardSubtitle}>
          Everything in Pro, plus powerful team features
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>${teamPrice}</Text>
          <Text style={styles.pricePeriod}>/month</Text>
        </View>
        
        <Text style={styles.priceNote}>
          Base: ${TEAM_BASE_PRICE} + ${TEAM_SEAT_PRICE} per team member
        </Text>

        <View style={styles.seatSelector}>
          <Text style={styles.seatSelectorLabel}>Team members:</Text>
          <TouchableOpacity 
            style={styles.seatButton}
            onPress={() => setSeatCount(Math.max(1, seatCount - 1))}
            disabled={seatCount <= 1}
          >
            <Feather name="minus" size={18} color={seatCount <= 1 ? colors.muted : colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.seatCount}>{seatCount}</Text>
          <TouchableOpacity 
            style={styles.seatButton}
            onPress={() => setSeatCount(Math.min(20, seatCount + 1))}
            disabled={seatCount >= 20}
          >
            <Feather name="plus" size={18} color={seatCount >= 20 ? colors.muted : colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.ctaButton, isUpgrading && styles.ctaButtonDisabled]}
          onPress={handleUpgradeToTeam}
          disabled={isUpgrading}
        >
          {isUpgrading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaButtonText}>Upgrade to Team Plan</Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.ctaSubtext}>
          Cancel anytime. No lock-in contracts.
        </Text>
      </View>

      <View style={styles.benefitsSection}>
        <Text style={styles.sectionTitle}>What You Get</Text>
        {TEAM_BENEFITS.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Feather name={benefit.icon as any} size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDescription}>{benefit.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {!hasTeamPlan ? (
          renderUpgradeView()
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={fetchTeam} tintColor={colors.primary} />
            }
          >
            {BETA_MODE && (
              <View style={styles.betaBanner}>
                <Feather name="gift" size={24} color={colors.success} />
                <Text style={styles.betaBannerText}>
                  Beta: Team features are free! Invite your team now.
                </Text>
              </View>
            )}
            
            <View style={styles.header}>
              <TouchableOpacity testID="button-back" onPress={() => router.back()} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Team Management</Text>
                <Text testID="text-member-count" style={styles.headerSubtitle}>{teamMembers.length} team members</Text>
              </View>
              {currentUserIsOwner && (
                <TouchableOpacity 
                  testID="button-invite-member"
                  style={styles.inviteButton}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Feather name="user-plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: ROLE_CONFIG.owner.color + '20' }]}>
                <Feather name="shield" size={16} color={ROLE_CONFIG.owner.color} />
              </View>
              <Text style={styles.statValue}>{ownerCount}</Text>
              <Text style={styles.statLabel}>Owners</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: ROLE_CONFIG.admin.color + '20' }]}>
                <Feather name="user-check" size={16} color={ROLE_CONFIG.admin.color} />
              </View>
              <Text style={styles.statValue}>{adminCount}</Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: ROLE_CONFIG.staff.color + '20' }]}>
                <Feather name="users" size={16} color={ROLE_CONFIG.staff.color} />
              </View>
              <Text style={styles.statValue}>{staffCount}</Text>
              <Text style={styles.statLabel}>Staff</Text>
            </View>
          </View>

          <View style={styles.rolesInfoCard}>
            <Text style={styles.rolesInfoTitle}>Role Permissions Overview</Text>
            {Object.entries(ROLE_CONFIG).map(([key, config]) => (
              <View key={key} style={styles.roleInfoRow}>
                <View style={[styles.roleInfoBadge, { backgroundColor: config.color }]}>
                  <Feather name={config.icon as any} size={14} color="#FFFFFF" />
                </View>
                <View style={styles.roleInfoContent}>
                  <Text style={styles.roleInfoLabel}>{config.label}</Text>
                  <Text style={styles.roleInfoDescription}>
                    {ROLE_PERMISSION_SUMMARY[key as keyof typeof ROLE_PERMISSION_SUMMARY]?.slice(0, 2).join(' • ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Members</Text>
            {teamMembers.length > 0 ? (
              teamMembers.map(renderMemberCard)
            ) : !isLoading && (
              <View style={styles.emptyState}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyStateTitle}>No Team Members</Text>
                <Text style={styles.emptyStateText}>
                  Invite your first team member to get started with team collaboration
                </Text>
                {currentUserIsOwner && (
                  <TouchableOpacity 
                    testID="button-invite-member-empty"
                    style={styles.emptyStateButton}
                    onPress={() => setShowInviteModal(true)}
                  >
                    <Feather name="user-plus" size={18} color="#FFFFFF" />
                    <Text style={styles.emptyStateButtonText}>Invite Member</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          </ScrollView>
        )}

        {/* Invite Modal */}
        <Modal visible={showInviteModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View testID="modal-invite" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite Team Member</Text>
                <TouchableOpacity testID="button-close-invite-modal" onPress={() => setShowInviteModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabel, styles.inputLabelFirst]}>First Name *</Text>
                    <TextInput
                      testID="input-invite-first-name"
                      style={styles.input}
                      value={inviteFirstName}
                      onChangeText={setInviteFirstName}
                      placeholder="John"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabel, styles.inputLabelFirst]}>Last Name *</Text>
                    <TextInput
                      testID="input-invite-last-name"
                      style={styles.input}
                      value={inviteLastName}
                      onChangeText={setInviteLastName}
                      placeholder="Smith"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Email Address *</Text>
                <TextInput
                  testID="input-invite-email"
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="team@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Hourly Rate (Optional)</Text>
                <TextInput
                  testID="input-invite-hourly-rate"
                  style={styles.input}
                  value={inviteHourlyRate}
                  onChangeText={setInviteHourlyRate}
                  placeholder="$0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Select Role</Text>
                <View style={styles.roleOptions}>
                  {['admin', 'supervisor', 'staff'].map(renderRoleOption)}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  testID="button-cancel-invite"
                  style={styles.cancelButton}
                  onPress={() => setShowInviteModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  testID="button-send-invite"
                  style={styles.saveButton}
                  onPress={handleInvite}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Send Invite</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Member Detail Modal */}
        <Modal visible={showDetailModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Team Member Details</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {isLoadingDetail ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
                ) : selectedMember && (
                  <>
                    {/* Header with avatar and name */}
                    <View style={styles.memberDetailHeader}>
                      <View style={[
                        styles.memberDetailAvatar, 
                        { backgroundColor: (ROLE_CONFIG[selectedMember.role]?.color || colors.primary) + '20' }
                      ]}>
                        <Text style={[
                          styles.memberDetailAvatarText, 
                          { color: ROLE_CONFIG[selectedMember.role]?.color || colors.primary }
                        ]}>
                          {getMemberInitials(selectedMember)}
                        </Text>
                      </View>
                      <Text style={styles.memberDetailName}>{getMemberName(selectedMember)}</Text>
                      <Text style={styles.memberEmail}>
                        {selectedMember.email || selectedMember.user?.email || 'No email'}
                      </Text>
                      <View style={[
                        styles.memberDetailRole,
                        { backgroundColor: ROLE_CONFIG[selectedMember.role]?.color || colors.primary }
                      ]}>
                        <Feather 
                          name={(ROLE_CONFIG[selectedMember.role]?.icon || 'user') as any} 
                          size={12} 
                          color="#FFFFFF" 
                        />
                        <Text style={styles.memberDetailRoleText}>
                          {ROLE_CONFIG[selectedMember.role]?.label || 'Staff'}
                        </Text>
                      </View>
                    </View>

                    {/* Status */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Current Status</Text>
                      <View style={styles.statusRow}>
                        <View style={[
                          styles.statusIndicator,
                          { 
                            backgroundColor: memberStatus === 'on_job' 
                              ? colors.success 
                              : memberStatus === 'active' 
                                ? colors.info 
                                : colors.muted 
                          }
                        ]} />
                        <Text style={styles.statusText}>
                          {memberStatus === 'on_job' 
                            ? 'Currently on a job' 
                            : memberStatus === 'active' 
                              ? 'Active' 
                              : 'Offline'}
                        </Text>
                      </View>
                    </View>

                    {/* Contact Info */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Contact Information</Text>
                      <View style={styles.detailCard}>
                        <View style={styles.detailRow}>
                          <View style={[styles.detailIcon, { backgroundColor: colors.primary + '15' }]}>
                            <Feather name="mail" size={14} color={colors.primary} />
                          </View>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>
                            {selectedMember.email || selectedMember.user?.email || 'Not set'}
                          </Text>
                        </View>
                        <View style={[styles.detailRow, styles.detailRowLast]}>
                          <View style={[styles.detailIcon, { backgroundColor: colors.success + '15' }]}>
                            <Feather name="phone" size={14} color={colors.success} />
                          </View>
                          <Text style={styles.detailLabel}>Phone</Text>
                          <Text style={styles.detailValue}>
                            {selectedMember.phone || selectedMember.user?.phone || 'Not set'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Time Tracking Summary */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Time Tracking</Text>
                      <View style={styles.timeStats}>
                        <View style={styles.timeStat}>
                          <Text style={styles.timeStatValue}>{memberTimeStats.today}h</Text>
                          <Text style={styles.timeStatLabel}>Today</Text>
                        </View>
                        <View style={styles.timeStat}>
                          <Text style={styles.timeStatValue}>{memberTimeStats.week}h</Text>
                          <Text style={styles.timeStatLabel}>This Week</Text>
                        </View>
                        <View style={styles.timeStat}>
                          <Text style={styles.timeStatValue}>{memberTimeStats.month}h</Text>
                          <Text style={styles.timeStatLabel}>This Month</Text>
                        </View>
                      </View>
                    </View>

                    {/* Recent Jobs */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Recent Jobs</Text>
                      {memberJobs.length > 0 ? (
                        <View style={styles.detailCard}>
                          {memberJobs.map((job, idx) => {
                            const statusConfig = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG] || JOB_STATUS_CONFIG.todo;
                            return (
                              <View 
                                key={job.id} 
                                style={[
                                  styles.jobItem,
                                  idx === memberJobs.length - 1 && styles.jobItemLast
                                ]}
                              >
                                <View style={styles.jobInfo}>
                                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                                  {job.address && (
                                    <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
                                  )}
                                </View>
                                <View style={[styles.jobStatus, { backgroundColor: statusConfig.color }]}>
                                  <Text style={[styles.jobStatusText, { color: statusConfig.textColor }]}>
                                    {statusConfig.label}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.emptyDetail}>
                          <Feather name="briefcase" size={32} color={colors.mutedForeground} />
                          <Text style={styles.emptyDetailText}>No jobs assigned yet</Text>
                        </View>
                      )}
                    </View>

                    {/* Role Permissions */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Permissions</Text>
                      <View style={styles.detailCard}>
                        {(selectedMember.useCustomPermissions 
                          ? selectedMember.customPermissions || []
                          : ROLE_PERMISSION_SUMMARY[selectedMember.role as keyof typeof ROLE_PERMISSION_SUMMARY] || []
                        ).map((perm, idx) => (
                          <View key={idx} style={styles.rolePermissionItem}>
                            <Feather name="check" size={12} color={colors.success} />
                            <Text style={[styles.permissionLabel, { fontSize: 13 }]}>
                              {typeof perm === 'string' ? perm.replace(/_/g, ' ') : perm}
                            </Text>
                          </View>
                        ))}
                        {selectedMember.useCustomPermissions && (
                          <View style={[styles.customBadge, { marginTop: spacing.sm }]}>
                            <Feather name="key" size={10} color={colors.primary} />
                            <Text style={styles.customBadgeText}>Custom Permissions</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                {currentUserIsOwner && selectedMember && selectedMember.role !== 'owner' && (
                  <>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        openEditModal(selectedMember);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Edit Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.saveButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        Alert.alert(
                          'Change Role',
                          `Select new role for ${getMemberName(selectedMember)}`,
                          [
                            { text: 'Admin', onPress: () => handleRoleChange(selectedMember.id, 'admin') },
                            { text: 'Supervisor', onPress: () => handleRoleChange(selectedMember.id, 'supervisor') },
                            { text: 'Staff', onPress: () => handleRoleChange(selectedMember.id, 'staff') },
                            { text: 'Cancel', style: 'cancel' },
                          ]
                        );
                      }}
                    >
                      <Feather name="edit-2" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Change Role</Text>
                    </TouchableOpacity>
                  </>
                )}
                {(!currentUserIsOwner || !selectedMember || selectedMember.role === 'owner') && (
                  <TouchableOpacity 
                    style={[styles.saveButton, { flex: 1 }]}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Text style={styles.saveButtonText}>Close</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Member Modal */}
        <Modal visible={showEditModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View testID="modal-edit" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Team Member</Text>
                <TouchableOpacity testID="button-close-edit-modal" onPress={() => setShowEditModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabel, styles.inputLabelFirst]}>First Name</Text>
                    <TextInput
                      testID="input-edit-first-name"
                      style={styles.input}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="First name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabel, styles.inputLabelFirst]}>Last Name</Text>
                    <TextInput
                      testID="input-edit-last-name"
                      style={styles.input}
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Last name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  testID="input-edit-phone"
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+61 400 000 000"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Hourly Rate</Text>
                <TextInput
                  testID="input-edit-hourly-rate"
                  style={styles.input}
                  value={editHourlyRate}
                  onChangeText={setEditHourlyRate}
                  placeholder="$0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  testID="button-cancel-edit"
                  style={styles.cancelButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  testID="button-save-edit"
                  style={styles.saveButton}
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Permissions Modal */}
        <Modal visible={showPermissionsModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View testID="modal-permissions" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Permissions: {getMemberName(selectedMember)}
                </Text>
                <TouchableOpacity testID="button-close-permissions-modal" onPress={() => setShowPermissionsModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.permissionsModalBody}>
                {/* Custom Permissions Toggle */}
                <View style={styles.customToggleRow}>
                  <View style={styles.customToggleLabel}>
                    <Text style={styles.customToggleLabelTitle}>Use Custom Permissions</Text>
                    <Text style={styles.customToggleLabelSubtitle}>
                      {useCustomPermissions 
                        ? 'Custom permissions enabled'
                        : 'Using role default permissions'
                      }
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: useCustomPermissions ? colors.primary : colors.muted,
                      padding: 2,
                    }}
                    onPress={() => {
                      const newValue = !useCustomPermissions;
                      setUseCustomPermissions(newValue);
                      if (newValue && selectedPermissions.length === 0 && selectedMember) {
                        const rolePerms = getRolePermissions(selectedMember.roleId);
                        setSelectedPermissions([...rolePerms]);
                      }
                    }}
                  >
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#FFFFFF',
                      transform: [{ translateX: useCustomPermissions ? 22 : 0 }],
                    }} />
                  </TouchableOpacity>
                </View>

                {useCustomPermissions ? (
                  <>
                    {/* Quick Presets Section */}
                    <View style={styles.presetsSection}>
                      <Text style={styles.presetsSectionTitle}>Quick Presets</Text>
                      <View style={styles.presetsRow}>
                        {PERMISSION_PRESETS.slice(0, 2).map((preset) => {
                          const isActive = preset.permissions.every(p => selectedPermissions.includes(p)) &&
                            selectedPermissions.length === preset.permissions.length;
                          return (
                            <TouchableOpacity
                              key={preset.id}
                              style={[styles.presetButton, isActive && styles.presetButtonSelected]}
                              onPress={() => setSelectedPermissions([...preset.permissions])}
                            >
                              <View style={[styles.presetIcon, isActive && styles.presetIconSelected]}>
                                <Feather name={preset.icon as any} size={14} color={isActive ? '#FFFFFF' : colors.mutedForeground} />
                              </View>
                              <View style={styles.presetContent}>
                                <Text style={styles.presetName}>{preset.name}</Text>
                                <Text style={styles.presetDesc} numberOfLines={1}>{preset.description}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {PERMISSION_PRESETS.length > 2 && (
                        <View style={styles.presetsRow}>
                          {PERMISSION_PRESETS.slice(2).map((preset) => {
                            const isActive = preset.permissions.every(p => selectedPermissions.includes(p)) &&
                              selectedPermissions.length === preset.permissions.length;
                            return (
                              <TouchableOpacity
                                key={preset.id}
                                style={[styles.presetButton, isActive && styles.presetButtonSelected]}
                                onPress={() => setSelectedPermissions([...preset.permissions])}
                              >
                                <View style={[styles.presetIcon, isActive && styles.presetIconSelected]}>
                                  <Feather name={preset.icon as any} size={14} color={isActive ? '#FFFFFF' : colors.mutedForeground} />
                                </View>
                                <View style={styles.presetContent}>
                                  <Text style={styles.presetName}>{preset.name}</Text>
                                  <Text style={styles.presetDesc} numberOfLines={1}>{preset.description}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity 
                      style={styles.applyDefaultsButton}
                      onPress={applyRoleDefaults}
                    >
                      <Feather name="refresh-cw" size={14} color={colors.foreground} />
                      <Text style={styles.applyDefaultsText}>Reset to Role Defaults</Text>
                      <Text style={styles.permissionCount}>{selectedPermissions.length} selected</Text>
                    </TouchableOpacity>

                    {Object.entries(groupedPermissions).map(([category, perms]) => {
                      const allSelected = perms.every(p => selectedPermissions.includes(p.key));
                      const rolePerms = selectedMember ? getRolePermissions(selectedMember.roleId) : [];
                      const categoryMeta = PERMISSION_CATEGORY_META[category] || PERMISSION_CATEGORY_META['Other'];
                      const isSensitive = categoryMeta.isSensitive;
                      
                      return (
                        <View key={category} style={styles.permissionCategory}>
                          <View style={styles.permissionCategoryHeader}>
                            <View style={styles.categoryHeaderRow}>
                              <View style={[styles.categoryIcon, isSensitive && styles.categoryIconSensitive]}>
                                <Feather 
                                  name={categoryMeta.icon as any} 
                                  size={12} 
                                  color={isSensitive ? colors.destructive : colors.primary} 
                                />
                              </View>
                              <View style={styles.categoryTitleContainer}>
                                <Text style={styles.permissionCategoryTitle}>{category}</Text>
                                <Text style={styles.categoryDescription}>{categoryMeta.description}</Text>
                              </View>
                              {isSensitive && (
                                <View style={styles.sensitiveWarning}>
                                  <Feather name="lock" size={10} color={colors.destructive} />
                                  <Text style={styles.sensitiveWarningText}>Sensitive</Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity 
                              style={styles.selectAllButton}
                              onPress={() => toggleCategory(category)}
                            >
                              <Text style={styles.selectAllText}>
                                {allSelected ? 'None' : 'All'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          
                          {perms.map((perm) => {
                            const isSelected = selectedPermissions.includes(perm.key);
                            const isRoleDefault = rolePerms.includes(perm.key);
                            
                            return (
                              <TouchableOpacity
                                key={perm.key}
                                style={styles.permissionItem}
                                onPress={() => togglePermission(perm.key)}
                              >
                                <View style={[
                                  styles.permissionCheckbox,
                                  { 
                                    borderColor: isSelected ? colors.primary : colors.border,
                                    backgroundColor: isSelected ? colors.primary : 'transparent',
                                  }
                                ]}>
                                  {isSelected && (
                                    <Feather name="check" size={14} color="#FFFFFF" />
                                  )}
                                </View>
                                <Text style={styles.permissionLabel}>{perm.label}</Text>
                                {isRoleDefault && !isSelected && (
                                  <Text style={styles.roleDefaultHint}>(default)</Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.rolePermissionsDisplay}>
                    <Text style={styles.rolePermissionsTitle}>
                      Current Role Permissions ({selectedMember?.role})
                    </Text>
                    <View style={styles.permissionBadgesContainer}>
                      {selectedMember && getRolePermissions(selectedMember.roleId).map((perm) => (
                        <View key={perm} style={styles.permissionBadge}>
                          <Text style={styles.permissionBadgeText}>
                            {perm.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ))}
                      {selectedMember && getRolePermissions(selectedMember.roleId).length === 0 && (
                        <Text style={styles.permissionBadgeText}>No permissions assigned</Text>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  testID="button-cancel-permissions"
                  style={styles.cancelButton}
                  onPress={() => setShowPermissionsModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  testID="button-save-permissions"
                  style={styles.saveButton}
                  onPress={savePermissions}
                  disabled={isSavingPermissions}
                >
                  {isSavingPermissions ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Assign Job Modal */}
        <Modal visible={showAssignJobModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View testID="modal-assign-job" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Assign Job to {getMemberName(selectedMember)}
                </Text>
                <TouchableOpacity testID="button-close-assign-job-modal" onPress={() => setShowAssignJobModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {isLoadingJobs ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
                ) : availableJobs.length === 0 ? (
                  <View style={styles.emptyDetail}>
                    <Feather name="briefcase" size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyDetailText}>No available jobs to assign</Text>
                    <Text style={[styles.emptyDetailText, { marginTop: spacing.xs }]}>
                      Create a new job first, then assign it here
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.inputLabel, styles.inputLabelFirst]}>Select a Job</Text>
                    {availableJobs.map((job) => {
                      const isSelected = selectedJobId === job.id;
                      const statusConfig = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG] || JOB_STATUS_CONFIG.todo;
                      const isAssigned = !!job.assignedTo;
                      
                      return (
                        <TouchableOpacity
                          key={job.id}
                          testID={`option-job-${job.id}`}
                          style={[
                            styles.roleOption,
                            isSelected && styles.roleOptionSelected,
                            isSelected && { borderColor: colors.primary }
                          ]}
                          onPress={() => setSelectedJobId(job.id)}
                        >
                          <View style={styles.roleOptionHeader}>
                            <View style={[styles.roleOptionIcon, { backgroundColor: statusConfig.color + '30' }]}>
                              <Feather name="briefcase" size={16} color={statusConfig.textColor === '#FFFFFF' ? statusConfig.color : colors.foreground} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.roleOptionLabel} numberOfLines={1}>{job.title}</Text>
                              {job.address && (
                                <Text style={styles.roleOptionDesc} numberOfLines={1}>{job.address}</Text>
                              )}
                            </View>
                            <View style={[
                              styles.roleOptionCheck, 
                              { 
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                              }
                            ]}>
                              {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                            <View style={[styles.jobStatus, { backgroundColor: statusConfig.color }]}>
                              <Text style={[styles.jobStatusText, { color: statusConfig.textColor }]}>
                                {statusConfig.label}
                              </Text>
                            </View>
                            {isAssigned && (
                              <View style={[styles.customBadge, { backgroundColor: colors.warning + '20' }]}>
                                <Feather name="user" size={10} color={colors.warning} />
                                <Text style={[styles.customBadgeText, { color: colors.warning }]}>Already assigned</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  testID="button-cancel-assign-job"
                  style={styles.cancelButton}
                  onPress={() => setShowAssignJobModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  testID="button-submit-assign-job"
                  style={[styles.saveButton, !selectedJobId && { opacity: 0.5 }]}
                  onPress={handleAssignJob}
                  disabled={isAssigningJob || !selectedJobId}
                >
                  {isAssigningJob ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Assign Job</Text>
                    </>
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
