import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronDown,
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Map as MapIcon,
  User,
  Users,
  GripVertical,
  Briefcase,
  Navigation,
  Phone,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  LayoutGrid,
  List,
  Timer,
  Sparkles,
  Loader2,
  Check,
  X,
  Plus
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  isSameDay,
  parseISO,
  setHours,
  setMinutes,
  differenceInMinutes,
  addMinutes
} from "date-fns";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  clientId: string;
  clientName?: string;
  assignedTo?: string;
  priority?: string;
}

interface TeamMember {
  id: string;
  memberId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  roleName: string;
  profileImageUrl?: string;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

const WORK_HOURS = Array.from({ length: 15 }, (_, i) => i + 6);
const HOUR_HEIGHT = 60;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300' },
  scheduled: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300' },
  in_progress: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300' },
  done: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300' },
  invoiced: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300' },
};

function getStatusStyle(status: string) {
  const lower = status.toLowerCase().replace(' ', '_');
  return STATUS_COLORS[lower] || STATUS_COLORS.pending;
}

function formatTime(hour: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${ampm}`;
}

function parseJobTime(timeStr?: string): { hour: number; minute: number } {
  if (!timeStr) return { hour: 9, minute: 0 };
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h || 9, minute: m || 0 };
}

interface DraggedJob {
  job: Job;
  originMemberId: string | null;
}

interface SelectedJobForAssignment {
  job: Job;
  mode: 'assign' | 'reassign';
}

interface ScheduleSuggestion {
  jobId: string;
  jobTitle: string;
  clientName: string;
  suggestedDate: string;
  suggestedTime: string;
  suggestedAssignee?: string;
  suggestedAssigneeName?: string;
  reason: string;
  priority: number;
}

interface ScheduleSuggestionsResponse {
  suggestions: ScheduleSuggestion[];
  summary: string;
  optimizationNotes?: string[];
}

interface OpsHealth {
  todayJobCount: number;
  unassignedJobs: number;
  overdueJobs: number;
  overCapacityWorkers: number;
  conflicts: Array<{ memberId: string; memberName: string; jobs: Array<{ id: string; title: string; time: string }> }>;
  conflictCount: number;
  overdueInvoices: number;
  unpaidInvoiceTotal: number;
  activeWorkers: number;
  totalSeverity: number;
}

interface DispatchJob {
  id: string;
  title: string;
  status: string;
  workerStatus?: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  clientId: string;
  client?: { id: string; name: string; phone?: string } | null;
  assignments?: DispatchAssignment[];
}

interface DispatchAssignment {
  id: string;
  assignmentStatus: string;
  memberId?: string;
  memberFirstName?: string;
  memberLastName?: string;
  memberEmail?: string;
  isActive: boolean;
  latestPing?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp?: string;
  } | null;
}

const jobIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const workerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const KANBAN_COLUMNS = [
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-500', bgLight: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'en_route', label: 'En Route', color: 'bg-amber-500', bgLight: 'bg-amber-50 dark:bg-amber-900/20' },
  { key: 'arrived', label: 'Arrived', color: 'bg-purple-500', bgLight: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-orange-500', bgLight: 'bg-orange-50 dark:bg-orange-900/20' },
  { key: 'completed', label: 'Completed', color: 'bg-green-500', bgLight: 'bg-green-50 dark:bg-green-900/20' },
] as const;

function getKanbanColumn(job: DispatchJob): string {
  const status = job.status?.toLowerCase() || '';
  const workerStatus = job.workerStatus?.toLowerCase() || '';
  const assignments = job.assignments || [];

  if (assignments.some(a => a.assignmentStatus === 'done')) return 'completed';
  if (assignments.some(a => a.assignmentStatus === 'working')) return 'in_progress';
  if (assignments.some(a => a.assignmentStatus === 'arrived')) return 'arrived';
  if (assignments.some(a => a.assignmentStatus === 'en_route')) return 'en_route';
  if (assignments.some(a => ['assigned', 'accepted', 'invited'].includes(a.assignmentStatus))) return 'assigned';

  if (workerStatus === 'completed') return 'completed';
  if (workerStatus === 'in_progress') return 'in_progress';
  if (workerStatus === 'arrived') return 'arrived';
  if (workerStatus === 'on_my_way') return 'en_route';

  if (['done', 'completed', 'invoiced'].includes(status)) return 'completed';
  if (status === 'in_progress') return 'in_progress';
  if (['pending', 'scheduled'].includes(status)) return 'assigned';

  return 'assigned';
}

function KanbanBoard({ dispatchJobs }: { dispatchJobs: DispatchJob[] }) {
  const columnJobs = useMemo(() => {
    const map: Record<string, DispatchJob[]> = {};
    KANBAN_COLUMNS.forEach(col => { map[col.key] = []; });
    dispatchJobs.forEach(job => {
      const col = getKanbanColumn(job);
      if (map[col]) map[col].push(job);
    });
    return map;
  }, [dispatchJobs]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-[900px]">
        {KANBAN_COLUMNS.map(column => {
          const count = columnJobs[column.key]?.length || 0;
          return (
            <div key={column.key} className="flex-1 min-w-[220px]">
              <div className={`h-[3px] rounded-full mb-2 ${column.color}`} />
              <div className="flex items-center gap-2 mb-2 px-1">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="secondary" className="ml-auto tabular-nums">
                  {count}
                </Badge>
              </div>
              <div className={`rounded-md p-1.5 space-y-1.5 min-h-[200px] ${column.bgLight}`}>
                {(columnJobs[column.key] || []).map(job => {
                  const firstAssignment = job.assignments?.find(a => a.isActive);
                  const colDef = KANBAN_COLUMNS.find(c => c.key === getKanbanColumn(job));
                  return (
                    <Card key={job.id} className="hover-elevate overflow-visible">
                      <CardContent className="p-2.5 flex gap-2">
                        <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${colDef?.color || 'bg-muted'}`} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium leading-tight truncate">{job.title}</h4>
                          </div>
                          {job.client && (
                            <p className="text-xs text-muted-foreground truncate">
                              {job.client.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {firstAssignment && (
                              <div className="flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[8px]" style={{ backgroundColor: 'hsl(var(--trade) / 0.2)' }}>
                                    {(firstAssignment.memberFirstName?.[0] || '') + (firstAssignment.memberLastName?.[0] || '')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                                  {firstAssignment.memberFirstName}
                                </span>
                              </div>
                            )}
                            {job.scheduledTime && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {job.scheduledTime}
                              </span>
                            )}
                          </div>
                          {job.address && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">{job.address}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {count === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <div className={`w-6 h-6 rounded-full mx-auto mb-2 opacity-30 ${column.color}`} />
                    No {column.label.toLowerCase()} jobs
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DispatchMapView({ dispatchJobs }: { dispatchJobs: DispatchJob[] }) {
  const jobMarkers = useMemo(() => {
    return dispatchJobs.filter(job => {
      const lat = Number(job.latitude);
      const lng = Number(job.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }).map(job => ({
      position: [Number(job.latitude), Number(job.longitude)] as [number, number],
      job,
    }));
  }, [dispatchJobs]);

  const workerMarkers = useMemo(() => {
    const markers: { position: [number, number]; assignment: DispatchAssignment; jobTitle: string }[] = [];
    dispatchJobs.forEach(job => {
      (job.assignments || []).forEach(assignment => {
        if (assignment.assignmentStatus === 'en_route' && assignment.latestPing) {
          const lat = Number(assignment.latestPing.latitude);
          const lng = Number(assignment.latestPing.longitude);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            markers.push({
              position: [lat, lng],
              assignment,
              jobTitle: job.title,
            });
          }
        }
      });
    });
    return markers;
  }, [dispatchJobs]);

  const center = useMemo<[number, number]>(() => {
    const allPoints = [
      ...jobMarkers.map(m => m.position),
      ...workerMarkers.map(m => m.position),
    ];
    if (allPoints.length === 0) return [39.8283, -98.5795];
    const avgLat = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [jobMarkers, workerMarkers]);

  return (
    <div className="rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={jobMarkers.length + workerMarkers.length > 0 ? 10 : 4}
        className="h-[calc(100vh-200px)] w-full"
        style={{ minHeight: '400px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {jobMarkers.map(({ position, job }) => (
          <Marker key={`job-${job.id}`} position={position} icon={jobIcon}>
            <Popup>
              <div className="min-w-[180px]">
                <p className="font-semibold text-sm">{job.title}</p>
                {job.client && <p className="text-xs text-gray-600">{job.client.name}</p>}
                {job.address && <p className="text-xs text-gray-500 mt-1">{job.address}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{job.status}</span>
                  {job.scheduledTime && <span className="text-xs text-gray-500">{job.scheduledTime}</span>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {workerMarkers.map(({ position, assignment, jobTitle }, index) => (
          <Marker key={`worker-${assignment.id}-${index}`} position={position} icon={workerIcon}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold text-sm">
                  {assignment.memberFirstName} {assignment.memberLastName}
                </p>
                <p className="text-xs text-gray-500">En route to: {jobTitle}</p>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">En Route</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function OpsHealthBanner({ opsHealth }: { opsHealth?: OpsHealth }) {
  const [expanded, setExpanded] = useState(false);

  const { data: jobAgingData } = useQuery({
    queryKey: ['/api/ops/job-aging'],
    refetchInterval: 30000,
  });

  if (!opsHealth) return null;

  const agingCount = jobAgingData?.totalAging || 0;
  const hasIssues = opsHealth.conflictCount > 0 || opsHealth.overdueJobs > 0 ||
    opsHealth.unassignedJobs > 0 || opsHealth.overCapacityWorkers > 0 || opsHealth.overdueInvoices > 0 || agingCount > 0;

  if (!hasIssues) return null;

  const severity = opsHealth.conflictCount > 0 ? 'critical' :
    (opsHealth.overdueJobs > 0 || opsHealth.overCapacityWorkers > 0 || (jobAgingData?.criticalCount || 0) > 0) ? 'warning' : 'info';

  return (
    <div className={`rounded-lg border px-3 py-2 mb-3 ${
      severity === 'critical' ? 'bg-destructive/5 border-destructive/20' :
      severity === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
      'bg-muted/50 border-border'
    }`}>
      <div
        className="flex items-center gap-3 cursor-pointer flex-wrap"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {severity === 'critical' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className={`text-xs font-semibold ${
            severity === 'critical' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
          }`}>
            Ops Alert
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-1">
          {opsHealth.conflictCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {opsHealth.conflictCount} Conflicts
            </span>
          )}
          {opsHealth.overdueJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              {opsHealth.overdueJobs} Overdue
            </span>
          )}
          {opsHealth.unassignedJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Briefcase className="h-3 w-3" />
              {opsHealth.unassignedJobs} Unassigned
            </span>
          )}
          {opsHealth.overCapacityWorkers > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="h-3 w-3" />
              {opsHealth.overCapacityWorkers} Over Capacity
            </span>
          )}
          {opsHealth.overdueInvoices > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {opsHealth.overdueInvoices} Overdue Invoices
            </span>
          )}
          {agingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" 
              style={{ backgroundColor: jobAgingData?.criticalCount > 0 ? 'hsl(var(--destructive) / 0.1)' : 'hsl(45 100% 50% / 0.15)', color: jobAgingData?.criticalCount > 0 ? 'hsl(var(--destructive))' : 'hsl(45 80% 35%)' }}>
              <AlertTriangle className="h-3 w-3" />
              {agingCount} Stale Jobs
            </span>
          )}
        </div>

        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && opsHealth.conflicts.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1.5">
          <p className="text-xs font-medium text-destructive">Schedule Conflicts:</p>
          {opsHealth.conflicts.map((conflict, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">{conflict.memberName}</span>
                <span className="text-muted-foreground"> has overlapping jobs: </span>
                {conflict.jobs.map((j, k) => (
                  <span key={j.id}>
                    {k > 0 && ', '}
                    <span className="font-medium">{j.title}</span>
                    <span className="text-muted-foreground"> ({j.time})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {agingCount > 0 && expanded && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium">Stale Jobs (stuck too long in status):</p>
          {(jobAgingData?.agingJobs || []).slice(0, 5).map((j: any) => (
            <div key={j.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" style={{ color: j.severity === 'critical' ? 'hsl(var(--destructive))' : 'hsl(45 80% 35%)' }} />
              <span className="font-medium">{j.title}</span>
              <Badge variant="outline" className="text-[10px] h-4">{j.status}</Badge>
              <span>{j.daysInStatus}d in status ({j.daysOverThreshold}d over)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function detectScheduleConflicts(jobs: Job[]): Set<string> {
  const conflictIds = new Set<string>();
  const jobsWithTimes = jobs
    .filter(j => j.scheduledAt && j.scheduledTime)
    .map(j => {
      const { hour, minute } = parseJobTime(j.scheduledTime);
      const startMinutes = hour * 60 + minute;
      const duration = j.estimatedDuration || 60;
      const endMinutes = startMinutes + duration;
      return { ...j, startMinutes, endMinutes };
    });

  const byAssignee: Record<string, typeof jobsWithTimes> = {};
  jobsWithTimes.forEach(j => {
    const key = j.assignedTo || 'owner';
    if (!byAssignee[key]) byAssignee[key] = [];
    byAssignee[key].push(j);
  });

  Object.values(byAssignee).forEach(memberJobs => {
    memberJobs.sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 0; i < memberJobs.length; i++) {
      for (let k = i + 1; k < memberJobs.length; k++) {
        if (memberJobs[i].endMinutes > memberJobs[k].startMinutes) {
          conflictIds.add(memberJobs[i].id);
          conflictIds.add(memberJobs[k].id);
        }
      }
    }
  });

  return conflictIds;
}

export default function DispatchBoard() {
  const [topView, setTopView] = useState<'schedule' | 'board' | 'map'>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | '3day' | 'week'>('day');
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<SelectedJobForAssignment | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('owner');
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const { toast } = useToast();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: dispatchJobs = [], isLoading: dispatchLoading } = useQuery<DispatchJob[]>({
    queryKey: ['/api/dispatch/board'],
    enabled: topView === 'board' || topView === 'map',
  });

  // AI Scheduling Suggestions
  const { 
    data: aiSuggestions, 
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions 
  } = useQuery<ScheduleSuggestionsResponse>({
    queryKey: ['/api/ai/schedule-suggestions', format(currentDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/ai/schedule-suggestions', {
        targetDate: format(currentDate, 'yyyy-MM-dd')
      });
      return response.json();
    },
    enabled: showAISuggestions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: opsHealth } = useQuery<OpsHealth>({
    queryKey: ['/api/ops/health'],
    refetchInterval: 30000,
  });

  // Apply AI suggestion mutation
  const applySuggestionMutation = useMutation({
    mutationFn: async (suggestion: ScheduleSuggestion) => {
      const scheduledAt = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);
      return apiRequest('PATCH', `/api/jobs/${suggestion.jobId}`, {
        scheduledAt: scheduledAt.toISOString(),
        scheduledTime: suggestion.suggestedTime,
        assignedTo: suggestion.suggestedAssignee === 'owner' ? null : suggestion.suggestedAssignee,
        status: 'scheduled'
      });
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.jobId));
      toast({
        title: "Job scheduled",
        description: `${suggestion.jobTitle} scheduled for ${suggestion.suggestedTime}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule",
        description: error.message || "Could not apply the suggestion",
        variant: "destructive",
      });
    },
  });

  const clientsMap = useMemo(() => 
    new Map(clients.map(c => [c.id, c])), 
    [clients]
  );

  const rescheduleJobMutation = useMutation({
    mutationFn: async ({ 
      jobId, 
      scheduledAt, 
      scheduledTime,
      assignedTo 
    }: { 
      jobId: string; 
      scheduledAt: string;
      scheduledTime?: string;
      assignedTo: string | null;
    }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        scheduledAt,
        scheduledTime,
        assignedTo,
        status: 'scheduled'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job rescheduled",
        description: "The job has been moved to the new time slot",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reschedule",
        description: error.message || "Could not move the job",
        variant: "destructive",
      });
    },
  });

  const unscheduleJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        scheduledAt: null,
        scheduledTime: null,
        assignedTo: null,
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job unscheduled",
        description: "The job has been moved back to the unscheduled list",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unschedule",
        description: error.message || "Could not unschedule the job",
        variant: "destructive",
      });
    },
  });

  const jobsWithClients = useMemo(() => 
    jobs.map(job => ({
      ...job,
      clientName: clientsMap.get(job.clientId)?.name || 'Unknown Client',
      clientPhone: clientsMap.get(job.clientId)?.phone,
    })),
    [jobs, clientsMap]
  );

  const scheduledJobsForDate = useMemo(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return jobsWithClients.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = format(parseISO(job.scheduledAt), 'yyyy-MM-dd');
      return jobDate === dateStr;
    });
  }, [jobsWithClients, currentDate]);

  const unscheduledJobs = useMemo(() => 
    jobsWithClients.filter(job => 
      !job.scheduledAt && 
      ['pending', 'scheduled'].includes(job.status.toLowerCase())
    ),
    [jobsWithClients]
  );

  const teamMembersWithJobs = useMemo(() => {
    const ownerMember = {
      id: 'owner',
      memberId: 'owner',
      firstName: 'Me',
      lastName: '(Owner)',
      email: '',
      roleName: 'Owner',
      profileImageUrl: undefined as string | undefined,
      isActive: true,
    };

    const allMembers = [ownerMember, ...teamMembers.filter(m => m.isActive)];
    
    return allMembers.map(member => {
      const memberJobs = scheduledJobsForDate.filter(job => 
        job.assignedTo === member.memberId || 
        (!job.assignedTo && member.id === 'owner')
      );

      const totalMinutes = memberJobs.reduce((sum, job) => 
        sum + (job.estimatedDuration || 60), 0
      );

      return {
        ...member,
        jobs: memberJobs,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        capacity: 8,
      };
    });
  }, [teamMembers, scheduledJobsForDate]);

  const getBestFitWorker = useCallback(() => {
    const available = teamMembersWithJobs.filter(m => m.totalHours < m.capacity);
    if (available.length === 0) return null;
    return available.reduce((best, curr) => 
      (curr.totalHours / curr.capacity) < (best.totalHours / best.capacity) ? curr : best
    );
  }, [teamMembersWithJobs]);

  const conflictJobIds = useMemo(() => 
    detectScheduleConflicts(scheduledJobsForDate),
    [scheduledJobsForDate]
  );

  const handleDragStart = (job: Job, memberId: string | null) => {
    setDraggedJob({ job, originMemberId: memberId });
  };

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    setDragOverSlot(slotId);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, memberId: string, hour: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedJob) return;

    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(hour, 0, 0, 0);
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    const mutationPayload = {
      jobId: draggedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId === 'owner' ? null : memberId,
    };

    // Debug logging for drag-drop assignment
    console.log('[DispatchBoard] handleDrop - memberId received:', memberId);
    console.log('[DispatchBoard] handleDrop - jobId:', draggedJob.job.id);
    console.log('[DispatchBoard] handleDrop - full mutation payload:', mutationPayload);

    const existingJobsForMember = scheduledJobsForDate.filter(j => 
      (j.assignedTo === (memberId === 'owner' ? null : memberId) || (!j.assignedTo && memberId === 'owner')) &&
      j.id !== draggedJob.job.id
    );
    const newJobStart = hour * 60;
    const newJobEnd = newJobStart + (draggedJob.job.estimatedDuration || 60);
    const hasConflict = existingJobsForMember.some(j => {
      if (!j.scheduledTime) return false;
      const { hour: jHour, minute: jMin } = parseJobTime(j.scheduledTime);
      const jStart = jHour * 60 + jMin;
      const jEnd = jStart + (j.estimatedDuration || 60);
      return newJobStart < jEnd && newJobEnd > jStart;
    });

    if (hasConflict) {
      toast({
        title: "Schedule conflict",
        description: `This time overlaps with another job for this worker. The job was still assigned - review the schedule.`,
        variant: "destructive",
      });
    }

    rescheduleJobMutation.mutate(mutationPayload);

    setDraggedJob(null);
  };

  const handleUnscheduledDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedJob) return;

    unscheduleJobMutation.mutate(draggedJob.job.id);
    setDraggedJob(null);
  };

  // Click-based assignment for mobile support
  // This enters "selection mode" - user can then tap a slot OR open the dialog
  const handleJobClick = (job: Job, mode: 'assign' | 'reassign') => {
    setSelectedJob({ job, mode });
    setSelectedMemberId(job.assignedTo || 'owner');
    const currentHour = job.scheduledTime ? parseJobTime(job.scheduledTime).hour : 9;
    setSelectedHour(currentHour);
    // Don't open dialog immediately - let user tap a slot or use "Assign with Dialog" button
  };

  const handleAssignJob = () => {
    if (!selectedJob || rescheduleJobMutation.isPending) return;

    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(selectedHour, 0, 0, 0);
    const timeStr = `${selectedHour.toString().padStart(2, '0')}:00`;

    const mutationPayload = {
      jobId: selectedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: selectedMemberId === 'owner' ? null : selectedMemberId,
    };

    console.log('[DispatchBoard] handleAssignJob - payload:', mutationPayload);

    rescheduleJobMutation.mutate(mutationPayload, {
      onSuccess: () => {
        setAssignDialogOpen(false);
        setSelectedJob(null);
      },
    });
  };

  const handleSlotClick = (memberId: string, hour: number) => {
    if (!selectedJob || rescheduleJobMutation.isPending) return;
    
    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(hour, 0, 0, 0);
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    const mutationPayload = {
      jobId: selectedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId === 'owner' ? null : memberId,
    };

    console.log('[DispatchBoard] handleSlotClick - assigning to slot:', mutationPayload);

    rescheduleJobMutation.mutate(mutationPayload, {
      onSuccess: () => {
        setSelectedJob(null);
      },
    });
  };

  const cancelJobSelection = () => {
    setSelectedJob(null);
    setAssignDialogOpen(false);
  };

  const getJobPosition = (job: Job) => {
    const { hour, minute } = parseJobTime(job.scheduledTime);
    const top = (hour - 6) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
    const duration = job.estimatedDuration || 60;
    const height = Math.max((duration / 60) * HOUR_HEIGHT, 40);
    return { top, height };
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getWeekDays = useCallback(() => {
    const startOfCurrentWeek = new Date(currentDate);
    const day = startOfCurrentWeek.getDay();
    const diff = startOfCurrentWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfCurrentWeek.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i));
  }, [currentDate]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addDays(prev, 7) : subDays(prev, 7));
  };

  const weekDays = useMemo(() => getWeekDays(), [getWeekDays]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, typeof jobsWithClients> = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      map[dateStr] = jobsWithClients.filter(job => {
        if (!job.scheduledAt) return false;
        return format(parseISO(job.scheduledAt), 'yyyy-MM-dd') === dateStr;
      });
    });
    return map;
  }, [weekDays, jobsWithClients]);

  const isToday = isSameDay(currentDate, new Date());

  return (
    <PageShell data-testid="dispatch-board">
      <div className="mb-6 space-y-3">
        <PageHeader
          title="Dispatch Board"
          subtitle="Live operations center"
          leading={<Navigation className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md bg-muted/40 border px-3 py-2">
          <div className="flex items-center gap-1 bg-background rounded-md p-0.5">
            <Button
              variant={topView === 'schedule' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('schedule')}
            >
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Schedule
            </Button>
            <Button
              variant={topView === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('board')}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Board
            </Button>
            <Button
              variant={topView === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('map')}
            >
              <MapIcon className="h-4 w-4 mr-1.5" />
              Map
            </Button>
          </div>

          {topView === 'schedule' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => viewMode === 'week' ? navigateWeek('prev') : navigateDate('prev')} data-testid="button-prev-day-bar">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant={isToday ? "default" : "outline"} size="sm" onClick={goToToday} data-testid="button-today-bar">
                Today
              </Button>
              <span className="text-sm font-semibold hidden md:inline-flex items-center gap-1.5">
                {viewMode === 'week'
                  ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
                  : <>
                      {isToday && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'hsl(var(--trade))' }} /></span>}
                      {format(currentDate, 'EEE, MMM d')}
                    </>
                }
              </span>
              <Button variant="outline" size="icon" onClick={() => viewMode === 'week' ? navigateWeek('next') : navigateDate('next')} data-testid="button-next-day-bar">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs font-medium flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
              <span className="font-semibold tabular-nums" style={{ color: 'hsl(var(--trade))' }}>{scheduledJobsForDate.length}</span>
              <span className="text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="font-semibold tabular-nums text-orange-600">{scheduledJobsForDate.filter(j => j.status === 'in_progress').length}</span>
              <span className="text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold tabular-nums text-amber-600">{unscheduledJobs.length}</span>
              <span className="text-muted-foreground">Unscheduled</span>
            </div>
          </div>
        </div>
      </div>

      <OpsHealthBanner opsHealth={opsHealth} />

      {topView === 'board' && (
        dispatchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <KanbanBoard dispatchJobs={dispatchJobs} />
        )
      )}

      {topView === 'map' && (
        dispatchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DispatchMapView dispatchJobs={dispatchJobs} />
        )
      )}

      {topView === 'schedule' && selectedJob && !assignDialogOpen && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {rescheduleJobMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-sm font-medium">
                  Assigning <span className="text-primary">"{selectedJob.job.title}"</span>...
                </span>
              </>
            ) : (
              <>
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Tap a time slot to assign <span className="text-primary">"{selectedJob.job.title}"</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setAssignDialogOpen(true)}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-assign-with-dialog"
            >
              <Users className="h-4 w-4 mr-1" />
              Assign with Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelJobSelection}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-cancel-job-selection"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {topView === 'schedule' && (
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => viewMode === 'week' ? navigateWeek('prev') : navigateDate('prev')}
                    data-testid="button-prev-day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isToday ? "default" : "outline"}
                    size="sm"
                    onClick={goToToday}
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => viewMode === 'week' ? navigateWeek('next') : navigateDate('next')}
                    data-testid="button-next-day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-center">
                  {viewMode !== 'week' && isToday && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    </span>
                  )}
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">
                      {viewMode === 'week'
                        ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
                        : format(currentDate, 'EEEE, MMMM d, yyyy')
                      }
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {viewMode === 'week'
                        ? `${Object.values(jobsByDate).reduce((sum, jobs) => sum + jobs.length, 0)} jobs this week`
                        : `${scheduledJobsForDate.length} job${scheduledJobsForDate.length !== 1 ? 's' : ''} scheduled`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('day')}
                    data-testid="button-view-day"
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === '3day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('3day')}
                    data-testid="button-view-3day"
                  >
                    3 Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                    data-testid="button-view-week"
                  >
                    Week
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {viewMode === 'week' ? (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 min-w-[700px]">
                    {weekDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayJobs = jobsByDate[dateStr] || [];
                      const isDayToday = isSameDay(day, new Date());
                      return (
                        <div key={dateStr} className="border-r last:border-r-0 min-h-[400px]">
                          <div
                            className={`p-2.5 border-b text-center cursor-pointer transition-colors ${
                              isDayToday ? 'bg-muted/50' : 'bg-muted/20 hover:bg-muted/40'
                            }`}
                            onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                          >
                            <p className={`text-xs font-medium ${isDayToday ? '' : 'text-muted-foreground'}`}>
                              {format(day, 'EEE')}
                            </p>
                            <p className={`text-lg font-bold tabular-nums ${isDayToday ? '' : ''}`}
                              style={isDayToday ? { color: 'hsl(var(--trade))' } : undefined}
                            >
                              {format(day, 'd')}
                            </p>
                            {dayJobs.length > 0 && (
                              <div className="flex items-center justify-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                                <span className="text-[10px] text-muted-foreground">{dayJobs.length}</span>
                              </div>
                            )}
                          </div>
                          <ScrollArea className="h-[350px]">
                            <div className="p-1.5 space-y-1.5">
                              {dayJobs.map(job => {
                                const statusStyle = getStatusStyle(job.status);
                                const assignedMember = teamMembersWithJobs.find(m =>
                                  m.memberId === job.assignedTo || (!job.assignedTo && m.id === 'owner')
                                );
                                return (
                                  <div
                                    key={job.id}
                                    className={`p-2 rounded-md border cursor-pointer hover-elevate ${statusStyle.bg} ${statusStyle.border}`}
                                    onClick={() => handleJobClick(job, 'reassign')}
                                    data-testid={`week-job-${job.id}`}
                                  >
                                    <div className="flex items-start gap-1.5">
                                      {assignedMember && (
                                        <Avatar className="h-5 w-5 flex-shrink-0 mt-0.5">
                                          <AvatarImage src={assignedMember.profileImageUrl} />
                                          <AvatarFallback className="text-[8px]" style={{ backgroundColor: 'hsl(var(--trade) / 0.2)' }}>
                                            {(assignedMember.firstName?.[0] || '') + (assignedMember.lastName?.[0] || '')}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <h4 className={`font-medium text-xs truncate ${statusStyle.text}`}>
                                          {job.title}
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                          {job.clientName}
                                        </p>
                                      </div>
                                    </div>
                                    {job.scheduledTime && (
                                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                        <Clock className="h-2.5 w-2.5" />
                                        <span>{job.scheduledTime}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {dayJobs.length === 0 && (
                                <div className="text-center py-6 text-xs text-muted-foreground">
                                  No jobs
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex border-b bg-muted/30">
                    <div className="w-16 flex-shrink-0 p-2 text-xs font-medium text-muted-foreground">
                      Time
                    </div>
                    {teamMembersWithJobs.map(member => (
                      <div 
                        key={member.id}
                        className="flex-1 min-w-[180px] p-3 border-l"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profileImageUrl} />
                            <AvatarFallback className="text-xs" style={{ backgroundColor: 'hsl(var(--trade) / 0.2)' }}>
                              {(member.firstName?.[0] || '') + (member.lastName?.[0] || member.email[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.firstName} {member.lastName}
                            </p>
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {member.totalHours}h / {member.capacity}h
                              </span>
                              {member.totalHours > member.capacity && (
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${Math.min((member.totalHours / member.capacity) * 100, 100)}%`,
                              backgroundColor: member.totalHours > member.capacity 
                                ? 'hsl(var(--destructive))' 
                                : 'hsl(var(--trade))'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <ScrollArea className="h-[600px]">
                    <div className="relative">
                      {WORK_HOURS.map(hour => (
                        <div key={hour} className="flex border-b" style={{ height: HOUR_HEIGHT }}>
                          <div className="w-16 flex-shrink-0 p-2 text-xs text-muted-foreground border-r bg-muted/10">
                            {formatTime(hour)}
                          </div>
                          {teamMembersWithJobs.map(member => {
                            const slotId = `${member.id}-${hour}`;
                            const isOver = dragOverSlot === slotId;
                            const isClickable = !!selectedJob;
                            
                            return (
                              <div
                                key={slotId}
                                className={`flex-1 min-w-[180px] border-l relative transition-colors ${
                                  isOver ? 'bg-primary/10' : ''
                                } ${isClickable ? 'cursor-pointer hover:bg-primary/20 bg-primary/5' : 'hover:bg-muted/30'}`}
                                onDragOver={(e) => handleDragOver(e, slotId)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, member.memberId, hour)}
                                onClick={() => selectedJob && handleSlotClick(member.memberId, hour)}
                                data-testid={`slot-${member.id}-${hour}`}
                              >
                                {isOver && (
                                  <div className="absolute inset-1 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
                                    <span className="text-xs text-primary font-medium">Drop here</span>
                                  </div>
                                )}
                                {isClickable && !isOver && (
                                  <div className="absolute inset-1 border border-dashed border-primary/40 rounded-lg opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="text-xs text-primary font-medium">Tap to assign</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {teamMembersWithJobs.map((member, memberIndex) => (
                        member.jobs.map(job => {
                          const { top, height } = getJobPosition(job);
                          const statusStyle = getStatusStyle(job.status);
                          const leftOffset = 64 + memberIndex * 180;
                          const isSelected = selectedJob?.job.id === job.id;

                          return (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={() => handleDragStart(job, member.memberId)}
                              onDragEnd={() => setDraggedJob(null)}
                              onClick={() => handleJobClick(job, 'reassign')}
                              className={`absolute mx-1 rounded-lg border cursor-pointer active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md hover-elevate ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : conflictJobIds.has(job.id) ? 'ring-2 ring-destructive/60 ring-offset-1' : ''}`}
                              style={{
                                top: top + 1,
                                left: leftOffset,
                                width: 'calc(100% / ' + teamMembersWithJobs.length + ' - 12px)',
                                minWidth: 168,
                                height: height - 2,
                                zIndex: draggedJob?.job.id === job.id ? 50 : 10,
                                opacity: draggedJob?.job.id === job.id ? 0.5 : 1,
                              }}
                              data-testid={`scheduled-job-${job.id}`}
                            >
                              <div className="p-2 h-full flex flex-col">
                                <div className="flex items-start gap-1">
                                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  {conflictJobIds.has(job.id) && (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`font-medium text-sm truncate ${statusStyle.text}`}>
                                      {job.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {job.clientName}
                                    </p>
                                  </div>
                                </div>
                                {height > 60 && (
                                  <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{job.scheduledTime || '9:00'}</span>
                                    {job.estimatedDuration && (
                                      <span>({Math.round(job.estimatedDuration / 60)}h)</span>
                                    )}
                                  </div>
                                )}
                                {height > 80 && job.address && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{job.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Unscheduled Jobs
                <Badge variant="secondary" className="ml-auto">{unscheduledJobs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent 
              className="p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleUnscheduledDrop}
            >
              <ScrollArea className="h-[300px]">
                {unscheduledJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All jobs scheduled!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unscheduledJobs.map(job => {
                      const statusStyle = getStatusStyle(job.status);
                      const isSelected = selectedJob?.job.id === job.id;
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={() => handleDragStart(job, null)}
                          onDragEnd={() => setDraggedJob(null)}
                          onClick={() => handleJobClick(job, 'assign')}
                          className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing hover-elevate ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}`}
                          data-testid={`unscheduled-job-${job.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium text-sm ${statusStyle.text}`}>
                                {job.title}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {job.clientName}
                              </p>
                              {job.address && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{job.address}</span>
                                </div>
                              )}
                              {(() => {
                                const bestFit = getBestFitWorker();
                                if (!bestFit) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-dashed">
                                    <Sparkles className="h-3 w-3 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                                    <span className="text-[10px] text-muted-foreground">Available:</span>
                                    <Avatar className="h-3.5 w-3.5">
                                      <AvatarFallback className="text-[7px]" style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}>
                                        {(bestFit.firstName?.[0] || '') + (bestFit.lastName?.[0] || '')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] font-medium truncate">
                                      {bestFit.firstName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      ({bestFit.totalHours}h/{bestFit.capacity}h)
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-3">
                {teamMembersWithJobs.map(member => (
                  <div key={member.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]" style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}>
                              {(member.firstName?.[0] || '') + (member.lastName?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${member.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </div>
                        <span className="text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant={member.totalHours > member.capacity ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {member.jobs.length} jobs
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((member.totalHours / member.capacity) * 100, 100)}%`,
                            backgroundColor: member.totalHours > member.capacity 
                              ? 'hsl(var(--destructive))' 
                              : 'hsl(var(--trade))'
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                        {member.totalHours}h / {member.capacity}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Scheduling Suggestions */}
          <Card className="border-2" style={{ borderColor: showAISuggestions ? 'hsl(var(--trade))' : undefined }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                AI Scheduling
                {unscheduledJobs.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{unscheduledJobs.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {!showAISuggestions ? (
                <div className="text-center py-4">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Let AI suggest optimal times and assignments for your unscheduled jobs
                  </p>
                  <Button 
                    onClick={() => setShowAISuggestions(true)}
                    disabled={unscheduledJobs.length === 0}
                    className="w-full"
                    data-testid="button-get-ai-suggestions"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </Button>
                  {unscheduledJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No unscheduled jobs to optimize
                    </p>
                  )}
                </div>
              ) : suggestionsLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: 'hsl(var(--trade))' }} />
                  <p className="text-sm text-muted-foreground">
                    Analyzing jobs and team availability...
                  </p>
                </div>
              ) : aiSuggestions?.suggestions && aiSuggestions.suggestions.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{aiSuggestions.summary}</p>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2 pr-2">
                      {aiSuggestions.suggestions.map((suggestion, index) => {
                        const isApplied = appliedSuggestions.has(suggestion.jobId);
                        return (
                          <div
                            key={suggestion.jobId}
                            className={`p-3 rounded-lg border transition-all ${
                              isApplied 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300' 
                                : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                            data-testid={`ai-suggestion-${suggestion.jobId}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                  <h4 className="font-medium text-sm truncate">{suggestion.jobTitle}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {suggestion.clientName}
                                </p>
                              </div>
                              {isApplied ? (
                                <Badge variant="default" className="bg-green-500 text-white">
                                  <Check className="h-3 w-3 mr-1" />
                                  Applied
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applySuggestionMutation.mutate(suggestion)}
                                  disabled={applySuggestionMutation.isPending}
                                  data-testid={`button-apply-suggestion-${suggestion.jobId}`}
                                >
                                  {applySuggestionMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>Apply</>
                                  )}
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{suggestion.suggestedTime}</span>
                              </div>
                              {suggestion.suggestedAssigneeName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span>{suggestion.suggestedAssigneeName}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 italic">
                              {suggestion.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  
                  {aiSuggestions.optimizationNotes && aiSuggestions.optimizationNotes.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium mb-1">Optimization notes:</p>
                      {aiSuggestions.optimizationNotes.map((note, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {note}</p>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setShowAISuggestions(false);
                        setAppliedSuggestions(new Set());
                      }}
                      data-testid="button-close-ai-suggestions"
                    >
                      Close
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => refetchSuggestions()}
                      data-testid="button-refresh-ai-suggestions"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {aiSuggestions?.summary || 'No suggestions needed - all jobs are scheduled!'}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowAISuggestions(false)}
                  >
                    Close
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </div>
                Live Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    <span className="text-sm text-muted-foreground">Scheduled</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--trade))' }}>
                    {scheduledJobsForDate.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-sm text-muted-foreground">In Progress</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-orange-500">
                    {scheduledJobsForDate.filter(j => j.status === 'in_progress').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-green-500">
                    {scheduledJobsForDate.filter(j => j.status === 'done').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Unscheduled</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-amber-500">
                    {unscheduledJobs.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Job</DialogTitle>
            <DialogDescription>
              {selectedJob?.mode === 'assign' ? 'Assign' : 'Reassign'} "{selectedJob?.job.title}" to a team member and time slot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Member</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger data-testid="select-team-member">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembersWithJobs.map(member => (
                    <SelectItem key={member.memberId} value={member.memberId}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px]">
                            {(member.firstName?.[0] || '') + (member.lastName?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                        {member.firstName} {member.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Select value={selectedHour.toString()} onValueChange={(v) => setSelectedHour(parseInt(v))}>
                <SelectTrigger data-testid="select-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_HOURS.map(hour => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {formatTime(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignJob}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {rescheduleJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
