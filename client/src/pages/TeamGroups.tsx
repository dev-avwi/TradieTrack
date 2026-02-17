import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MoreVertical,
  Users,
  Trash2,
  Edit,
  UserPlus,
  X,
  Palette,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember, TeamGroup, TeamGroupMember } from "@shared/schema";

interface TeamGroupWithCount extends TeamGroup {
  memberCount: number;
}

interface TeamGroupWithMembers extends TeamGroup {
  members: Array<TeamGroupMember & { member?: TeamMember }>;
}

const colorOptions = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#64748b", label: "Slate" },
];

export default function TeamGroups() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TeamGroup | null>(null);
  const [viewingGroup, setViewingGroup] = useState<TeamGroupWithMembers | null>(null);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
  });

  const { data: groups = [], isLoading } = useQuery<TeamGroupWithCount[]>({
    queryKey: ["/api/team-groups"],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/team-groups", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-groups"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Group created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest(`/api/team-groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-groups"] });
      setEditingGroup(null);
      resetForm();
      toast({ title: "Group updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update group", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/team-groups/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-groups"] });
      toast({ title: "Group deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ groupId, teamMemberId }: { groupId: string; teamMemberId: number }) => {
      return apiRequest(`/api/team-groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ teamMemberId }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-groups"] });
      if (viewingGroup) {
        fetchGroupDetails(viewingGroup.id);
      }
      toast({ title: "Member added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add member", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, memberId }: { groupId: string; memberId: string }) => {
      return apiRequest(`/api/team-groups/${groupId}/members/${memberId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-groups"] });
      if (viewingGroup) {
        fetchGroupDetails(viewingGroup.id);
      }
      toast({ title: "Member removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await apiRequest(`/api/team-groups/${groupId}`);
      setViewingGroup(response as TeamGroupWithMembers);
    } catch (error) {
      console.error("Failed to fetch group details:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#3b82f6",
    });
  };

  const handleSubmit = () => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (group: TeamGroup) => {
    setFormData({
      name: group.name,
      description: group.description || "",
      color: group.color || "#3b82f6",
    });
    setEditingGroup(group);
  };

  const handleViewGroup = (group: TeamGroupWithCount) => {
    fetchGroupDetails(group.id);
    setManageMembersOpen(false);
  };

  const handleManageMembers = (group: TeamGroupWithCount) => {
    fetchGroupDetails(group.id);
    setManageMembersOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isFormOpen = createDialogOpen || editingGroup !== null;

  const availableMembers = viewingGroup
    ? teamMembers.filter(
        (tm) => !viewingGroup.members?.some((m) => m.teamMemberId === tm.id)
      )
    : teamMembers;

  return (
    <PageShell>
      <PageHeader
        title="Team Groups"
        description="Organize your team members into named crew groups"
      >
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team groups yet"
          description="Create your first team group to organize your crew members"
        >
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleViewGroup(group)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color || "#3b82f6" }}
                  />
                  <div className="min-w-0">
                    <CardTitle className="truncate">{group.name}</CardTitle>
                    {group.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {group.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageMembers(group);
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Manage Members
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(group);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Group
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(group.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingGroup(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Group" : "Create New Group"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                placeholder="e.g., The Plumblords"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe this group..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Group Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      formData.color === color.value
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  >
                    {formData.color === color.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingGroup(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingGroup
                ? "Update Group"
                : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewingGroup !== null && !manageMembersOpen} onOpenChange={(open) => {
        if (!open) {
          setViewingGroup(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: viewingGroup?.color || "#3b82f6" }}
              />
              <DialogTitle>{viewingGroup?.name}</DialogTitle>
            </div>
            {viewingGroup?.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {viewingGroup.description}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Members</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageMembersOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </div>
            {viewingGroup?.members?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members in this group yet
              </p>
            ) : (
              <div className="space-y-2">
                {viewingGroup?.members?.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={membership.member?.profilePhoto || undefined} />
                      <AvatarFallback>
                        {membership.member?.name ? getInitials(membership.member.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {membership.member?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {membership.member?.email}
                      </p>
                    </div>
                    {membership.role === "lead" && (
                      <Badge variant="secondary" className="text-xs">Lead</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageMembersOpen && viewingGroup !== null} onOpenChange={(open) => {
        if (!open) {
          setManageMembersOpen(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Members - {viewingGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewingGroup?.members && viewingGroup.members.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Current Members</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {viewingGroup.members.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={membership.member?.profilePhoto || undefined} />
                        <AvatarFallback>
                          {membership.member?.name ? getInitials(membership.member.name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {membership.member?.name || "Unknown"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          removeMemberMutation.mutate({
                            groupId: viewingGroup.id,
                            memberId: membership.id,
                          })
                        }
                        disabled={removeMemberMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableMembers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Add Members</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        viewingGroup &&
                        addMemberMutation.mutate({
                          groupId: viewingGroup.id,
                          teamMemberId: member.id,
                        })
                      }
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profilePhoto || undefined} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" disabled={addMemberMutation.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableMembers.length === 0 && teamMembers.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                All team members have been added to this group
              </p>
            )}

            {teamMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No team members available. Add team members first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageMembersOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
