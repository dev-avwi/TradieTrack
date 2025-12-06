import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TeamMember, UserRole } from "@shared/schema";

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

export default function TeamManagement() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Team Management</h1>
          <p className="text-muted-foreground">Manage your team members and roles</p>
        </div>
        <div className="flex gap-2">
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

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {teamMembers?.length || 0} team member{teamMembers?.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!teamMembers || teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No team members yet. Invite your first team member to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`team-member-${member.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-member-name-${member.id}`}>
                          {member.firstName} {member.lastName}
                        </h3>
                        {getStatusBadge(member)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </span>
                        <span>
                          {getRoleName(member.roleId)}
                        </span>
                        {member.hourlyRate && (
                          <span>
                            ${member.hourlyRate}/hr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {member.inviteStatus === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInviteMutation.mutate(member.id)}
                        disabled={resendInviteMutation.isPending}
                        data-testid={`button-resend-invite-${member.id}`}
                      >
                        Resend Invite
                      </Button>
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
                </div>
              ))}
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
    </div>
  );
}
