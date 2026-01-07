import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  MapPin,
  GripVertical,
  User,
  CalendarDays
} from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isWithinInterval,
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
  assignedTo?: string | null;
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
}

interface TeamSchedulerProps {
  onViewJob?: (id: string) => void;
  onCreateJob?: () => void;
}

interface DraggedJob {
  job: Job;
  originMemberId: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { 
    bg: 'bg-amber-50 dark:bg-amber-900/20', 
    text: 'text-amber-700 dark:text-amber-300', 
    border: 'border-l-amber-500' 
  },
  scheduled: { 
    bg: 'bg-blue-50 dark:bg-blue-900/20', 
    text: 'text-blue-700 dark:text-blue-300', 
    border: 'border-l-blue-500' 
  },
  in_progress: { 
    bg: 'bg-orange-50 dark:bg-orange-900/20', 
    text: 'text-orange-700 dark:text-orange-300', 
    border: 'border-l-orange-500' 
  },
  done: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    text: 'text-green-700 dark:text-green-300', 
    border: 'border-l-green-500' 
  },
  completed: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    text: 'text-green-700 dark:text-green-300', 
    border: 'border-l-green-500' 
  },
  invoiced: { 
    bg: 'bg-purple-50 dark:bg-purple-900/20', 
    text: 'text-purple-700 dark:text-purple-300', 
    border: 'border-l-purple-500' 
  },
};

function getStatusStyle(status: string) {
  const lower = status.toLowerCase().replace(' ', '_');
  return STATUS_COLORS[lower] || STATUS_COLORS.pending;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '1h';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.substring(0, 2).toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return 'TM';
}

function getMemberDisplayName(member: TeamMember): string {
  if (member.firstName && member.lastName) {
    return `${member.firstName} ${member.lastName}`;
  }
  if (member.firstName) return member.firstName;
  return member.email.split('@')[0];
}

export default function TeamScheduler({ onViewJob, onCreateJob }: TeamSchedulerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const clientsMap = useMemo(() => 
    new Map(clients.map(c => [c.id, c])), 
    [clients]
  );

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });

  const weekJobs = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = parseISO(job.scheduledAt);
      return isWithinInterval(jobDate, { start: currentWeekStart, end: weekEnd });
    });
  }, [jobs, currentWeekStart, weekEnd]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.assignedTo && 
      !job.scheduledAt &&
      ['pending', 'scheduled'].includes(job.status.toLowerCase())
    );
  }, [jobs]);

  const allMembers = useMemo(() => {
    const ownerMember: TeamMember = {
      id: 'owner',
      memberId: 'owner',
      firstName: 'Me',
      lastName: '(Owner)',
      email: '',
      roleName: 'Owner',
      profileImageUrl: undefined,
      isActive: true,
    };
    return [ownerMember, ...teamMembers.filter(m => m.isActive)];
  }, [teamMembers]);

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
        title: "Job assigned",
        description: "The job has been scheduled and assigned",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign job",
        description: error.message || "Could not assign the job",
        variant: "destructive",
      });
    },
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => 
      addDays(prev, direction === 'next' ? 7 : -7)
    );
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const handleDragStart = (e: React.DragEvent, job: Job, memberId: string | null) => {
    setDraggedJob({ job, originMemberId: memberId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell(cellId);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, memberId: string, date: Date) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedJob) return;

    const scheduledDate = new Date(date);
    scheduledDate.setHours(9, 0, 0, 0);

    rescheduleJobMutation.mutate({
      jobId: draggedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: '09:00',
      assignedTo: memberId === 'owner' ? null : memberId,
    });

    setDraggedJob(null);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverCell(null);
  };

  const getJobsForMemberAndDay = (memberId: string, date: Date): Job[] => {
    return weekJobs.filter(job => {
      const jobDate = parseISO(job.scheduledAt!);
      const matchesDate = isSameDay(jobDate, date);
      const matchesMember = memberId === 'owner' 
        ? (!job.assignedTo || job.assignedTo === 'owner')
        : job.assignedTo === memberId;
      return matchesDate && matchesMember;
    });
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="flex flex-col h-full" data-testid="team-scheduler">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            data-testid="button-today-scheduler"
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('next')}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <h3 className="text-lg font-semibold">
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h3>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card 
          className="w-48 flex-shrink-0"
          onDragOver={(e) => { e.preventDefault(); setDragOverCell('unassigned'); }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverCell(null);
          }}
        >
          <CardContent className="p-3">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4" />
              Unassigned Jobs
            </h4>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2 pr-2">
                {unassignedJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No unassigned jobs
                  </p>
                ) : (
                  unassignedJobs.map(job => {
                    const client = clientsMap.get(job.clientId);
                    const statusStyle = getStatusStyle(job.status);
                    
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job, null)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onViewJob?.(job.id)}
                        className={`
                          p-2 rounded-md border-l-4 cursor-grab active:cursor-grabbing
                          hover-elevate active-elevate-2 transition-all
                          ${statusStyle.bg} ${statusStyle.border}
                          ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}
                        `}
                        data-testid={`unassigned-job-${job.id}`}
                      >
                        <p className={`text-xs font-medium truncate ${statusStyle.text}`}>
                          {job.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {client?.name || 'Unknown client'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(job.estimatedDuration)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            <ScrollArea className="h-full">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-8 border-b bg-muted/30 sticky top-0 z-10">
                  <div className="p-3 border-r font-medium text-sm text-muted-foreground">
                    Team Member
                  </div>
                  {weekDays.map((day, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 text-center border-r last:border-r-0 ${
                        isToday(day) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-sm font-medium ${
                        isToday(day) ? 'text-primary' : ''
                      }`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  ))}
                </div>

                {allMembers.map((member) => (
                  <div 
                    key={member.id} 
                    className="grid grid-cols-8 border-b last:border-b-0"
                    data-testid={`team-row-${member.id}`}
                  >
                    <div className="p-3 border-r flex items-start gap-2 bg-muted/10">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={member.profileImageUrl} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.firstName, member.lastName, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getMemberDisplayName(member)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.roleName}
                        </p>
                      </div>
                    </div>

                    {weekDays.map((day, dayIdx) => {
                      const cellId = `${member.id}-${format(day, 'yyyy-MM-dd')}`;
                      const cellJobs = getJobsForMemberAndDay(member.memberId, day);
                      const isDragOver = dragOverCell === cellId;
                      
                      return (
                        <div
                          key={dayIdx}
                          className={`
                            p-2 border-r last:border-r-0 min-h-[100px] transition-colors
                            ${isToday(day) ? 'bg-primary/5' : ''}
                            ${isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}
                          `}
                          onDragOver={(e) => handleDragOver(e, cellId)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, member.memberId, day)}
                          data-testid={`cell-${cellId}`}
                        >
                          <div className="space-y-1">
                            {cellJobs.map(job => {
                              const client = clientsMap.get(job.clientId);
                              const statusStyle = getStatusStyle(job.status);
                              
                              return (
                                <Tooltip key={job.id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, job, member.memberId)}
                                      onDragEnd={handleDragEnd}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewJob?.(job.id);
                                      }}
                                      className={`
                                        p-1.5 rounded border-l-2 cursor-grab active:cursor-grabbing
                                        hover-elevate transition-all text-left w-full
                                        ${statusStyle.bg} ${statusStyle.border}
                                        ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}
                                      `}
                                      data-testid={`scheduled-job-${job.id}`}
                                    >
                                      <p className={`text-[11px] font-medium truncate ${statusStyle.text}`}>
                                        {job.title}
                                      </p>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                        <span className="text-[10px] text-muted-foreground">
                                          {job.scheduledTime || '9:00'} · {formatDuration(job.estimatedDuration)}
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-medium">{job.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {client?.name || 'Unknown client'}
                                      </p>
                                      {job.address && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <MapPin className="h-3 w-3" />
                                          <span className="truncate">{job.address}</span>
                                        </div>
                                      )}
                                      <Badge variant="secondary" className="text-[10px]">
                                        {job.status}
                                      </Badge>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            
                            {cellJobs.length === 0 && isDragOver && (
                              <div className="h-12 border-2 border-dashed border-primary/40 rounded flex items-center justify-center">
                                <span className="text-xs text-primary/60">Drop here</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {allMembers.length === 0 && (
                  <div className="p-8 text-center">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      No team members found. Add team members to start scheduling.
                    </p>
                  </div>
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-100 border-l-2 border-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 border-l-2 border-blue-500" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-100 border-l-2 border-orange-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-100 border-l-2 border-green-500" />
            <span>Completed</span>
          </div>
        </div>
        <p>
          {weekJobs.length} job{weekJobs.length !== 1 ? 's' : ''} this week · 
          {unassignedJobs.length} unassigned
        </p>
      </div>
    </div>
  );
}
