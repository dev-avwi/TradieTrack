// Audit complete. No changes needed to this file.
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { formatDistanceToNow, format, addDays, isAfter, isBefore, parseISO } from "date-fns";
import {
  Users,
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  CreditCard,
  Send,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  Circle,
  Activity,
  Coffee,
  Wrench,
  X,
  Phone,
  Mail,
  Navigation,
  UserCheck,
  UserX,
  Plus,
  Settings,
  Shield,
  Key,
  Edit2,
  Save,
  Calendar,
  Award,
  TrendingUp,
  AlertTriangle,
  Star,
  BarChart3,
  UserPlus,
  Eye,
  CalendarDays,
  ClipboardCheck,
  Timer,
  DollarSign,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { TeamMember, UserRole, TeamMemberSkill, TeamMemberAvailability, TeamMemberTimeOff } from "@shared/schema";
import "leaflet/dist/leaflet.css";

interface TeamPresenceData {
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  lastSeenAt?: string;
  lastLocationLat?: number;
  lastLocationLng?: number;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  currentJob?: {
    id: string;
    title: string;
  };
}

interface TeamMemberData {
  id: string;
  memberId?: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  role?: string;
  roleName?: string;
  inviteStatus?: string;
  roleId?: string;
  hourlyRate?: string;
  customPermissions?: string[];
  useCustomPermissions?: boolean;
}

interface ActivityFeedItem {
  id: string;
  actorName?: string;
  actorUserId?: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  isImportant?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface JobData {
  id: string;
  title: string;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clientName?: string;
  assignedTo?: string;
  scheduledAt?: string;
}

interface MemberWithJobs extends TeamMemberData {
  assignedJobs: JobData[];
  presence?: TeamPresenceData;
  recentActivity: ActivityFeedItem[];
}

interface PermissionItem {
  key: string;
  label: string;
  category: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any; markerBg: string; markerText: string }> = {
  online: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: Circle, markerBg: "#22c55e", markerText: "#fff" },
  on_job: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: Wrench, markerBg: "#3b82f6", markerText: "#fff" },
  busy: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock, markerBg: "#f59e0b", markerText: "#fff" },
  break: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", icon: Coffee, markerBg: "#eab308", markerText: "#000" },
  offline: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", icon: Circle, markerBg: "#9ca3af", markerText: "#fff" },
};

function getStatusDisplay(status: string) {
  const config = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const statusLabels: Record<string, string> = {
    online: "Available",
    on_job: "On Job",
    busy: "Busy",
    break: "On Break",
    offline: "Offline",
  };
  return {
    ...config,
    label: statusLabels[status] || status,
  };
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function LiveOpsTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [statusBoardOpen, setStatusBoardOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  const [selectedMember, setSelectedMember] = useState<MemberWithJobs | null>(null);
  const [selectedMemberIdForMap, setSelectedMemberIdForMap] = useState<string | null>(null);
  const [assignJobDialogOpen, setAssignJobDialogOpen] = useState(false);
  const [selectedJobToAssign, setSelectedJobToAssign] = useState<string>("");

  const { data: presence = [], isLoading: presenceLoading } = useQuery<TeamPresenceData[]>({
    queryKey: ["/api/team/presence"],
    refetchInterval: 10000,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMemberData[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityFeedItem[]>({
    queryKey: ["/api/activity-feed", { limit: 30 }],
    refetchInterval: 10000,
  });

  const { data: allJobs = [] } = useQuery<JobData[]>({
    queryKey: ["/api/jobs"],
  });

  const acceptedMembers = useMemo(() => {
    return members.filter(m => m.inviteStatus === 'accepted');
  }, [members]);

  const jobs = useMemo(() => {
    return allJobs.filter((j) => j.status === "in_progress" || j.status === "scheduled");
  }, [allJobs]);

  const unassignedJobs = useMemo(() => {
    return allJobs.filter(j => !j.assignedTo && (j.status === "pending" || j.status === "scheduled"));
  }, [allJobs]);

  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      const response = await apiRequest('PATCH', `/api/jobs/${jobId}`, { assignedTo: userId });
      return response.json();
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/team/presence'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
      toast({ title: "Job assigned successfully" });
      setAssignJobDialogOpen(false);
      setSelectedJobToAssign("");
      // Refresh selected member to show the newly assigned job
      if (selectedMember) {
        const updatedJobs = await queryClient.fetchQuery({ queryKey: ['/api/jobs'] }) as JobData[];
        const assignedJobs = updatedJobs.filter((j: JobData) => j.assignedTo === selectedMember.userId);
        setSelectedMember({
          ...selectedMember,
          assignedJobs,
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign job", description: error.message, variant: "destructive" });
    },
  });

  const handleMemberClick = (member: TeamMemberData) => {
    const memberPresence = presence.find(p => p.userId === member.userId);
    const assignedJobs = allJobs.filter(j => j.assignedTo === member.userId);
    const memberActivity = activities.filter(a => a.actorUserId === member.userId);

    const memberWithJobs: MemberWithJobs = {
      ...member,
      assignedJobs,
      presence: memberPresence,
      recentActivity: memberActivity,
    };

    setSelectedMember(memberWithJobs);
    setSelectedMemberIdForMap(member.userId);
  };

  const onlineCount = useMemo(() => {
    return presence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  }, [presence]);

  const onJobCount = useMemo(() => {
    return presence.filter(p => p.status === 'on_job').length;
  }, [presence]);

  const isLoading = presenceLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 p-4 border-b">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{acceptedMembers.length}</p>
              <p className="text-xs text-muted-foreground truncate">Team Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
              <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 fill-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{onlineCount}</p>
              <p className="text-xs text-muted-foreground truncate">Online Now</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
              <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{onJobCount}</p>
              <p className="text-xs text-muted-foreground truncate">On Job</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg shrink-0">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{unassignedJobs.length}</p>
              <p className="text-xs text-muted-foreground truncate">Unassigned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Desktop: 2-column layout with Team Status + Map on left, Activity on right */}
        {/* Mobile: stacked layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left column: Team Status + Map */}
          <div className="space-y-4">
            <Collapsible open={statusBoardOpen} onOpenChange={setStatusBoardOpen}>
              <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate py-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Status
                    </CardTitle>
                    {statusBoardOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {acceptedMembers.map((member) => {
                        const memberPresence = presence.find(p => p.userId === member.userId);
                        const status = memberPresence?.status || 'offline';
                        const statusDisplay = getStatusDisplay(status);
                        const StatusIcon = statusDisplay.icon;

                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer"
                            onClick={() => handleMemberClick(member)}
                            data-testid={`member-status-${member.id}`}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profileImageUrl} />
                              <AvatarFallback>
                                {getInitials(member.firstName, member.lastName, member.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {member.firstName} {member.lastName}
                              </p>
                              <div className="flex items-center gap-1">
                                <StatusIcon className={`h-3 w-3 ${statusDisplay.text} ${status === 'online' || status === 'on_job' ? 'fill-current' : ''}`} />
                                <span className={`text-xs ${statusDisplay.text}`}>
                                  {statusDisplay.label}
                                </span>
                              </div>
                            </div>
                            {memberPresence?.currentJob && (
                              <Badge variant="secondary" className="text-xs truncate max-w-[100px]">
                                {memberPresence.currentJob.title}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                      {acceptedMembers.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No team members yet
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

            {/* Team Map - shows team member locations */}
            <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover-elevate py-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Team Map
                      </CardTitle>
                      {mapOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="h-[300px] rounded-lg overflow-hidden border" data-testid="team-map-container">
                      {presence.some(p => p.lastLocationLat && p.lastLocationLng) ? (
                        <MapContainer
                          center={(() => {
                            const withLocation = presence.find(p => p.lastLocationLat && p.lastLocationLng);
                            return withLocation 
                              ? [withLocation.lastLocationLat!, withLocation.lastLocationLng!] as [number, number]
                              : [-16.92, 145.77] as [number, number]; // Default to Cairns
                          })()}
                          zoom={13}
                          className="h-full w-full"
                          scrollWheelZoom={true}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          />
                          {presence.filter(p => p.lastLocationLat && p.lastLocationLng).map((p) => {
                            const member = acceptedMembers.find(m => m.userId === p.userId);
                            const statusDisplay = getStatusDisplay(p.status);
                            const initials = getInitials(member?.firstName, member?.lastName, member?.email);
                            return (
                              <Marker
                                key={p.userId}
                                position={[p.lastLocationLat!, p.lastLocationLng!]}
                                icon={L.divIcon({
                                  className: '',
                                  html: `<div style="
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    width: 40px;
                                    height: 40px;
                                    border-radius: 50%;
                                    background: ${statusDisplay.markerBg};
                                    border: 3px solid white;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                    font-family: system-ui, -apple-system, sans-serif;
                                  ">
                                    <span style="
                                      color: ${statusDisplay.markerText};
                                      font-size: 14px;
                                      font-weight: 700;
                                      letter-spacing: 0.5px;
                                    ">${initials}</span>
                                  </div>`,
                                  iconSize: [40, 40],
                                  iconAnchor: [20, 20],
                                })}
                              >
                                <Popup>
                                  <div style="font-size: 14px; min-width: 120px;">
                                    <p style="font-weight: 600; margin: 0 0 4px 0;">{member?.firstName} {member?.lastName}</p>
                                    <p style="color: #666; margin: 0;">{statusDisplay.label}</p>
                                    {p.statusMessage && (
                                      <p style="font-size: 12px; margin: 8px 0 0 0; color: #888;">{p.statusMessage}</p>
                                    )}
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MapContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-muted/50">
                          <div className="text-center text-muted-foreground">
                            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No location data available</p>
                            <p className="text-xs">Team members will appear here when they share their location</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Right column: Activity Feed */}
          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <Card className="h-full">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate py-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Recent Activity
                    </CardTitle>
                    {activityOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {activities.slice(0, 15).map((activity) => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-2 rounded-lg ${
                            activity.isImportant ? 'bg-primary/5' : ''
                          }`}
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className={`p-1.5 rounded-full ${
                              activity.activityType === 'job_completed' ? 'bg-green-100 dark:bg-green-900/30' :
                              activity.activityType === 'invoice_sent' ? 'bg-blue-100 dark:bg-blue-900/30' :
                              'bg-muted'
                            }`}>
                              {activity.activityType === 'job_completed' ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : activity.activityType === 'invoice_sent' ? (
                                <Send className="h-3 w-3 text-blue-600" />
                              ) : (
                                <Activity className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{activity.actorName || 'System'}</span>
                              {' '}
                              <span className="text-muted-foreground">{activity.description}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                      {activities.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No recent activity
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedMember && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedMember.profileImageUrl} />
                      <AvatarFallback className="text-lg">
                        {getInitials(selectedMember.firstName, selectedMember.lastName, selectedMember.email)}
                      </AvatarFallback>
                    </Avatar>
                    {selectedMember.presence && (
                      <div 
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background ${
                          selectedMember.presence.status === 'online' || selectedMember.presence.status === 'on_job' 
                            ? 'bg-green-500' 
                            : selectedMember.presence.status === 'busy' 
                              ? 'bg-amber-500' 
                              : 'bg-gray-400'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <SheetTitle>
                      {selectedMember.firstName} {selectedMember.lastName}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedMember.roleName && (
                        <Badge variant="secondary">{selectedMember.roleName}</Badge>
                      )}
                      {selectedMember.presence && (
                        <Badge variant="outline" className={getStatusDisplay(selectedMember.presence.status).text}>
                          {getStatusDisplay(selectedMember.presence.status).label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedMember.phone && (
                    <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-call-member">
                      <a href={`tel:${selectedMember.phone}`}>
                        <Phone className="h-5 w-5 mb-1" />
                        <span className="text-xs">Call</span>
                      </a>
                    </Button>
                  )}
                  {selectedMember.phone && (
                    <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-sms-member">
                      <a href={`sms:${selectedMember.phone}`}>
                        <MessageCircle className="h-5 w-5 mb-1" />
                        <span className="text-xs">Text</span>
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-email-member">
                    <a href={`mailto:${selectedMember.email}`}>
                      <Mail className="h-5 w-5 mb-1" />
                      <span className="text-xs">Email</span>
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-col h-auto py-3"
                    onClick={() => navigate(`/direct-messages?userId=${selectedMember.userId}`)}
                    data-testid="button-dm-member"
                  >
                    <Send className="h-5 w-5 mb-1" />
                    <span className="text-xs">Message</span>
                  </Button>
                </div>

                {/* Assign Job Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Assigned Jobs ({selectedMember.assignedJobs.length})</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAssignJobDialogOpen(true)}
                      disabled={unassignedJobs.length === 0}
                      data-testid="button-assign-job"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Assign Job
                    </Button>
                  </div>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-2">
                      {selectedMember.assignedJobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          data-testid={`member-job-${job.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{job.title}</p>
                            <Badge variant={job.status === 'in_progress' ? 'default' : 'secondary'}>
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {job.address && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.address}
                            </p>
                          )}
                          {job.scheduledAt && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(job.scheduledAt), 'EEE, d MMM h:mm a')}
                            </p>
                          )}
                        </div>
                      ))}
                      {selectedMember.assignedJobs.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No assigned jobs
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="font-medium mb-3">Recent Activity</h4>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-2 pr-3">
                      {selectedMember.recentActivity.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="text-sm p-3 rounded-lg border bg-muted/30">
                          <p className="text-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                      {selectedMember.recentActivity.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No recent activity
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign Job Dialog */}
      <Dialog open={assignJobDialogOpen} onOpenChange={setAssignJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job to {selectedMember?.firstName}</DialogTitle>
            <DialogDescription>
              Select a job to assign to this team member.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Job</Label>
            <Select value={selectedJobToAssign} onValueChange={setSelectedJobToAssign}>
              <SelectTrigger className="mt-2" data-testid="select-job-to-assign">
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    <div className="flex flex-col">
                      <span>{job.title}</span>
                      {job.clientName && (
                        <span className="text-xs text-muted-foreground">{job.clientName}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignJobDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember && selectedJobToAssign) {
                  assignJobMutation.mutate({
                    jobId: selectedJobToAssign,
                    userId: selectedMember.userId,
                  });
                }
              }}
              disabled={!selectedJobToAssign || assignJobMutation.isPending}
              data-testid="button-confirm-assign-job"
            >
              {assignJobMutation.isPending ? "Assigning..." : "Assign Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamAdminTab() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteHourlyRate, setInviteHourlyRate] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<TeamMemberData | null>(null);

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ['/api/team/roles'],
  });

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

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest('DELETE', `/api/team/members/${memberId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Member removed",
        description: "The team member has been removed.",
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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${memberId}`, { roleId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Role updated",
        description: "Team member's role has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
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
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      roleId: inviteRoleId,
      hourlyRate: inviteHourlyRate ? parseFloat(inviteHourlyRate) : undefined,
    });
  };

  const filteredMembers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers.filter((member) => {
      const matchesSearch = searchQuery === "" ||
        member.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || member.inviteStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [teamMembers, searchQuery, statusFilter]);

  const pendingCount = teamMembers?.filter(m => m.inviteStatus === 'pending').length || 0;
  const activeCount = teamMembers?.filter(m => m.inviteStatus === 'accepted').length || 0;

  if (membersLoading || rolesLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-1">
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-xs"
            data-testid="input-search-members"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({teamMembers?.length || 0})</SelectItem>
              <SelectItem value="accepted">Active ({activeCount})</SelectItem>
              <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setRolesDialogOpen(true)} data-testid="button-manage-roles">
            <Shield className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Manage Roles</span>
            <span className="sm:hidden">Roles</span>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-member">
            <UserPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Invite Member</span>
            <span className="sm:hidden">Invite</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredMembers.map((member) => {
          const role = roles?.find(r => r.id === member.roleId);
          return (
            <Card key={member.id} data-testid={`member-card-${member.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                      <AvatarImage src={member.profileImageUrl} />
                      <AvatarFallback>
                        {getInitials(member.firstName, member.lastName, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{role?.name || 'No Role'}</Badge>
                        <Badge variant={member.inviteStatus === 'accepted' ? 'default' : 'outline'} className="text-xs">
                          {member.inviteStatus === 'accepted' ? 'Active' : 'Pending'}
                        </Badge>
                        {member.hourlyRate && (
                          <Badge variant="outline" className="text-xs">${member.hourlyRate}/hr</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <Select
                      value={member.roleId || ""}
                      onValueChange={(value) => updateRoleMutation.mutate({ memberId: member.id, roleId: value })}
                    >
                      <SelectTrigger className="w-[120px] sm:w-[140px]" data-testid={`select-role-${member.id}`}>
                        <SelectValue placeholder="Change role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.filter(r => r.name !== 'OWNER').map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMemberToDelete(member)}
                      data-testid={`button-remove-${member.id}`}
                    >
                      <UserX className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'No team members match your filters'
                  : 'No team members yet. Invite your first team member!'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent data-testid="dialog-invite-member">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                  data-testid="input-invite-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Smith"
                  data-testid="input-invite-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.filter(r => r.name !== 'OWNER').map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate (optional)</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={inviteHourlyRate}
                onChange={(e) => setInviteHourlyRate(e.target.value)}
                placeholder="45.00"
                data-testid="input-invite-hourlyrate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending} data-testid="button-send-invite">
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-manage-roles">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              View and edit team roles and their permissions.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {roles?.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg" data-testid={`role-${role.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">{role.name}</h4>
                    {role.name === 'OWNER' && (
                      <Badge variant="secondary" className="text-xs">System</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {role.description || 'No description'}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent data-testid="dialog-confirm-remove">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToDelete?.firstName} {memberToDelete?.lastName}</strong> from your team? 
              This action cannot be undone and they will lose access to your business.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToDelete) {
                  removeMemberMutation.mutate(memberToDelete.id);
                  setMemberToDelete(null);
                }
              }}
              data-testid="button-confirm-remove"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SchedulingTab() {
  const { toast } = useToast();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("annual_leave");
  const [timeOffNotes, setTimeOffNotes] = useState("");

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: availability = [] } = useQuery<TeamMemberAvailability[]>({
    queryKey: ['/api/team/availability', selectedMember],
    enabled: !!selectedMember,
  });

  const { data: timeOff = [] } = useQuery<TeamMemberTimeOff[]>({
    queryKey: ['/api/team/time-off'],
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: { teamMemberId: string; dayOfWeek: number; isAvailable: boolean; startTime?: string; endTime?: string }) => {
      const response = await apiRequest('POST', '/api/team/availability', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/availability'] });
      toast({ title: "Availability updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const requestTimeOffMutation = useMutation({
    mutationFn: async (data: { teamMemberId: string; startDate: string; endDate: string; reason: string; notes?: string }) => {
      const response = await apiRequest('POST', '/api/team/time-off', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/time-off'] });
      toast({ title: "Time off requested" });
      setTimeOffDialogOpen(false);
      setTimeOffStart("");
      setTimeOffEnd("");
      setTimeOffReason("annual_leave");
      setTimeOffNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to request time off", description: error.message, variant: "destructive" });
    },
  });

  const approveTimeOffMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const response = await apiRequest('PATCH', `/api/team/time-off/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/time-off'] });
      toast({ title: "Time off updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');
  const selectedMemberData = acceptedMembers.find(m => m.id === selectedMember);

  const pendingTimeOff = timeOff.filter(t => t.status === 'pending');
  const upcomingTimeOff = timeOff.filter(t => 
    t.status === 'approved' && isAfter(new Date(t.startDate), new Date())
  );

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
                Weekly Availability
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Set standard working hours for each team member</CardDescription>
            </div>
            <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-member-availability">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {acceptedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              <div className="space-y-3">
                {DAY_NAMES.map((day, index) => {
                  const dayAvailability = availability.find(a => a.dayOfWeek === index);
                  const isAvailable = dayAvailability?.isAvailable ?? (index > 0 && index < 6);
                  const startTime = dayAvailability?.startTime || '08:00';
                  const endTime = dayAvailability?.endTime || '17:00';

                  return (
                    <div
                      key={day}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 border rounded-lg"
                      data-testid={`availability-${index}`}
                    >
                      <div className="flex items-center gap-3 sm:w-32">
                        <Switch
                          checked={isAvailable}
                          onCheckedChange={(checked) => {
                            updateAvailabilityMutation.mutate({
                              teamMemberId: selectedMember,
                              dayOfWeek: index,
                              isAvailable: checked,
                            });
                          }}
                          data-testid={`switch-available-${index}`}
                        />
                        <span className={`font-medium text-sm sm:text-base ${!isAvailable ? 'text-muted-foreground' : ''}`}>
                          {day}
                        </span>
                      </div>
                      {isAvailable && (
                        <div className="flex items-center gap-2 ml-8 sm:ml-0">
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => {
                              updateAvailabilityMutation.mutate({
                                teamMemberId: selectedMember,
                                dayOfWeek: index,
                                isAvailable: true,
                                startTime: e.target.value,
                                endTime,
                              });
                            }}
                            className="w-24 sm:w-32"
                            data-testid={`input-start-${index}`}
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => {
                              updateAvailabilityMutation.mutate({
                                teamMemberId: selectedMember,
                                dayOfWeek: index,
                                isAvailable: true,
                                startTime,
                                endTime: e.target.value,
                              });
                            }}
                            className="w-24 sm:w-32"
                            data-testid={`input-end-${index}`}
                          />
                        </div>
                      )}
                      {!isAvailable && (
                        <span className="text-sm text-muted-foreground">Not available</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a team member to view and edit their availability</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Time Off Requests</CardTitle>
              <Button size="sm" onClick={() => setTimeOffDialogOpen(true)} data-testid="button-request-timeoff">
                <Plus className="h-4 w-4 mr-1" />
                Request
              </Button>
            </CardHeader>
            <CardContent>
              {pendingTimeOff.length > 0 ? (
                <div className="space-y-3">
                  {pendingTimeOff.map((request) => {
                    const member = teamMembers.find(m => m.id === request.teamMemberId);
                    return (
                      <div
                        key={request.id}
                        className="p-3 border rounded-lg space-y-2"
                        data-testid={`timeoff-${request.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">
                            {member?.firstName} {member?.lastName}
                          </p>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs capitalize">{request.reason.replace('_', ' ')}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={() => approveTimeOffMutation.mutate({ id: request.id, status: 'approved' })}
                            data-testid={`button-approve-${request.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => approveTimeOffMutation.mutate({ id: request.id, status: 'rejected' })}
                            data-testid={`button-reject-${request.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending requests
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Time Off</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTimeOff.length > 0 ? (
                <div className="space-y-2">
                  {upcomingTimeOff.slice(0, 5).map((leave) => {
                    const member = teamMembers.find(m => m.id === leave.teamMemberId);
                    return (
                      <div key={leave.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{member?.firstName} {member?.lastName}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(leave.startDate), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming time off
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
        <DialogContent data-testid="dialog-request-timeoff">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>Submit a time off request for a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
                <SelectTrigger data-testid="select-timeoff-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={timeOffStart}
                  onChange={(e) => setTimeOffStart(e.target.value)}
                  data-testid="input-timeoff-start"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={timeOffEnd}
                  onChange={(e) => setTimeOffEnd(e.target.value)}
                  data-testid="input-timeoff-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={timeOffReason} onValueChange={setTimeOffReason}>
                <SelectTrigger data-testid="select-timeoff-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="public_holiday">Public Holiday</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={timeOffNotes}
                onChange={(e) => setTimeOffNotes(e.target.value)}
                placeholder="Additional details..."
                data-testid="input-timeoff-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedMember && timeOffStart && timeOffEnd) {
                  requestTimeOffMutation.mutate({
                    teamMemberId: selectedMember,
                    startDate: timeOffStart,
                    endDate: timeOffEnd,
                    reason: timeOffReason,
                    notes: timeOffNotes || undefined,
                  });
                }
              }}
              disabled={requestTimeOffMutation.isPending || !selectedMember || !timeOffStart || !timeOffEnd}
              data-testid="button-submit-timeoff"
            >
              {requestTimeOffMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillsTab() {
  const { toast } = useToast();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [addSkillDialogOpen, setAddSkillDialogOpen] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillType, setSkillType] = useState("certification");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [skillNotes, setSkillNotes] = useState("");

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: skills = [] } = useQuery<TeamMemberSkill[]>({
    queryKey: ['/api/team/skills'],
  });

  const addSkillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/team/skills', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill added successfully" });
      setAddSkillDialogOpen(false);
      resetSkillForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to add skill", description: error.message, variant: "destructive" });
    },
  });

  const verifySkillMutation = useMutation({
    mutationFn: async ({ id, isVerified }: { id: string; isVerified: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team/skills/${id}`, { isVerified });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill verification updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/team/skills/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const resetSkillForm = () => {
    setSkillName("");
    setSkillType("certification");
    setLicenseNumber("");
    setIssueDate("");
    setExpiryDate("");
    setSkillNotes("");
  };

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');

  const expiringSkills = skills.filter(s => {
    if (!s.expiryDate) return false;
    const expiry = new Date(s.expiryDate);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    return isBefore(expiry, thirtyDaysFromNow) && isAfter(expiry, new Date());
  });

  const expiredSkills = skills.filter(s => {
    if (!s.expiryDate) return false;
    return isBefore(new Date(s.expiryDate), new Date());
  });

  const memberSkills = selectedMember ? skills.filter(s => s.teamMemberId === selectedMember) : [];

  const COMMON_SKILLS = [
    "White Card (Construction Induction)",
    "Electrical License",
    "Plumbing License",
    "Gas Fitting License",
    "First Aid Certificate",
    "Working at Heights",
    "Confined Space Entry",
    "Forklift License",
    "EWP License",
    "Asbestos Awareness",
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 sm:h-5 sm:w-5" />
            Skills & Certifications
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Track qualifications, licenses, and training for your team</p>
        </div>
        <Button size="sm" onClick={() => setAddSkillDialogOpen(true)} data-testid="button-add-skill">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Skill</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {(expiringSkills.length > 0 || expiredSkills.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredSkills.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Expired ({expiredSkills.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {expiredSkills.slice(0, 3).map((skill) => {
                    const member = teamMembers.find(m => m.id === skill.teamMemberId);
                    return (
                      <div key={skill.id} className="flex items-center justify-between text-sm">
                        <span>{member?.firstName} - {skill.skillName}</span>
                        <span className="text-destructive text-xs">
                          Expired {format(new Date(skill.expiryDate!), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {expiringSkills.length > 0 && (
            <Card className="border-yellow-500">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  Expiring Soon ({expiringSkills.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {expiringSkills.slice(0, 3).map((skill) => {
                    const member = teamMembers.find(m => m.id === skill.teamMemberId);
                    return (
                      <div key={skill.id} className="flex items-center justify-between text-sm">
                        <span>{member?.firstName} - {skill.skillName}</span>
                        <span className="text-yellow-600 text-xs">
                          Expires {format(new Date(skill.expiryDate!), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
            <CardTitle className="text-sm sm:text-base">Team Member Skills</CardTitle>
            <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-member-skills">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {acceptedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              memberSkills.length > 0 ? (
                <div className="space-y-3">
                  {memberSkills.map((skill) => {
                    const isExpired = skill.expiryDate && isBefore(new Date(skill.expiryDate), new Date());
                    const isExpiring = skill.expiryDate && !isExpired && isBefore(new Date(skill.expiryDate), addDays(new Date(), 30));

                    return (
                      <div
                        key={skill.id}
                        className={`p-4 border rounded-lg ${isExpired ? 'border-destructive bg-destructive/5' : isExpiring ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                        data-testid={`skill-${skill.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{skill.skillName}</h4>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {skill.skillType}
                              </Badge>
                              {skill.isVerified && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            {skill.licenseNumber && (
                              <p className="text-sm text-muted-foreground mt-1">
                                License: {skill.licenseNumber}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {skill.issueDate && (
                                <span>Issued: {format(new Date(skill.issueDate), 'MMM d, yyyy')}</span>
                              )}
                              {skill.expiryDate && (
                                <span className={isExpired ? 'text-destructive' : isExpiring ? 'text-yellow-600' : ''}>
                                  {isExpired ? 'Expired' : 'Expires'}: {format(new Date(skill.expiryDate), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!skill.isVerified && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => verifySkillMutation.mutate({ id: skill.id, isVerified: true })}
                                data-testid={`button-verify-${skill.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteSkillMutation.mutate(skill.id)}
                              data-testid={`button-delete-${skill.id}`}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No skills recorded for this team member</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setAddSkillDialogOpen(true)}
                  >
                    Add First Skill
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a team member to view their skills and certifications</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Compliance</CardTitle>
            <CardDescription>Overview of team qualifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COMMON_SKILLS.slice(0, 5).map((skillName) => {
              const membersWithSkill = skills.filter(s => s.skillName === skillName && s.isVerified);
              const percentage = acceptedMembers.length > 0
                ? Math.round((membersWithSkill.length / acceptedMembers.length) * 100)
                : 0;

              return (
                <div key={skillName} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{skillName}</span>
                    <span className="text-muted-foreground">{membersWithSkill.length}/{acceptedMembers.length}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addSkillDialogOpen} onOpenChange={setAddSkillDialogOpen}>
        <DialogContent data-testid="dialog-add-skill">
          <DialogHeader>
            <DialogTitle>Add Skill or Certification</DialogTitle>
            <DialogDescription>Record a qualification for a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
                <SelectTrigger data-testid="select-skill-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skill/Certification</Label>
              <Select value={skillName} onValueChange={setSkillName}>
                <SelectTrigger data-testid="select-skill-name">
                  <SelectValue placeholder="Select or type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SKILLS.map((skill) => (
                    <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={skillType} onValueChange={setSkillType}>
                <SelectTrigger data-testid="select-skill-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="license">License</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="skill">Skill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>License/Certificate Number (optional)</Label>
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="ABC123456"
                data-testid="input-license-number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  data-testid="input-issue-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  data-testid="input-expiry-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={skillNotes}
                onChange={(e) => setSkillNotes(e.target.value)}
                placeholder="Additional details..."
                data-testid="input-skill-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSkillDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedMember && skillName) {
                  addSkillMutation.mutate({
                    teamMemberId: selectedMember,
                    skillName,
                    skillType,
                    licenseNumber: licenseNumber || undefined,
                    issueDate: issueDate || undefined,
                    expiryDate: expiryDate || undefined,
                    notes: skillNotes || undefined,
                  });
                }
              }}
              disabled={addSkillMutation.isPending || !selectedMember || !skillName}
              data-testid="button-submit-skill"
            >
              {addSkillMutation.isPending ? "Adding..." : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerformanceTab() {
  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: jobs = [] } = useQuery<JobData[]>({
    queryKey: ['/api/jobs'],
  });

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');

  const memberStats = useMemo(() => {
    return acceptedMembers.map((member) => {
      const memberJobs = jobs.filter(j => j.assignedTo === member.userId);
      const completedJobs = memberJobs.filter(j => j.status === 'completed');
      const inProgressJobs = memberJobs.filter(j => j.status === 'in_progress');
      const scheduledJobs = memberJobs.filter(j => j.status === 'scheduled');

      return {
        ...member,
        totalJobs: memberJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        scheduledJobs: scheduledJobs.length,
        completionRate: memberJobs.length > 0
          ? Math.round((completedJobs.length / memberJobs.length) * 100)
          : 0,
      };
    }).sort((a, b) => b.completedJobs - a.completedJobs);
  }, [acceptedMembers, jobs]);

  const totalCompleted = memberStats.reduce((sum, m) => sum + m.completedJobs, 0);
  const totalInProgress = memberStats.reduce((sum, m) => sum + m.inProgressJobs, 0);
  const avgCompletionRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.completionRate, 0) / memberStats.length)
    : 0;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          Team Performance
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Track productivity and job completion metrics</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{totalCompleted}</p>
              <p className="text-xs text-muted-foreground truncate">Jobs Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
              <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{totalInProgress}</p>
              <p className="text-xs text-muted-foreground truncate">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{avgCompletionRate}%</p>
              <p className="text-xs text-muted-foreground truncate">Avg Completion</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg shrink-0">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">-</p>
              <p className="text-xs text-muted-foreground truncate">Avg Rating</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm sm:text-base">Individual Performance</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Job completion metrics by team member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {memberStats.map((member, index) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg"
                data-testid={`performance-${member.id}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted text-xs sm:text-sm font-medium shrink-0">
                    {index + 1}
                  </div>
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                    <AvatarImage src={member.profileImageUrl} />
                    <AvatarFallback className="text-xs sm:text-sm">
                      {getInitials(member.firstName, member.lastName, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <p className="font-medium text-sm sm:text-base truncate">{member.firstName} {member.lastName}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                      <span>{member.completedJobs} done</span>
                      <span>{member.inProgressJobs} active</span>
                      <span className="hidden sm:inline">{member.scheduledJobs} scheduled</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto pl-9 sm:pl-0">
                  <Progress value={member.completionRate} className="flex-1 sm:w-24 h-2" />
                  <span className="text-xs sm:text-sm font-medium w-10 sm:w-12 text-right">{member.completionRate}%</span>
                </div>
              </div>
            ))}

            {memberStats.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members to display performance for</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamOperations() {
  const { isOwner, isManager } = useAppMode();
  const canManageTeam = isOwner || isManager;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border-b bg-background">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate">Team Operations</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your team, schedules, and performance</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/team/presence"] });
            queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
            queryClient.invalidateQueries({ queryKey: ["/api/activity-feed"] });
          }}
          data-testid="button-refresh-all"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <Tabs defaultValue="live" className="flex-1 flex flex-col">
        <div className="border-b px-2 sm:px-4 overflow-x-auto">
          <TabsList className="h-10 sm:h-12">
            <TabsTrigger value="live" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-live-ops">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Live Ops</span>
              <span className="sm:hidden">Live</span>
            </TabsTrigger>
            {canManageTeam && (
              <TabsTrigger value="admin" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-team-admin">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Team Admin</span>
                <span className="sm:hidden">Admin</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="scheduling" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-scheduling">
              <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Scheduling</span>
              <span className="sm:hidden">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-performance">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="flex-1 m-0">
          <LiveOpsTab />
        </TabsContent>

        {canManageTeam && (
          <TabsContent value="admin" className="flex-1 m-0">
            <TeamAdminTab />
          </TabsContent>
        )}

        <TabsContent value="scheduling" className="flex-1 m-0">
          <SchedulingTab />
        </TabsContent>

        <TabsContent value="performance" className="flex-1 m-0">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
