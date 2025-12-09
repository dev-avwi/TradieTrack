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

interface TeamMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'supervisor' | 'staff';
  permissions: string[];
  inviteStatus: 'pending' | 'accepted' | 'rejected';
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
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
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  roleInfoBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfoContent: {
    flex: 1,
  },
  roleInfoLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  roleInfoDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
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
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
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
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
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
    backgroundColor: colors.primaryLight,
  },
  roleOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  roleOptionLabel: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  roleOptionDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
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
});

export default function TeamManagementScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
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
    supervisor: { 
      label: 'Supervisor', 
      color: colors.warning, 
      icon: 'users',
      description: 'Manage assigned workers' 
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

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [isSending, setIsSending] = useState(false);

  const fetchTeam = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<TeamMember[]>('/api/team/members');
      if (response.data) {
        setTeamMembers(response.data);
      }
    } catch (error) {
      console.log('Error fetching team:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchTeam();
  }, []);

  const currentUserIsOwner = teamMembers.some(m => m.role === 'owner');

  const handleInvite = async () => {
    if (!inviteEmail) {
      Alert.alert('Required', 'Please enter an email address');
      return;
    }
    
    setIsSending(true);
    try {
      await api.post('/api/team/invite', {
        email: inviteEmail,
        role: inviteRole,
      });
      Alert.alert('Invite Sent', `Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('staff');
      fetchTeam();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    }
    setIsSending(false);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await api.patch(`/api/team/members/${memberId}`, { role: newRole });
      setTeamMembers(prev => 
        prev.map(m => m.id === memberId ? { ...m, role: newRole as any } : m)
      );
      Alert.alert('Updated', 'Role changed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update role');
    }
  };

  const handleRemove = async (member: TeamMember) => {
    const userName = member.user 
      ? `${member.user.firstName} ${member.user.lastName}`
      : 'this member';
      
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${userName} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/team/members/${member.id}`);
              setTeamMembers(prev => prev.filter(m => m.id !== member.id));
              Alert.alert('Removed', 'Team member removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const ownerCount = teamMembers.filter(m => m.role === 'owner').length;
  const adminCount = teamMembers.filter(m => m.role === 'admin').length;
  const staffCount = teamMembers.filter(m => m.role === 'staff' || m.role === 'supervisor').length;

  const renderMemberCard = (member: TeamMember) => {
    const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.staff;
    const statusConfig = STATUS_CONFIG[member.inviteStatus] || STATUS_CONFIG.pending;
    const userName = member.user 
      ? `${member.user.firstName} ${member.user.lastName}`
      : 'Unnamed User';

    const getInitials = () => {
      if (!member.user) return '??';
      const first = member.user.firstName?.[0] || '';
      const last = member.user.lastName?.[0] || '';
      return (first + last).toUpperCase();
    };

    return (
      <View key={member.id} style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View style={[styles.avatar, { backgroundColor: roleConfig.color + '20' }]}>
            <Text style={[styles.avatarText, { color: roleConfig.color }]}>{getInitials()}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{userName}</Text>
            <Text style={styles.memberEmail}>{member.user?.email || 'No email'}</Text>
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
            <Text style={styles.roleDescription}>{roleConfig.description}</Text>
          </View>
        </View>

        {member.role !== 'owner' && currentUserIsOwner && (
          <View style={styles.memberActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Alert.alert(
                  'Change Role',
                  `Select new role for ${userName}`,
                  [
                    { text: 'Admin', onPress: () => handleRoleChange(member.id, 'admin') },
                    { text: 'Supervisor', onPress: () => handleRoleChange(member.id, 'supervisor') },
                    { text: 'Staff', onPress: () => handleRoleChange(member.id, 'staff') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={styles.actionButtonText}>Change Role</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => handleRemove(member)}
            >
              <Feather name="user-minus" size={14} color={colors.destructive} />
              <Text style={[styles.actionButtonText, { color: colors.destructive }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
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
            <RefreshControl refreshing={isLoading} onRefresh={fetchTeam} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Team Management</Text>
              <Text style={styles.headerSubtitle}>{teamMembers.length} team members</Text>
            </View>
            <TouchableOpacity 
              style={styles.inviteButton}
              onPress={() => setShowInviteModal(true)}
            >
              <Feather name="user-plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
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
            <Text style={styles.rolesInfoTitle}>Role Permissions</Text>
            {Object.entries(ROLE_CONFIG).map(([key, config]) => (
              <View key={key} style={styles.roleInfoRow}>
                <View style={[styles.roleInfoBadge, { backgroundColor: config.color }]}>
                  <Feather name={config.icon as any} size={12} color="#FFFFFF" />
                </View>
                <View style={styles.roleInfoContent}>
                  <Text style={styles.roleInfoLabel}>{config.label}</Text>
                  <Text style={styles.roleInfoDescription}>{config.description}</Text>
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
                  Invite your first team member to get started
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateButton}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Feather name="user-plus" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyStateButtonText}>Invite Member</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <Modal visible={showInviteModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite Team Member</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="team@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.inputLabel}>Role</Text>
                <View style={styles.roleOptions}>
                  {['admin', 'supervisor', 'staff'].map(role => {
                    const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          inviteRole === role && styles.roleOptionSelected,
                          inviteRole === role && { borderColor: config.color }
                        ]}
                        onPress={() => setInviteRole(role)}
                      >
                        <View style={[styles.roleOptionIcon, { backgroundColor: config.color + '20' }]}>
                          <Feather name={config.icon as any} size={16} color={config.color} />
                        </View>
                        <Text style={styles.roleOptionLabel}>{config.label}</Text>
                        <Text style={styles.roleOptionDesc} numberOfLines={2}>{config.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowInviteModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
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
      </View>
    </>
  );
}
