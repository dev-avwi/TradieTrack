import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDistanceToNow } from "date-fns";
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
  Plus,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  role?: string;
  roleName?: string;
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

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof Circle }> = {
  online: { color: "#22C55E", label: "Online", icon: Circle },
  busy: { color: "#EAB308", label: "Busy", icon: Circle },
  on_job: { color: "#3B82F6", label: "On Job", icon: Wrench },
  break: { color: "#F97316", label: "On Break", icon: Coffee },
  offline: { color: "#6B7280", label: "Offline", icon: Circle },
};

const ACTIVITY_ICONS: Record<string, typeof CheckCircle2> = {
  job_started: Briefcase,
  job_completed: CheckCircle2,
  check_in: MapPin,
  check_out: MapPin,
  quote_sent: FileText,
  invoice_sent: Send,
  invoice_paid: CreditCard,
  message_sent: MessageCircle,
  client_added: Users,
};

const ACTIVITY_COLORS: Record<string, { bg: string; icon: string }> = {
  job_started: { bg: "hsl(35 90% 55% / 0.1)", icon: "hsl(35 90% 55%)" },
  job_completed: { bg: "hsl(145 65% 45% / 0.1)", icon: "hsl(145 65% 45%)" },
  check_in: { bg: "hsl(210 80% 52% / 0.1)", icon: "hsl(210 80% 52%)" },
  check_out: { bg: "hsl(280 65% 60% / 0.1)", icon: "hsl(280 65% 60%)" },
  quote_sent: { bg: "hsl(35 90% 55% / 0.1)", icon: "hsl(35 90% 55%)" },
  invoice_sent: { bg: "hsl(5 85% 55% / 0.1)", icon: "hsl(5 85% 55%)" },
  invoice_paid: { bg: "hsl(145 65% 45% / 0.1)", icon: "hsl(145 65% 45%)" },
  message_sent: { bg: "hsl(280 65% 60% / 0.1)", icon: "hsl(280 65% 60%)" },
  client_added: { bg: "hsl(210 80% 52% / 0.1)", icon: "hsl(210 80% 52%)" },
};

function createTeamMemberMarker(
  name: string,
  profileImageUrl: string | undefined,
  status: string,
  isDark: boolean
) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const statusColor = STATUS_CONFIG[status]?.color || STATUS_CONFIG.offline.color;
  const borderColor = isDark ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,1)";
  const shadowColor = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.25)";

  const avatarContent = profileImageUrl
    ? `background-image: url('${profileImageUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%);`;

  return L.divIcon({
    className: "custom-team-marker",
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <div style="
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid ${statusColor};
          box-shadow: 0 4px 16px ${shadowColor};
          ${avatarContent}
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">
          ${!profileImageUrl ? initials : ""}
        </div>
        <div style="
          position: absolute;
          bottom: 0;
          right: 0;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${statusColor};
          border: 2px solid ${borderColor};
        "></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

function createJobMarker(status: string, isDark: boolean) {
  const color = status === "in_progress" ? "#F59E0B" : "#3B82F6";
  const borderColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,1)";

  return L.divIcon({
    className: "custom-job-marker",
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 2px solid ${borderColor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg style="transform: rotate(45deg); width: 14px; height: 14px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function FitBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current || points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    hasFittedRef.current = true;
  }, [map, points]);

  return null;
}

function TeamStatusBoard({
  presence,
  members,
  isLoading,
  onMessageClick,
  onMemberClick,
}: {
  presence: TeamPresenceData[];
  members: TeamMemberData[];
  isLoading: boolean;
  onMessageClick: (userId: string) => void;
  onMemberClick?: (member: TeamMemberData) => void;
}) {
  const sortedMembers = useMemo(() => {
    const memberPresenceMap = new Map(presence.map((p) => [p.userId, p]));

    return [...members].sort((a, b) => {
      const aPresence = memberPresenceMap.get(a.userId);
      const bPresence = memberPresenceMap.get(b.userId);
      const aStatus = aPresence?.status || "offline";
      const bStatus = bPresence?.status || "offline";

      const statusOrder = ["online", "on_job", "busy", "break", "offline"];
      const aOrder = statusOrder.indexOf(aStatus);
      const bOrder = statusOrder.indexOf(bStatus);

      if (aOrder !== bOrder) return aOrder - bOrder;

      return (a.roleName || "").localeCompare(b.roleName || "");
    });
  }, [members, presence]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">No team members yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="team-status-board">
      {sortedMembers.map((member) => {
        const memberPresence = presence.find((p) => p.userId === member.userId);
        const status = memberPresence?.status || "offline";
        const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
        const fullName = `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Team Member";

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
            onClick={() => onMemberClick?.(member)}
            data-testid={`team-member-${member.id}`}
          >
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.profileImageUrl || undefined} alt={fullName} />
                <AvatarFallback className="text-sm">
                  {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card"
                style={{ backgroundColor: statusConfig.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{fullName}</span>
                {member.roleName && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                    {member.roleName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {memberPresence?.currentJob ? (
                  <>Working on: {memberPresence.currentJob.title}</>
                ) : memberPresence?.statusMessage ? (
                  memberPresence.statusMessage
                ) : status === "offline" && memberPresence?.lastSeenAt ? (
                  <>Last seen {formatDistanceToNow(new Date(memberPresence.lastSeenAt), { addSuffix: true })}</>
                ) : (
                  statusConfig.label
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMessageClick(member.userId)}
              data-testid={`button-message-${member.id}`}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ActivityTimeline({
  activities,
  isLoading,
}: {
  activities: ActivityFeedItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="activity-timeline">
      <div className="absolute left-[22px] top-6 bottom-4 w-px bg-gradient-to-b from-border to-transparent" />
      <div className="space-y-1">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICONS[activity.activityType] || Briefcase;
          const colors = ACTIVITY_COLORS[activity.activityType] || {
            bg: "hsl(var(--muted) / 0.5)",
            icon: "hsl(var(--muted-foreground))",
          };

          return (
            <div
              key={activity.id}
              className={`relative flex items-start gap-3 p-3 rounded-lg ${activity.isImportant ? "bg-primary/5" : ""}`}
              data-testid={`activity-item-${activity.id}`}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10"
                style={{ backgroundColor: colors.bg }}
              >
                <Icon className="h-4 w-4" style={{ color: colors.icon }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium truncate">
                  {activity.actorName || "Team Member"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description || activity.entityTitle || activity.activityType.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </p>
              </div>
              {activity.isImportant && (
                <Badge variant="secondary" className="text-[10px] py-0 shrink-0">
                  Important
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberDetailsPanel({
  member,
  onClose,
  onMessageClick,
  onNavigate,
  onAssignJob,
  unassignedJobs,
}: {
  member: MemberWithJobs | null;
  onClose: () => void;
  onMessageClick: (userId: string) => void;
  onNavigate: (path: string) => void;
  onAssignJob: (jobId: string, userId: string) => void;
  unassignedJobs: JobData[];
}) {
  if (!member) return null;

  const fullName = `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Team Member";
  const status = member.presence?.status || "offline";
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const hasLocation = member.presence?.lastLocationLat && member.presence?.lastLocationLng;

  const getJobStatusColor = (jobStatus: string) => {
    switch (jobStatus) {
      case "in_progress": return "hsl(35 90% 55%)";
      case "scheduled": return "hsl(210 80% 52%)";
      case "completed": return "hsl(145 65% 45%)";
      default: return "hsl(var(--muted-foreground))";
    }
  };

  return (
    <Sheet open={!!member} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" data-testid="member-details-panel">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={member.profileImageUrl || undefined} alt={fullName} />
                <AvatarFallback className="text-xl">
                  {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background"
                style={{ backgroundColor: statusConfig.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate">{fullName}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {member.roleName || "Team Member"}
                </Badge>
                <span 
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-2">
                {member.phone && (
                  <a href={`tel:${member.phone}`} className="block">
                    <Button
                      variant="outline"
                      className="w-full flex flex-col items-center gap-1 h-auto py-3"
                      data-testid="button-call-member"
                    >
                      <Phone className="h-5 w-5 text-green-600" />
                      <span className="text-xs">Call</span>
                    </Button>
                  </a>
                )}
                {member.email && (
                  <a href={`mailto:${member.email}`} className="block">
                    <Button
                      variant="outline"
                      className="w-full flex flex-col items-center gap-1 h-auto py-3"
                      data-testid="button-email-member"
                    >
                      <Mail className="h-5 w-5 text-blue-600" />
                      <span className="text-xs">Email</span>
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  className="w-full flex flex-col items-center gap-1 h-auto py-3"
                  onClick={() => onMessageClick(member.userId)}
                  data-testid="button-message-member"
                >
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span className="text-xs">Message</span>
                </Button>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Contact Details</h3>
              {member.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              {hasLocation && (
                <div className="flex items-center gap-3 text-sm">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Last seen: {member.presence?.lastSeenAt 
                      ? formatDistanceToNow(new Date(member.presence.lastSeenAt), { addSuffix: true })
                      : "Recently"}
                  </span>
                </div>
              )}
            </div>

            {/* Current Job */}
            {member.presence?.currentJob && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Currently Working On</h3>
                <div 
                  className="p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover-elevate"
                  onClick={() => onNavigate(`/jobs/${member.presence?.currentJob?.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{member.presence.currentJob.title}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Assigned Jobs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Assigned Jobs</h3>
                <Badge variant="outline">{member.assignedJobs.length}</Badge>
              </div>
              {member.assignedJobs.length > 0 ? (
                <div className="space-y-2">
                  {member.assignedJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover-elevate"
                      onClick={() => onNavigate(`/jobs/${job.id}`)}
                      data-testid={`member-job-${job.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          {job.clientName && (
                            <p className="text-xs text-muted-foreground truncate">{job.clientName}</p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="secondary"
                        className="shrink-0 text-xs"
                        style={{ color: getJobStatusColor(job.status) }}
                      >
                        {job.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                  {member.assignedJobs.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => onNavigate(`/jobs?assignedTo=${member.userId}`)}
                    >
                      View all {member.assignedJobs.length} jobs
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No assigned jobs</p>
              )}
            </div>

            {/* Quick Assign Job */}
            {unassignedJobs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Quick Assign Job</h3>
                <div className="space-y-2">
                  {unassignedJobs.slice(0, 3).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-dashed cursor-pointer hover-elevate"
                      onClick={() => onAssignJob(job.id, member.userId)}
                      data-testid={`quick-assign-${job.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{job.title}</p>
                          {job.address && (
                            <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0">
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {member.recentActivity.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Recent Activity</h3>
                <div className="space-y-2">
                  {member.recentActivity.slice(0, 5).map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.activityType] || Briefcase;
                    const colors = ACTIVITY_COLORS[activity.activityType] || {
                      bg: "hsl(var(--muted) / 0.5)",
                      icon: "hsl(var(--muted-foreground))",
                    };
                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: colors.icon }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate">
                            {activity.description || activity.entityTitle || activity.activityType.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t shrink-0 space-y-2">
          <Button className="w-full" onClick={() => onMessageClick(member.userId)} data-testid="button-send-message-member">
            <MessageCircle className="h-4 w-4 mr-2" />
            Send Message
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onNavigate(`/jobs?assignedTo=${member.userId}`)}>
            <Briefcase className="h-4 w-4 mr-2" />
            View All Jobs
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TeamMap({
  presence,
  members,
  jobs,
  onMessageClick,
  onMemberClick,
  selectedMemberId,
  onAssignJob,
}: {
  presence: TeamPresenceData[];
  members: TeamMemberData[];
  jobs: JobData[];
  onMessageClick: (userId: string) => void;
  onMemberClick?: (member: TeamMemberData) => void;
  selectedMemberId?: string | null;
  onAssignJob?: (jobId: string, userId: string) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const mapPoints = useMemo(() => {
    const points: [number, number][] = [];

    presence.forEach((p) => {
      if (p.lastLocationLat && p.lastLocationLng) {
        points.push([p.lastLocationLat, p.lastLocationLng]);
      }
    });

    jobs.forEach((job) => {
      if (job.latitude && job.longitude) {
        points.push([Number(job.latitude), Number(job.longitude)]);
      }
    });

    return points;
  }, [presence, jobs]);

  const center = useMemo(() => {
    if (mapPoints.length === 0) return [-33.8688, 151.2093] as [number, number];

    const avgLat = mapPoints.reduce((sum, p) => sum + p[0], 0) / mapPoints.length;
    const avgLng = mapPoints.reduce((sum, p) => sum + p[1], 0) / mapPoints.length;
    return [avgLat, avgLng] as [number, number];
  }, [mapPoints]);

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="h-full w-full rounded-lg overflow-hidden" data-testid="team-map">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer url={tileUrl} />
        <FitBoundsController points={mapPoints} />

        {presence.map((p, index) => {
          if (!p.lastLocationLat || !p.lastLocationLng) return null;
          if (!p.userId) return null;

          const member = members.find((m) => m.userId === p.userId);
          const fullName = member
            ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Team Member"
            : "Team Member";
          const status = p.status || "offline";
          const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

          return (
            <Marker
              key={p.userId || `presence-${index}`}
              position={[p.lastLocationLat, p.lastLocationLng]}
              icon={createTeamMemberMarker(fullName, member?.profileImageUrl, status, isDark)}
            >
              <Popup>
                <div className="min-w-[200px] p-2">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member?.profileImageUrl || undefined} alt={fullName} />
                      <AvatarFallback>
                        {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{fullName}</p>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: statusConfig.color }}
                        />
                        <span className="text-xs text-muted-foreground">{statusConfig.label}</span>
                      </div>
                    </div>
                  </div>
                  {p.currentJob && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Working on: {p.currentJob.title}
                    </p>
                  )}
                  <div className="space-y-2">
                    {member && onMemberClick && (
                      <Button
                        size="sm"
                        variant={selectedMemberId === member.userId ? "default" : "outline"}
                        className="w-full"
                        onClick={() => onMemberClick(member)}
                        data-testid={`button-map-select-${p.userId}`}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        {selectedMemberId === member.userId ? "Selected" : "Select for Jobs"}
                      </Button>
                    )}
                    <div className="grid grid-cols-3 gap-1">
                      {member?.phone && (
                        <a href={`tel:${member.phone}`}>
                          <Button size="sm" variant="ghost" className="w-full" data-testid={`button-map-call-${p.userId}`}>
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      {member?.email && (
                        <a href={`mailto:${member.email}`}>
                          <Button size="sm" variant="ghost" className="w-full" data-testid={`button-map-email-${p.userId}`}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => onMessageClick(p.userId)}
                        data-testid={`button-map-message-${p.userId}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {jobs.map((job) => {
          if (!job.latitude || !job.longitude) return null;

          const isUnassigned = !job.assignedTo;
          const isHighlighted = selectedMemberId && isUnassigned;
          const selectedMember = selectedMemberId ? members.find(m => m.userId === selectedMemberId) : null;
          const selectedMemberName = selectedMember 
            ? `${selectedMember.firstName || ""} ${selectedMember.lastName || ""}`.trim() || selectedMember.email 
            : "";

          return (
            <Marker
              key={job.id}
              position={[Number(job.latitude), Number(job.longitude)]}
              icon={createJobMarker(job.status, isDark)}
            >
              <Popup>
                <div className="min-w-[200px] p-2">
                  <p className="font-medium text-sm mb-1">{job.title}</p>
                  {job.clientName && (
                    <p className="text-xs text-muted-foreground mb-1">{job.clientName}</p>
                  )}
                  {job.address && (
                    <p className="text-xs text-muted-foreground mb-2">{job.address}</p>
                  )}
                  {isHighlighted && selectedMemberId && onAssignJob && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => onAssignJob(job.id, selectedMemberId)}
                      data-testid={`button-map-assign-${job.id}`}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Assign to {selectedMemberName}
                    </Button>
                  )}
                  {!isUnassigned && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Already assigned
                    </Badge>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default function TeamDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isOwner, isManager } = useAppMode();
  const [myStatus, setMyStatus] = useState<string>("online");
  const [statusBoardOpen, setStatusBoardOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  const [selectedMember, setSelectedMember] = useState<MemberWithJobs | null>(null);
  const [selectedMemberIdForMap, setSelectedMemberIdForMap] = useState<string | null>(null);

  // Only owners and managers can manage team
  const canManageTeam = isOwner || isManager;

  const { data: businessSettings } = useQuery<{ businessName?: string }>({
    queryKey: ["/api/business-settings"],
  });

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

  // Derive filtered views from allJobs
  const jobs = useMemo(() => {
    return allJobs.filter((j) => j.status === "in_progress" || j.status === "scheduled");
  }, [allJobs]);

  const unassignedJobs = useMemo(() => {
    return allJobs.filter(j => !j.assignedTo && (j.status === "pending" || j.status === "scheduled"));
  }, [allJobs]);

  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/assign`, { assignedTo: userId });
    },
    onMutate: async ({ jobId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/jobs"] });
      const previousJobs = queryClient.getQueryData<JobData[]>(["/api/jobs"]);
      queryClient.setQueryData<JobData[]>(["/api/jobs"], (old) =>
        old?.map((job) =>
          job.id === jobId ? { ...job, assignedTo: userId } : job
        )
      );
      return { previousJobs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-feed"] });
      toast({
        title: "Job assigned",
        description: "The job has been assigned successfully",
      });
      setSelectedMember(null);
      setSelectedMemberIdForMap(null);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(["/api/jobs"], context.previousJobs);
      }
      toast({
        title: "Failed to assign job",
        variant: "destructive",
      });
    },
  });

  const handleAssignJob = (jobId: string, userId: string) => {
    assignJobMutation.mutate({ jobId, userId });
  };

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

  const handleMemberClickFromMap = (member: TeamMemberData) => {
    if (selectedMemberIdForMap === member.userId) {
      setSelectedMemberIdForMap(null);
    } else {
      setSelectedMemberIdForMap(member.userId);
      // Also open member details panel for full info
      handleMemberClick(member);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", "/api/team/presence", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/presence"] });
      toast({
        title: "Status updated",
        description: `You're now ${STATUS_CONFIG[myStatus]?.label || "online"}`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await apiRequest("POST", "/api/team/presence/heartbeat", {});
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = (status: string) => {
    setMyStatus(status);
    updateStatusMutation.mutate(status);
  };

  const handleMessageClick = (userId: string) => {
    navigate(`/chat?dm=${userId}`);
  };

  const onlineCount = useMemo(() => {
    return presence.filter((p) => p.status !== "offline").length;
  }, [presence]);

  const isLoading = presenceLoading || membersLoading;

  return (
    <div className="flex flex-col h-full" data-testid="team-dashboard">
      <header className="shrink-0 p-4 border-b bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">
                {businessSettings?.businessName || "Team Dashboard"}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{members.length} members</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {onlineCount} online
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Your status:</span>
            <Select value={myStatus} onValueChange={handleStatusChange} data-testid="select-status">
              <SelectTrigger className="w-[140px]" data-testid="status-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} data-testid={`status-option-${key}`}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/team/presence"] });
                queryClient.invalidateQueries({ queryKey: ["/api/activity-feed"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canManageTeam && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/team")}
                data-testid="button-manage-team"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="hidden lg:grid lg:grid-cols-3 h-full gap-0">
          <Card className="rounded-none border-0 border-r h-full overflow-hidden flex flex-col">
            <CardHeader className="shrink-0 pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <TeamStatusBoard
                presence={presence}
                members={members}
                isLoading={isLoading}
                onMessageClick={handleMessageClick}
                onMemberClick={handleMemberClick}
              />
            </CardContent>
          </Card>

          <Card className="rounded-none border-0 border-r h-full overflow-hidden flex flex-col">
            <CardHeader className="shrink-0 pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
            </CardContent>
          </Card>

          <Card className="rounded-none border-0 h-full overflow-hidden flex flex-col">
            <CardHeader className="shrink-0 pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Team Map
                {selectedMemberIdForMap && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Assigning jobs
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <TeamMap
                presence={presence}
                members={members}
                jobs={jobs}
                onMessageClick={handleMessageClick}
                onMemberClick={handleMemberClickFromMap}
                selectedMemberId={selectedMemberIdForMap}
                onAssignJob={handleAssignJob}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:hidden overflow-y-auto h-full p-4 space-y-4">
          <Collapsible open={statusBoardOpen} onOpenChange={setStatusBoardOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Status
                      <Badge variant="secondary" className="ml-2">
                        {onlineCount}/{members.length}
                      </Badge>
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
                  <TeamStatusBoard
                    presence={presence}
                    members={members}
                    isLoading={isLoading}
                    onMessageClick={handleMessageClick}
                    onMemberClick={handleMemberClick}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Activity Feed
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
                  <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Team Map
                      {selectedMemberIdForMap && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Assigning
                        </Badge>
                      )}
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
                  <div className="h-[400px]">
                    <TeamMap
                      presence={presence}
                      members={members}
                      jobs={jobs}
                      onMessageClick={handleMessageClick}
                      onMemberClick={handleMemberClickFromMap}
                      selectedMemberId={selectedMemberIdForMap}
                      onAssignJob={handleAssignJob}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      {/* Member Details Panel */}
      <MemberDetailsPanel
        member={selectedMember}
        onClose={() => {
          setSelectedMember(null);
          setSelectedMemberIdForMap(null);
        }}
        onMessageClick={handleMessageClick}
        onNavigate={navigate}
        onAssignJob={handleAssignJob}
        unassignedJobs={unassignedJobs}
      />
    </div>
  );
}
