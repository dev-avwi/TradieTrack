import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Shield, 
  Calendar,
  Edit2,
  Save,
  X,
  Users,
  Crown,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ProfileData {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImageUrl: string | null;
    tradeType: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
  isOwner: boolean;
  isTeamMember: boolean;
  teamInfo: {
    isBusinessOwner?: boolean;
    businessOwnerId?: number;
    businessName: string;
    businessEmail: string;
    businessPhone: string | null;
    teamSize?: number;
    joinedAt?: string;
  } | null;
  roleInfo: {
    roleId: string | number;
    roleName: string;
    roleDescription: string;
    hasCustomPermissions: boolean;
  } | null;
  permissions: string[];
}

const permissionLabels: Record<string, string> = {
  read_jobs: "View Jobs",
  write_jobs: "Create/Edit Jobs",
  delete_jobs: "Delete Jobs",
  read_clients: "View Clients",
  write_clients: "Create/Edit Clients",
  delete_clients: "Delete Clients",
  read_quotes: "View Quotes",
  write_quotes: "Create/Edit Quotes",
  read_invoices: "View Invoices",
  write_invoices: "Create/Edit Invoices",
  read_payments: "View Payments",
  process_payments: "Process Payments",
  read_time_entries: "View Time Entries",
  write_time_entries: "Track Time",
  read_team: "View Team Members",
  manage_team: "Manage Team",
  view_reports: "View Reports",
  view_map: "View Map Tracking",
  manage_settings: "Manage Settings",
  manage_billing: "Manage Billing",
};

export default function MyAccount() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile/me'],
    staleTime: 30000,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string }) => {
      const response = await apiRequest('PATCH', '/api/profile/me', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile updated",
        description: "Your personal details have been saved.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (profile) {
      setFormData({
        firstName: profile.user.firstName || "",
        lastName: profile.user.lastName || "",
        phone: profile.user.phone || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Unable to load profile information. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">My Account</h1>
        <p className="text-muted-foreground">
          View and manage your personal details and account settings
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Details
            </CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit} data-testid="button-edit-profile">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel} data-testid="button-cancel-edit">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  data-testid="input-first-name"
                />
              ) : (
                <p className="text-foreground font-medium" data-testid="text-first-name">
                  {profile.user.firstName || "-"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  data-testid="input-last-name"
                />
              ) : (
                <p className="text-foreground font-medium" data-testid="text-last-name">
                  {profile.user.lastName || "-"}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-foreground font-medium" data-testid="text-email">
                  {profile.user.email}
                </p>
                {profile.user.emailVerified && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="04XX XXX XXX"
                  data-testid="input-phone"
                />
              ) : (
                <p className="text-foreground font-medium" data-testid="text-phone">
                  {profile.user.phone || "-"}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Calendar className="h-4 w-4" />
            <span>
              Account created{" "}
              {profile.user.createdAt
                ? format(new Date(profile.user.createdAt), "d MMM yyyy")
                : "Unknown"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Team Membership
          </CardTitle>
          <CardDescription>
            {profile.isOwner ? "Your business information" : "The business you work for"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Business Name</Label>
              <p className="font-medium" data-testid="text-business-name">
                {profile.teamInfo?.businessName || "Not set"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Business Email</Label>
              <p className="font-medium" data-testid="text-business-email">
                {profile.teamInfo?.businessEmail || "-"}
              </p>
            </div>
          </div>

          {profile.isOwner && profile.teamInfo?.isBusinessOwner && (
            <div className="flex items-center gap-4 pt-2">
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <Crown className="h-3 w-3 mr-1" />
                Business Owner
              </Badge>
              {typeof profile.teamInfo.teamSize === 'number' && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {profile.teamInfo.teamSize} team member{profile.teamInfo.teamSize !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {profile.isTeamMember && profile.teamInfo?.joinedAt && (
            <p className="text-sm text-muted-foreground">
              Joined {format(new Date(profile.teamInfo.joinedAt), "d MMM yyyy")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
          <CardDescription>
            Your access level and what you can do in the app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge
              className={
                profile.isOwner
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-blue-100 text-blue-800"
              }
            >
              {profile.roleInfo?.roleName || "Unknown Role"}
            </Badge>
            {profile.roleInfo?.hasCustomPermissions && (
              <Badge variant="outline" className="text-xs">
                Custom Permissions
              </Badge>
            )}
          </div>

          {profile.roleInfo?.roleDescription && (
            <p className="text-sm text-muted-foreground">
              {profile.roleInfo.roleDescription}
            </p>
          )}

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">Your Permissions</h4>
            <div className="flex flex-wrap gap-2">
              {profile.permissions && profile.permissions.length > 0 ? (
                profile.permissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-xs">
                    {permissionLabels[perm] || perm}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No specific permissions assigned
                </p>
              )}
            </div>
          </div>

          {profile.isOwner && (
            <p className="text-xs text-muted-foreground mt-4">
              As the business owner, you have full access to all features.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
