import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Mail, 
  Clock, 
  CheckCircle2,
  XCircle,
  Settings as SettingsIcon,
  Edit2,
  Save,
  X,
  Shield,
  Key,
  MapPin,
  Briefcase,
  Phone,
  Search,
  Users,
  UserCheck,
  UserX,
  Eye,
  Send,
  AlertTriangle,
  Calendar,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TeamMember, UserRole } from "@shared/schema";
import WorkerCommandCenter from "@/components/WorkerCommandCenter";

// Permission type from API
interface PermissionItem {
  key: string;
  label: string;
  category: string;
}

// Permissions Editor Component
function PermissionsEditorDialog({ 
  member, 
  roles,
  open, 
  onOpenChange 
}: { 
  member: TeamMember; 
  roles: UserRole[];
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [useCustom, setUseCustom] = useState(member.useCustomPermissions || false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    (member.customPermissions as string[]) || []
  );

  // Fetch available permissions
  const { data: permissionsList } = useQuery<PermissionItem[]>({
    queryKey: ['/api/team/permissions'],
  });

  // Get role's default permissions
  const memberRole = roles.find(r => r.id === member.roleId);
  const rolePermissions = (memberRole?.permissions as string[]) || [];

  // Group permissions by category
  const groupedPermissions = permissionsList?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, PermissionItem[]>) || {};

  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { permissions: string[]; useCustomPermissions: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${member.id}/permissions`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Permissions updated",
        description: `${member.firstName}'s permissions have been customized.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permissions",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTogglePermission = (permKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permKey) 
        ? prev.filter(p => p !== permKey)
        : [...prev, permKey]
    );
  };

  const handleSelectAll = (category: string) => {
    const categoryPerms = groupedPermissions[category]?.map(p => p.key) || [];
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  const handleApplyRoleDefaults = () => {
    setSelectedPermissions([...rolePermissions]);
  };

  const handleSave = () => {
    updatePermissionsMutation.mutate({
      permissions: selectedPermissions,
      useCustomPermissions: useCustom,
    });
  };

  // Initialize with role permissions when switching to custom
  const handleCustomToggle = (enabled: boolean) => {
    setUseCustom(enabled);
    if (enabled && selectedPermissions.length === 0) {
      setSelectedPermissions([...rolePermissions]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-permissions-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Customise Permissions for {member.firstName} {member.lastName}
          </DialogTitle>
          <DialogDescription>
            Override the default role permissions with custom access for this team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
          {/* Custom Permissions Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Use Custom Permissions</Label>
              <p className="text-sm text-muted-foreground">
                {useCustom 
                  ? "This member has custom permissions instead of role defaults"
                  : `Using ${memberRole?.name || 'role'} default permissions`
                }
              </p>
            </div>
            <Switch
              checked={useCustom}
              onCheckedChange={handleCustomToggle}
              data-testid="switch-use-custom"
            />
          </div>

          {useCustom && (
            <>
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyRoleDefaults}
                  data-testid="button-apply-defaults"
                >
                  Apply Role Defaults
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedPermissions.length} permissions selected
                </span>
              </div>

              {/* Permissions by Category */}
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([category, perms]) => {
                  const allSelected = perms.every(p => selectedPermissions.includes(p.key));
                  const someSelected = perms.some(p => selectedPermissions.includes(p.key));
                  
                  return (
                    <div key={category} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{category}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll(category)}
                          className="text-xs h-7"
                          data-testid={`button-toggle-all-${category.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => {
                          const isSelected = selectedPermissions.includes(perm.key);
                          const isRoleDefault = rolePermissions.includes(perm.key);
                          
                          return (
                            <div
                              key={perm.key}
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                            >
                              <Checkbox
                                id={perm.key}
                                checked={isSelected}
                                onCheckedChange={() => handleTogglePermission(perm.key)}
                                data-testid={`checkbox-${perm.key}`}
                              />
                              <Label
                                htmlFor={perm.key}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {perm.label}
                                {isRoleDefault && !isSelected && (
                                  <span className="text-xs text-muted-foreground ml-1">(role default)</span>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!useCustom && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-2">Current Role Permissions ({memberRole?.name})</h4>
              <div className="flex flex-wrap gap-2">
                {rolePermissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-xs">
                    {perm.replace(/_/g, ' ')}
                  </Badge>
                ))}
                {rolePermissions.length === 0 && (
                  <span className="text-sm text-muted-foreground">No permissions assigned</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-permissions"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePermissionsMutation.isPending}
            data-testid="button-save-permissions"
          >
            {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleEditCard({ role, onUpdate }: { role: UserRole; onUpdate: () => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(role.name);
  const [editDescription, setEditDescription] = useState(role.description || '');

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest('PATCH', `/api/team/roles/${role.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "The role has been updated successfully.",
      });
      setIsEditing(false);
      onUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!editName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a role name.",
        variant: "destructive",
      });
      return;
    }
    updateRoleMutation.mutate({ name: editName.trim(), description: editDescription.trim() });
  };

  const handleCancel = () => {
    setEditName(role.name);
    setEditDescription(role.description || '');
    setIsEditing(false);
  };

  const isSystemRole = role.name === 'OWNER';

  return (
    <div
      className="p-4 border rounded-lg space-y-3"
      data-testid={`role-${role.id}`}
    >
      {isEditing ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`role-name-${role.id}`}>Role Name</Label>
            <Input
              id={`role-name-${role.id}`}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Role name"
              data-testid={`input-role-name-${role.id}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`role-desc-${role.id}`}>Description</Label>
            <Textarea
              id={`role-desc-${role.id}`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Role description"
              rows={2}
              data-testid={`input-role-description-${role.id}`}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              data-testid={`button-cancel-role-${role.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateRoleMutation.isPending || !editName.trim()}
              data-testid={`button-save-role-${role.id}`}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateRoleMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold">{role.name}</h4>
              {isSystemRole && (
                <Badge variant="secondary" className="text-xs">System</Badge>
              )}
            </div>
            {!isSystemRole && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                data-testid={`button-edit-role-${role.id}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {role.description || 'No description'}
          </p>
        </>
      )}
    </div>
  );
}

// Job type for assignment
interface Job {
  id: string;
  title: string;
  status: string;
  clientId: string;
  assignedTo?: string;
  scheduledDate?: string;
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null);
  const [assignJobMember, setAssignJobMember] = useState<TeamMember | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [commandCenterMemberId, setCommandCenterMemberId] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Form state for invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteHourlyRate, setInviteHourlyRate] = useState("");

  // Fetch team members
  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  // Fetch unassigned jobs for assignment
  const { data: availableJobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs', { status: 'unassigned' }],
    queryFn: async () => {
      const response = await fetch('/api/jobs?limit=50');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
    enabled: !!assignJobMember,
  });

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ['/api/team/roles'],
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      hourlyRate?: number;
    }) => {
      const response = await apiRequest('POST', '/api/team/members/invite', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Invite sent",
        description: "Team member invitation has been sent successfully.",
      });
      setInviteDialogOpen(false);
      resetInviteForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invite",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest('POST', `/api/team/members/${memberId}/resend-invite`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invite resent",
        description: "The invitation has been resent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend invite",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest('DELETE', `/api/team/members/${memberId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Location toggle mutation
  const locationToggleMutation = useMutation({
    mutationFn: async ({ memberId, enabled }: { memberId: string; enabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${memberId}/location`, {
        locationEnabledByOwner: enabled
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: variables.enabled ? "Location enabled" : "Location disabled",
        description: `Location tracking has been ${variables.enabled ? 'enabled' : 'disabled'} for this team member.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update location settings",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Assign job mutation
  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, memberId }: { jobId: string; memberId: string }) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/assign`, {
        assignedTo: memberId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job assigned",
        description: `Job has been assigned to ${assignJobMember?.firstName} ${assignJobMember?.lastName}.`,
      });
      setAssignJobMember(null);
      setSelectedJobId("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign job",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteRoleId("");
    setInviteHourlyRate("");
  };

  const handleInvite = () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName || !inviteRoleId) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate and convert hourly rate if provided
    let hourlyRateNum: number | undefined = undefined;
    if (inviteHourlyRate) {
      hourlyRateNum = parseFloat(inviteHourlyRate);
      if (isNaN(hourlyRateNum) || hourlyRateNum < 0) {
        toast({
          title: "Invalid hourly rate",
          description: "Please enter a valid hourly rate (positive number).",
          variant: "destructive",
        });
        return;
      }
    }

    inviteMutation.mutate({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      roleId: inviteRoleId,
      hourlyRate: hourlyRateNum,
    });
  };

  // Team statistics
  const teamStats = {
    total: teamMembers?.length || 0,
    active: teamMembers?.filter(m => m.inviteStatus === 'accepted').length || 0,
    pending: teamMembers?.filter(m => m.inviteStatus === 'pending').length || 0,
    declined: teamMembers?.filter(m => m.inviteStatus === 'declined').length || 0,
  };

  // Filter team members based on search and status
  const filteredMembers = teamMembers?.filter(member => {
    // Search filter
    const matchesSearch = searchQuery === "" || 
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || member.inviteStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (member: TeamMember) => {
    if (member.inviteStatus === 'accepted') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    }
    if (member.inviteStatus === 'pending') {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
    if (member.inviteStatus === 'declined') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
    }
    return null;
  };

  const getRoleName = (roleId: string) => {
    const role = roles?.find(r => r.id === roleId);
    return role?.name || "Unknown Role";
  };

  if (membersLoading || rolesLoading) {
    return (
      <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-team-management">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">Manage your team members and roles</p>
          </div>
        </div>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-team-management">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Team Management</h1>
          <p className="text-muted-foreground">Manage your team members and roles</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setRolesDialogOpen(true)}
            data-testid="button-manage-roles"
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Manage Roles
          </Button>
          <Button
            onClick={() => setInviteDialogOpen(true)}
            data-testid="button-invite-member"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Team Member
          </Button>
        </div>
      </div>

      {/* Team Stats Overview */}
      {teamMembers && teamMembers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover-elevate'}`}
            onClick={() => setStatusFilter('all')}
            data-testid="card-stat-total"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total">{teamStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Team</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'accepted' ? 'ring-2 ring-green-500' : 'hover-elevate'}`}
            onClick={() => setStatusFilter('accepted')}
            data-testid="card-stat-active"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-active">{teamStats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : 'hover-elevate'}`}
            onClick={() => setStatusFilter('pending')}
            data-testid="card-stat-pending"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-pending">{teamStats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'declined' ? 'ring-2 ring-red-500' : 'hover-elevate'}`}
            onClick={() => setStatusFilter('declined')}
            data-testid="card-stat-declined"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-declined">{teamStats.declined}</p>
                  <p className="text-xs text-muted-foreground">Declined</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {filteredMembers.length} of {teamMembers?.length || 0} team member{teamMembers?.length !== 1 ? 's' : ''}
                {statusFilter !== 'all' && ` (filtered by ${statusFilter})`}
              </CardDescription>
            </div>
            {teamMembers && teamMembers.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-[200px]"
                    data-testid="input-search-members"
                  />
                </div>
                {(searchQuery || statusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!teamMembers || teamMembers.length === 0 ? (
            <div className="text-center py-12 space-y-6" data-testid="empty-team-state">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Ready to grow your team?</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Invite team members to help manage jobs, track time, and communicate with clients. 
                  Each member gets their own login and role-based access.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => setInviteDialogOpen(true)}
                  size="lg"
                  data-testid="button-invite-first-member"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Your First Team Member
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-6 text-sm">
                <div className="p-4 rounded-lg bg-muted/50">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">Assign Jobs</p>
                  <p className="text-muted-foreground text-xs">Delegate work to your team</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                  <p className="font-medium">Track Time</p>
                  <p className="text-muted-foreground text-xs">Monitor hours and productivity</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <Shield className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                  <p className="font-medium">Role-Based Access</p>
                  <p className="text-muted-foreground text-xs">Control what each member sees</p>
                </div>
              </div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 space-y-4" data-testid="no-results-state">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">No members found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery 
                    ? `No team members match "${searchQuery}"`
                    : `No ${statusFilter} team members`
                  }
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                data-testid="button-clear-filters-empty"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMembers.map((member) => {
                const isPending = member.inviteStatus === 'pending';
                const isDeclined = member.inviteStatus === 'declined';
                const inviteSentDate = member.createdAt ? new Date(member.createdAt) : null;
                const expiresDate = inviteSentDate ? new Date(inviteSentDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                const isExpiringSoon = expiresDate && (expiresDate.getTime() - Date.now()) < 2 * 24 * 60 * 60 * 1000;
                
                return (
                <div
                  key={member.id}
                  className={`p-4 border rounded-lg hover-elevate ${
                    isPending 
                      ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10' 
                      : isDeclined
                        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
                        : ''
                  }`}
                  data-testid={`team-member-${member.id}`}
                >
                  {/* Pending Invite Banner */}
                  {isPending && (
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-yellow-200 dark:border-yellow-800">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Invitation Pending</p>
                        <div className="flex items-center gap-3 text-xs text-yellow-700 dark:text-yellow-400 flex-wrap">
                          {inviteSentDate && (
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              Sent {inviteSentDate.toLocaleDateString('en-AU')}
                            </span>
                          )}
                          {expiresDate && (
                            <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>
                              <Calendar className="h-3 w-3" />
                              {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                              Expires {expiresDate.toLocaleDateString('en-AU')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => resendInviteMutation.mutate(member.id)}
                          disabled={resendInviteMutation.isPending}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          data-testid={`button-resend-invite-${member.id}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Cancel invitation for ${member.firstName} ${member.lastName}?`)) {
                              removeMutation.mutate(member.id);
                            }
                          }}
                          disabled={removeMutation.isPending}
                          className="border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                          data-testid={`button-cancel-invite-${member.id}`}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Top Row - Avatar, Name, Status */}
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isPending 
                        ? 'bg-yellow-100 dark:bg-yellow-900/50' 
                        : isDeclined
                          ? 'bg-red-100 dark:bg-red-900/50'
                          : 'bg-primary/10'
                    }`}>
                      <span className={`text-base font-semibold ${
                        isPending 
                          ? 'text-yellow-700 dark:text-yellow-400' 
                          : isDeclined
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-primary'
                      }`}>
                        {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg" data-testid={`text-member-name-${member.id}`}>
                          {member.firstName} {member.lastName}
                        </h3>
                        {!isPending && getStatusBadge(member)}
                        <Badge variant="outline" className="text-xs">
                          {getRoleName(member.roleId)}
                        </Badge>
                        {member.useCustomPermissions && (
                          <Badge variant="secondary" className="text-xs">
                            <Key className="h-2 w-2 mr-1" />
                            Custom Permissions
                          </Badge>
                        )}
                      </div>
                      
                      {/* Details Row */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </span>
                        {member.hourlyRate && (
                          <span className="flex items-center gap-1">
                            ${member.hourlyRate}/hr
                          </span>
                        )}
                        {member.startDate && (
                          <span className="flex items-center gap-1">
                            Started {new Date(member.startDate).toLocaleDateString('en-AU')}
                          </span>
                        )}
                      </div>
                      
                      {/* Email Preview for Pending */}
                      {isPending && (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-900 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Invitation email sent to:
                          </p>
                          <p className="text-sm font-medium">{member.email}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            They can click the link in the email to create an account and join your team as a <span className="font-medium">{getRoleName(member.roleId)}</span>.
                          </p>
                        </div>
                      )}

                      {/* Location & Controls Row (only for accepted members) */}
                      {member.inviteStatus === 'accepted' && (
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                          {/* Location Toggle */}
                          <div className="flex items-center gap-2">
                            <MapPin className={`h-4 w-4 ${member.locationEnabledByOwner !== false ? 'text-green-500' : 'text-muted-foreground'}`} />
                            <Label htmlFor={`location-${member.id}`} className="text-sm">
                              Location Access
                            </Label>
                            <Switch
                              id={`location-${member.id}`}
                              checked={member.locationEnabledByOwner !== false}
                              onCheckedChange={(checked) => {
                                locationToggleMutation.mutate({ memberId: member.id, enabled: checked });
                              }}
                              disabled={locationToggleMutation.isPending}
                              data-testid={`switch-location-${member.id}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - only show for accepted/declined members */}
                    {!isPending && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {member.inviteStatus === 'accepted' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setCommandCenterMemberId(member.id)}
                              data-testid={`button-view-details-${member.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAssignJobMember(member)}
                              data-testid={`button-assign-job-${member.id}`}
                            >
                              <Briefcase className="h-3 w-3 mr-1" />
                              Assign Job
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPermissionsMember(member)}
                              data-testid={`button-permissions-${member.id}`}
                            >
                              <Key className="h-3 w-3 mr-1" />
                              Permissions
                            </Button>
                          </>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove ${member.firstName} ${member.lastName}?`)) {
                              removeMutation.mutate(member.id);
                            }
                          }}
                          disabled={removeMutation.isPending}
                          data-testid={`button-remove-${member.id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent data-testid="dialog-invite-member">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a new team member. They'll receive an email with instructions to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Smith"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john.smith@example.com"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate (optional)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                value={inviteHourlyRate}
                onChange={(e) => setInviteHourlyRate(e.target.value)}
                placeholder="50.00"
                data-testid="input-hourly-rate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                resetInviteForm();
              }}
              data-testid="button-cancel-invite"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles Dialog with Editing */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-manage-roles">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              View and customize roles and permissions for your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {roles?.map((role) => (
              <RoleEditCard 
                key={role.id} 
                role={role} 
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/team/roles'] })}
              />
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRolesDialogOpen(false)}
              data-testid="button-close-roles"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Editor Dialog */}
      {permissionsMember && roles && (
        <PermissionsEditorDialog
          member={permissionsMember}
          roles={roles}
          open={!!permissionsMember}
          onOpenChange={(open) => !open && setPermissionsMember(null)}
        />
      )}

      {/* Assign Job Dialog */}
      <Dialog open={!!assignJobMember} onOpenChange={(open) => !open && setAssignJobMember(null)}>
        <DialogContent data-testid="dialog-assign-job">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Assign Job to {assignJobMember?.firstName} {assignJobMember?.lastName}
            </DialogTitle>
            <DialogDescription>
              Select a job to assign to this team member. They'll be able to see and manage the job in their Work view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job">Select Job</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Choose a job to assign" />
                </SelectTrigger>
                <SelectContent>
                  {availableJobs?.filter(job => 
                    job.status !== 'completed' && job.status !== 'archived'
                  ).map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {job.status}
                        </Badge>
                        {job.assignedTo && (
                          <Badge variant="secondary" className="text-xs">
                            Already Assigned
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  )) || (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No jobs available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignJobMember(null);
                setSelectedJobId("");
              }}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedJobId && assignJobMember?.memberId) {
                  assignJobMutation.mutate({ 
                    jobId: selectedJobId, 
                    memberId: assignJobMember.memberId 
                  });
                }
              }}
              disabled={!selectedJobId || assignJobMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignJobMutation.isPending ? "Assigning..." : "Assign Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Worker Command Center Sheet */}
      <WorkerCommandCenter
        memberId={commandCenterMemberId || ''}
        open={!!commandCenterMemberId}
        onOpenChange={(open) => !open && setCommandCenterMemberId(null)}
      />
    </div>
  );
}
