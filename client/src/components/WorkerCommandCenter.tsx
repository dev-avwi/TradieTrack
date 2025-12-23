import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Briefcase,
  MessageSquare,
  User,
  Activity,
  Calendar,
  Battery,
  Navigation2,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  X,
  Timer,
  Shield,
  Car
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface WorkerCommandCenterProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandCenterData {
  member: {
    id: string;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profileImageUrl: string | null;
    themeColor: string | null;
    role: string;
    roleId: string;
    isActive: boolean;
    inviteStatus: string;
    hourlyRate: number | null;
    locationEnabledByOwner: boolean;
    locationEnabledByUser: boolean;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    lastUpdated: string | null;
    status: string;
    currentActivity: string | null;
    batteryLevel: number | null;
  } | null;
  stats: {
    todayHours: number;
    activeTimeEntry: any;
    totalAssignedJobs: number;
    activeJobs: number;
    completedJobs: number;
  };
  assignedJobs: Array<{
    id: string;
    title: string;
    status: string;
    address: string | null;
    scheduledDate: string | null;
    priority: string | null;
    clientId: string | null;
  }>;
  unassignedJobs: Array<{
    id: string;
    title: string;
    status: string;
    address: string | null;
    scheduledDate: string | null;
    priority: string | null;
    clientId: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string;
    createdAt: string;
    metadata: any;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500",
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  done: "bg-green-500",
  invoiced: "bg-purple-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Completed",
  invoiced: "Invoiced",
};

const ACTIVITY_ICONS: Record<string, any> = {
  working: Briefcase,
  driving: Car,
  idle: Clock,
  online: Activity,
  offline: AlertCircle,
};

function createWorkerMarkerIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${color || '#3B82F6'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function WorkerCommandCenter({ memberId, open, onOpenChange }: WorkerCommandCenterProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, error } = useQuery<CommandCenterData>({
    queryKey: ['/api/team/members', memberId, 'command-center'],
    queryFn: async () => {
      const response = await fetch(`/api/team/members/${memberId}/command-center`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch worker details');
      return response.json();
    },
    enabled: open && !!memberId,
    refetchInterval: 30000,
  });

  const assignJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('PATCH', `/api/jobs/${jobId}/assign`, {
        assignedTo: data?.member.memberId || memberId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members', memberId, 'command-center'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job assigned",
        description: `Job has been assigned to ${data?.member.firstName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message || "Couldn't assign the job",
        variant: "destructive",
      });
    },
  });

  const handleCall = () => {
    if (data?.member.phone) {
      window.location.href = `tel:${data.member.phone}`;
    }
  };

  const handleSMS = () => {
    if (data?.member.phone) {
      window.location.href = `sms:${data.member.phone}`;
    }
  };

  const handleEmail = () => {
    if (data?.member.email) {
      window.location.href = `mailto:${data.member.email}`;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'driving': return 'bg-blue-500';
      case 'idle': return 'bg-yellow-500';
      case 'online': return 'bg-green-400';
      default: return 'bg-gray-400';
    }
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden p-0" data-testid="sheet-worker-command-center">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Couldn't load worker details</p>
          </div>
        ) : data ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Header with Avatar and Quick Actions */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2" style={{ borderColor: data.member.themeColor || '#3B82F6' }}>
                      <AvatarImage src={data.member.profileImageUrl || undefined} />
                      <AvatarFallback style={{ backgroundColor: data.member.themeColor || '#3B82F6' }} className="text-white text-lg">
                        {getInitials(data.member.firstName, data.member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    {data.location && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getStatusColor(data.location.status)} border-2 border-background`} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" data-testid="text-worker-name">
                      {data.member.firstName} {data.member.lastName}
                    </h2>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>{data.member.role}</span>
                    </div>
                    {data.location?.currentActivity && (
                      <Badge variant="secondary" className="mt-1">
                        {data.location.currentActivity}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} data-testid="button-close-command-center">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCall}
                  disabled={!data.member.phone}
                  className="flex-1"
                  data-testid="button-call-worker"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSMS}
                  disabled={!data.member.phone}
                  className="flex-1"
                  data-testid="button-sms-worker"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  SMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmail}
                  className="flex-1"
                  data-testid="button-email-worker"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>

              {/* Mini Map */}
              {data.location?.latitude && data.location?.longitude && data.member.locationEnabledByOwner ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Live Location
                      {data.location.lastUpdated && (
                        <span className="text-xs text-muted-foreground font-normal ml-auto">
                          {formatDistanceToNow(new Date(data.location.lastUpdated), { addSuffix: true })}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="h-40 rounded-lg overflow-hidden" data-testid="map-worker-location">
                      <MapContainer
                        center={[data.location.latitude, data.location.longitude]}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        attributionControl={false}
                      >
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <Marker 
                          position={[data.location.latitude, data.location.longitude]}
                          icon={createWorkerMarkerIcon(data.member.themeColor || '#3B82F6')}
                        />
                      </MapContainer>
                    </div>
                    {data.location.batteryLevel !== null && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Battery className="h-4 w-4" />
                        <span>{data.location.batteryLevel}% battery</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : !data.member.locationEnabledByOwner ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Location tracking is disabled</p>
                  </CardContent>
                </Card>
              ) : null}

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold" data-testid="text-today-hours">{data.stats.todayHours}h</div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold" data-testid="text-active-jobs">{data.stats.activeJobs}</div>
                    <div className="text-xs text-muted-foreground">Active Jobs</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold" data-testid="text-completed-jobs">{data.stats.completedJobs}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Active Timer */}
              {data.stats.activeTimeEntry && (
                <Card className="border-green-500/50 bg-green-500/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Timer Running</p>
                      <p className="text-sm text-muted-foreground">
                        Started {formatDistanceToNow(new Date(data.stats.activeTimeEntry.startTime), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                      Active
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Tabs for Jobs and Activity */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    <Briefcase className="h-4 w-4 mr-1" />
                    Jobs ({data.stats.totalAssignedJobs})
                  </TabsTrigger>
                  <TabsTrigger value="schedule" data-testid="tab-schedule">
                    <Plus className="h-4 w-4 mr-1" />
                    Assign
                  </TabsTrigger>
                  <TabsTrigger value="activity" data-testid="tab-activity">
                    <Activity className="h-4 w-4 mr-1" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3 mt-4">
                  {data.assignedJobs.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No jobs assigned yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    data.assignedJobs.map((job) => (
                      <Card key={job.id} className="hover-elevate cursor-pointer" data-testid={`card-job-${job.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{job.title}</h4>
                                <Badge className={STATUS_COLORS[job.status] || 'bg-gray-500'} variant="secondary">
                                  {STATUS_LABELS[job.status] || job.status}
                                </Badge>
                              </div>
                              {job.address && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {job.address}
                                </p>
                              )}
                              {job.scheduledDate && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(job.scheduledDate), 'EEE d MMM, h:mm a')}
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" data-testid={`button-view-job-${job.id}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="schedule" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Quick-assign an unscheduled job to {data.member.firstName}
                  </p>
                  {data.unassignedJobs.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>All jobs are assigned</p>
                      </CardContent>
                    </Card>
                  ) : (
                    data.unassignedJobs.map((job) => (
                      <Card key={job.id} className="hover-elevate" data-testid={`card-unassigned-job-${job.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{job.title}</h4>
                              {job.address && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  {job.address}
                                </p>
                              )}
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => assignJobMutation.mutate(job.id)}
                              disabled={assignJobMutation.isPending}
                              data-testid={`button-assign-job-${job.id}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-3 mt-4">
                  {data.recentActivity.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent activity</p>
                      </CardContent>
                    </Card>
                  ) : (
                    data.recentActivity.map((activity) => (
                      <Card key={activity.id} data-testid={`card-activity-${activity.id}`}>
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{activity.description || `${activity.action} ${activity.entityType}`}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>

              {/* Contact Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{data.member.email}</span>
                  </div>
                  {data.member.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{data.member.phone}</span>
                    </div>
                  )}
                  {data.member.hourlyRate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>${data.member.hourlyRate}/hr</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
