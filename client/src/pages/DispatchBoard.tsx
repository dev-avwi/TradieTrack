import { useState, useMemo, useCallback } from "react";
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
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Users,
  GripVertical,
  Briefcase,
  Navigation,
  Phone,
  AlertCircle,
  CheckCircle2,
  Play,
  Pause,
  LayoutGrid,
  List,
  Timer,
  Sparkles,
  Loader2,
  Check
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

export default function DispatchBoard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | '3day' | 'week'>('day');
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
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

    rescheduleJobMutation.mutate({
      jobId: draggedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId === 'owner' ? null : memberId,
    });

    setDraggedJob(null);
  };

  const handleUnscheduledDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedJob) return;

    unscheduleJobMutation.mutate(draggedJob.job.id);
    setDraggedJob(null);
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

  const isToday = isSameDay(currentDate, new Date());

  return (
    <PageShell data-testid="dispatch-board">
      <PageHeader
        title="Dispatch Board"
        subtitle="Drag and drop jobs to schedule your team"
      />

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateDate('prev')}
                    data-testid="button-prev-day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isToday ? "default" : "outline"}
                    onClick={goToToday}
                    className="min-w-[80px]"
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateDate('next')}
                    data-testid="button-next-day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="ml-2">
                    <h2 className="text-lg font-semibold">
                      {format(currentDate, 'EEEE, MMMM d, yyyy')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {scheduledJobsForDate.length} job{scheduledJobsForDate.length !== 1 ? 's' : ''} scheduled
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('day')}
                    className="h-8"
                    data-testid="button-view-day"
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === '3day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('3day')}
                    className="h-8"
                    data-testid="button-view-3day"
                  >
                    3 Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                    className="h-8"
                    data-testid="button-view-week"
                  >
                    Week
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
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
                            
                            return (
                              <div
                                key={slotId}
                                className={`flex-1 min-w-[180px] border-l relative transition-colors ${
                                  isOver ? 'bg-primary/10' : 'hover:bg-muted/30'
                                }`}
                                onDragOver={(e) => handleDragOver(e, slotId)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, member.memberId, hour)}
                                data-testid={`slot-${member.id}-${hour}`}
                              >
                                {isOver && (
                                  <div className="absolute inset-1 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
                                    <span className="text-xs text-primary font-medium">Drop here</span>
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

                          return (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={() => handleDragStart(job, member.memberId)}
                              onDragEnd={() => setDraggedJob(null)}
                              className={`absolute mx-1 rounded-lg border cursor-grab active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md ${statusStyle.bg} ${statusStyle.border}`}
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
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={() => handleDragStart(job, null)}
                          onDragEnd={() => setDraggedJob(null)}
                          className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing ${statusStyle.bg} ${statusStyle.border}`}
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
                  <div key={member.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {(member.firstName?.[0] || '') + (member.lastName?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
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
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
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
                      <span className="text-xs text-muted-foreground w-16 text-right">
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
                <CalendarIcon className="h-4 w-4" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                    {scheduledJobsForDate.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Today's Jobs</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-orange-500">
                    {scheduledJobsForDate.filter(j => j.status === 'in_progress').length}
                  </p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-green-500">
                    {scheduledJobsForDate.filter(j => j.status === 'done').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-amber-500">
                    {unscheduledJobs.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Unscheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
