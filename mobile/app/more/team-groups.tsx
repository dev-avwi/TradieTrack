import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';

interface TeamGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  memberCount?: number;
}

interface TeamMember {
  id: number;
  name: string;
  email?: string;
  profilePhoto?: string;
}

interface GroupMember {
  id: string;
  teamMemberId: number;
  role?: string;
  member?: TeamMember;
}

interface TeamGroupWithMembers extends TeamGroup {
  members?: GroupMember[];
}

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#64748b', label: 'Slate' },
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  memberCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
    alignSelf: 'flex-start',
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'] * 2,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.foreground,
  },
  colorOptionInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.muted,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  disabledButton: {
    opacity: 0.6,
  },
  memberSection: {
    marginTop: spacing.lg,
  },
  memberSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  memberRoleBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginLeft: spacing.sm,
  },
  memberRoleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  removeMemberButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addMemberText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyMembers: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeamGroupsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TeamGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<TeamGroupWithMembers | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });

  const loadData = useCallback(async () => {
    try {
      const [groupsRes, membersRes] = await Promise.all([
        api.get<TeamGroup[]>('/api/team-groups'),
        api.get<TeamMember[]>('/api/team-members'),
      ]);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (membersRes.data) setTeamMembers(membersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#3b82f6' });
  };

  const handleCreateNew = () => {
    setEditingGroup(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (group: TeamGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#3b82f6',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingGroup) {
        await api.patch(`/api/team-groups/${editingGroup.id}`, formData);
      } else {
        await api.post('/api/team-groups', formData);
      }
      setShowModal(false);
      resetForm();
      setEditingGroup(null);
      await loadData();
      Alert.alert('Success', editingGroup ? 'Group updated' : 'Group created');
    } catch (error) {
      Alert.alert('Error', 'Failed to save group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (group: TeamGroup) => {
    Alert.alert('Delete Group', `Are you sure you want to delete "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/team-groups/${group.id}`);
            await loadData();
            Alert.alert('Success', 'Group deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete group');
          }
        },
      },
    ]);
  };

  const handleManageMembers = async (group: TeamGroup) => {
    try {
      const res = await api.get<TeamGroupWithMembers>(`/api/team-groups/${group.id}`);
      if (res.data) {
        setViewingGroup(res.data);
        setShowMembersModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load group details');
    }
  };

  const handleAddMember = async (memberId: number) => {
    if (!viewingGroup) return;
    try {
      await api.post(`/api/team-groups/${viewingGroup.id}/members`, { teamMemberId: memberId });
      const res = await api.get<TeamGroupWithMembers>(`/api/team-groups/${viewingGroup.id}`);
      if (res.data) setViewingGroup(res.data);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to add member');
    }
  };

  const handleRemoveMember = (membership: GroupMember) => {
    if (!viewingGroup) return;
    Alert.alert('Remove Member', `Remove ${membership.member?.name || 'this member'} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/team-groups/${viewingGroup.id}/members/${membership.id}`);
            const res = await api.get<TeamGroupWithMembers>(`/api/team-groups/${viewingGroup.id}`);
            if (res.data) setViewingGroup(res.data);
            await loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const getAvailableMembers = () => {
    if (!viewingGroup?.members) return teamMembers;
    return teamMembers.filter(
      (tm) => !viewingGroup.members?.some((m) => m.teamMemberId === tm.id)
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Team Groups',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity onPress={handleCreateNew} style={{ marginRight: spacing.md }}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="users" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No team groups yet</Text>
            <Text style={styles.emptyText}>Create your first team group to organize your crew members</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
              <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity key={group.id} style={styles.card} onPress={() => handleManageMembers(group)} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.colorDot, { backgroundColor: group.color || '#3b82f6' }]} />
                  <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(group)}>
                    <Feather name="edit-2" size={iconSizes.sm} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(group)}>
                    <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
              {group.description ? (
                <Text style={styles.description} numberOfLines={2}>{group.description}</Text>
              ) : null}
              <View style={styles.memberCountBadge}>
                <Feather name="users" size={10} color={colors.mutedForeground} />
                <Text style={styles.memberCountText}>
                  {group.memberCount || 0} member{(group.memberCount || 0) !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.manageButton} onPress={() => handleManageMembers(group)}>
                <Feather name="user-plus" size={iconSizes.sm} color={colors.primary} />
                <Text style={styles.manageButtonText}>Manage Members</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingGroup ? 'Edit Group' : 'Create Group'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingGroup(null); resetForm(); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Group Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(t) => setFormData({ ...formData, name: t })}
                  placeholder="e.g., The Plumblords"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(t) => setFormData({ ...formData, description: t })}
                  placeholder="Describe this group..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Group Color</Text>
                <View style={styles.colorPicker}>
                  {COLOR_OPTIONS.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: c.value },
                        formData.color === c.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, color: c.value })}
                    >
                      {formData.color === c.value && <View style={styles.colorOptionInner} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); setEditingGroup(null); resetForm(); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!formData.name.trim() || isSaving) && styles.disabledButton]}
                onPress={handleSave}
                disabled={!formData.name.trim() || isSaving}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingGroup ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMembersModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {viewingGroup?.color && (
                  <View style={[styles.colorDot, { backgroundColor: viewingGroup.color }]} />
                )}
                <Text style={styles.modalTitle}>{viewingGroup?.name || 'Members'}</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowMembersModal(false); setViewingGroup(null); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {viewingGroup?.members && viewingGroup.members.length > 0 ? (
                <View>
                  <Text style={[styles.label, { marginBottom: spacing.md }]}>Current Members</Text>
                  {viewingGroup.members.map((membership) => (
                    <View key={membership.id} style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {membership.member?.name ? getInitials(membership.member.name) : '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{membership.member?.name || 'Unknown'}</Text>
                        {membership.member?.email ? (
                          <Text style={styles.memberEmail}>{membership.member.email}</Text>
                        ) : null}
                      </View>
                      {membership.role === 'lead' && (
                        <View style={styles.memberRoleBadge}>
                          <Text style={styles.memberRoleText}>Lead</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.removeMemberButton} onPress={() => handleRemoveMember(membership)}>
                        <Feather name="x" size={iconSizes.md} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyMembers}>No members in this group yet</Text>
              )}

              {getAvailableMembers().length > 0 && (
                <View style={styles.memberSection}>
                  <Text style={[styles.label, { marginBottom: spacing.md }]}>Add Members</Text>
                  {getAvailableMembers().map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.addMemberCard}
                      onPress={() => handleAddMember(member.id)}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{getInitials(member.name)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        {member.email ? (
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        ) : null}
                      </View>
                      <Feather name="plus" size={iconSizes.md} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {getAvailableMembers().length === 0 && teamMembers.length > 0 && viewingGroup?.members && viewingGroup.members.length > 0 && (
                <Text style={styles.emptyMembers}>All team members have been added</Text>
              )}

              {teamMembers.length === 0 && (
                <Text style={styles.emptyMembers}>No team members available. Add team members first.</Text>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1 }]}
                onPress={() => { setShowMembersModal(false); setViewingGroup(null); }}
              >
                <Text style={styles.saveButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
