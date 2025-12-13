import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import StatusBadge from "@/components/StatusBadge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Briefcase,
  Plus,
  GripVertical,
  Timer,
  AlertCircle,
  Users,
  LayoutGrid
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  isSameDay,
  parseISO,
} from "date-fns";

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  estimatedHours?: number;
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

interface JobForDate {
  id: string;
  title: string;
  client: string;
  address: string;
  time: string;
  duration: string;
  status: string;
  date: string;
}

interface SchedulePageProps {
  onCreateJob?: () => void;
  onViewJob?: (id: string) => void;
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

function MonthView({ 
  currentDate, 
  getJobsForDate, 
  isToday, 
  onViewJob 
}: {
  currentDate: Date;
  getJobsForDate: (date: Date) => JobForDate[];
  isToday: (date: Date) => boolean;
  onViewJob?: (id: string) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, 1 - (startDayOfWeek - i));
    currentWeek.push(prevDate);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(year, month + 1, nextDay++));
    }
    weeks.push(currentWeek);
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isCurrentMonth = (date: Date) => date.getMonth() === month;
  
  const totalJobsThisMonth = Array.from({ length: daysInMonth }, (_, i) => 
    getJobsForDate(new Date(year, month, i + 1)).length
  ).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="mt-3">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {totalJobsThisMonth} job{totalJobsThisMonth !== 1 ? 's' : ''} this month
          </p>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((name) => (
            <div 
              key={name} 
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {name}
            </div>
          ))}
          
          {weeks.map((week, weekIndex) => (
            week.map((date, dayIndex) => {
              const dayJobs = getJobsForDate(date);
              const today = isToday(date);
              const inMonth = isCurrentMonth(date);
              
              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`min-h-[80px] sm:min-h-[100px] p-1 rounded-lg border transition-colors ${
                    !inMonth 
                      ? 'bg-muted/30 border-transparent' 
                      : today 
                        ? 'border-2' 
                        : 'border-border hover:bg-muted/50'
                  }`}
                  style={today ? { 
                    borderColor: 'hsl(var(--trade))',
                    backgroundColor: 'hsl(var(--trade) / 0.05)'
                  } : {}}
                  data-testid={`month-day-${date.getDate()}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={`text-xs sm:text-sm font-medium ${
                        !inMonth ? 'text-muted-foreground/50' : ''
                      }`}
                      style={today ? { color: 'hsl(var(--trade))' } : {}}
                    >
                      {date.getDate()}
                    </span>
                    {dayJobs.length > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="text-[10px] px-1 py-0 h-4"
                        style={{
                          backgroundColor: 'hsl(var(--trade) / 0.15)',
                          color: 'hsl(var(--trade))'
                        }}
                      >
                        {dayJobs.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-0.5 overflow-hidden">
                    {dayJobs.slice(0, 2).map((job) => (
                      <div
                        key={job.id}
                        onClick={() => onViewJob?.(job.id)}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer hover-elevate"
                        style={{
                          backgroundColor: 'hsl(var(--trade) / 0.1)',
                        }}
                        data-testid={`month-job-${job.id}`}
                      >
                        <span className="hidden sm:inline">{job.time} </span>
                        <span className="font-medium">{job.title}</span>
                      </div>
                    ))}
                    {dayJobs.length > 2 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayJobs.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SchedulePage({ onCreateJob, onViewJob }: SchedulePageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month' | 'dispatch'>('week');
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
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

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric',
      month: 'short'
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-AU', { 
      year: 'numeric', 
      month: 'long'
    });
  };

  const getCurrentWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const getJobsForDate = (date: Date): JobForDate[] => {
    const dateStr = date.toISOString().split('T')[0];
    return jobsWithClients.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt).toISOString().split('T')[0];
      return jobDate === dateStr;
    }).map(job => {
      const scheduledDate = new Date(job.scheduledAt!);
      return {
        id: job.id,
        title: job.title,
        client: job.clientName || 'Unknown Client',
        address: job.address || 'No address',
        time: scheduledDate.toLocaleTimeString('en-AU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        duration: job.estimatedHours ? `${job.estimatedHours} hours` : 'TBD',
        status: job.status,
        date: dateStr
      };
    });
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  const weekDays = getCurrentWeekDays();
  const weekStart = formatDateShort(weekDays[0]);
  const weekEnd = formatDateShort(weekDays[6]);
  const weekJobCount = weekDays.reduce((total, date) => total + getJobsForDate(date).length, 0);

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

  const goToToday = () => setCurrentDate(new Date());

  return (
    <PageShell data-testid="schedule-page">
      <PageHeader
        title="Schedule"
        subtitle="Plan and dispatch your jobs"
        action={
          <Button 
            onClick={onCreateJob} 
            data-testid="button-create-job-schedule"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        }
      />

      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg flex-1 sm:flex-none">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('week')}
                  data-testid="button-week-view"
                  className={`flex-1 sm:flex-none px-3 ${view === 'week' ? 'shadow-sm' : ''}`}
                  style={view === 'week' ? {
                    backgroundColor: 'hsl(var(--trade))',
                    color: 'white'
                  } : {}}
                >
                  <CalendarIcon className="h-4 w-4 mr-1.5" />
                  Week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('month')}
                  data-testid="button-month-view"
                  className={`flex-1 sm:flex-none px-3 ${view === 'month' ? 'shadow-sm' : ''}`}
                  style={view === 'month' ? {
                    backgroundColor: 'hsl(var(--trade))',
                    color: 'white'
                  } : {}}
                >
                  <LayoutGrid className="h-4 w-4 mr-1.5" />
                  Month
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('dispatch')}
                  data-testid="button-dispatch-view"
                  className={`flex-1 sm:flex-none px-3 ${view === 'dispatch' ? 'shadow-sm' : ''}`}
                  style={view === 'dispatch' ? {
                    backgroundColor: 'hsl(var(--trade))',
                    color: 'white'
                  } : {}}
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Dispatch
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                data-testid="button-today"
                className="px-4"
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                Today
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === 'week') navigateWeek('prev');
                else if (view === 'month') navigateMonth('prev');
                else navigateDay('prev');
              }}
              data-testid="button-prev-period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center flex-1 min-w-0 px-2">
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {view === 'week' 
                  ? `${weekStart} - ${weekEnd}`
                  : view === 'month'
                  ? formatMonthYear(currentDate)
                  : format(currentDate, 'EEEE, MMMM d, yyyy')
                }
              </h2>
              <p className="text-xs text-muted-foreground">
                {view === 'week' && weekJobCount > 0 
                  ? `${weekJobCount} job${weekJobCount === 1 ? '' : 's'} scheduled` 
                  : view === 'dispatch'
                  ? `${scheduledJobsForDate.length} job${scheduledJobsForDate.length !== 1 ? 's' : ''} scheduled`
                  : ''
                }
              </p>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === 'week') navigateWeek('next');
                else if (view === 'month') navigateMonth('next');
                else navigateDay('next');
              }}
              data-testid="button-next-period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === 'week' && (
        <>
          <div className="md:hidden mt-3">
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {weekDays.map((date, index) => {
                const dayJobs = getJobsForDate(date);
                const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
                const dayNumber = date.getDate();
                const today = isToday(date);
                const isSelected = currentDate.toDateString() === date.toDateString();
                
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentDate(date)}
                    className={`flex-shrink-0 min-w-[52px] py-3 px-2 rounded-xl text-center transition-all border ${
                      today 
                        ? 'border-transparent' 
                        : isSelected
                        ? 'bg-muted border-muted'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                    style={today ? { 
                      backgroundColor: 'hsl(var(--trade) / 0.15)',
                      boxShadow: '0 0 0 2px hsl(var(--trade))'
                    } : {}}
                    data-testid={`calendar-day-${index}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">{dayName}</p>
                    <p className={`text-xl font-bold`} style={today ? { color: 'hsl(var(--trade))' } : {}}>
                      {dayNumber}
                    </p>
                    {dayJobs.length > 0 && (
                      <div 
                        className="mx-auto w-2 h-2 rounded-full mt-1"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    <span className="font-medium">
                      {currentDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {isToday(currentDate) && (
                    <Badge 
                      variant="default" 
                      className="text-xs"
                      style={{
                        backgroundColor: 'hsl(var(--trade))',
                        color: 'white'
                      }}
                    >
                      Today
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getJobsForDate(currentDate).length > 0 ? (
                  getJobsForDate(currentDate).map((job) => (
                    <div 
                      key={job.id}
                      className="p-3 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => onViewJob?.(job.id)}
                      data-testid={`calendar-job-${job.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                            <span className="text-sm font-medium">{job.time}</span>
                          </div>
                          <p className="font-medium truncate">{job.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{job.client}</p>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs truncate">{job.address}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Briefcase className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">No jobs scheduled</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onCreateJob}
                      data-testid="button-schedule-job-empty"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Schedule Job
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="hidden md:grid md:grid-cols-7 gap-3 mt-3">
            {weekDays.map((date, index) => {
              const dayJobs = getJobsForDate(date);
              const dayName = date.toLocaleDateString('en-AU', { weekday: 'short' });
              const dayNumber = date.getDate();
              const today = isToday(date);
              
              return (
                <Card 
                  key={index} 
                  className="min-h-[180px]"
                  style={today ? { 
                    borderColor: 'hsl(var(--trade))',
                    boxShadow: '0 0 0 2px hsl(var(--trade))'
                  } : {}}
                >
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{dayName}</p>
                        <p className={`text-lg font-bold`} style={today ? { color: 'hsl(var(--trade))' } : {}}>
                          {dayNumber}
                        </p>
                      </div>
                      {today && (
                        <Badge 
                          variant="default" 
                          className="text-xs"
                          style={{
                            backgroundColor: 'hsl(var(--trade))',
                            color: 'white'
                          }}
                        >
                          Today
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3 space-y-2">
                    {dayJobs.map((job) => (
                      <div 
                        key={job.id}
                        className="p-2 rounded-lg bg-muted hover-elevate cursor-pointer"
                        onClick={() => onViewJob?.(job.id)}
                        data-testid={`calendar-job-${job.id}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3" style={{ color: 'hsl(var(--trade))' }} />
                          <span className="text-xs font-medium">{job.time}</span>
                        </div>
                        <p className="text-xs font-medium line-clamp-1">{job.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{job.client}</p>
                      </div>
                    ))}
                    
                    {dayJobs.length === 0 && (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <p className="text-xs">No jobs</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {view === 'month' && (
        <MonthView 
          currentDate={currentDate}
          getJobsForDate={getJobsForDate}
          isToday={isToday}
          onViewJob={onViewJob}
        />
      )}

      {view === 'dispatch' && (
        <div className="flex flex-col lg:flex-row gap-4 mt-3">
          <div className="flex-1">
            <Card>
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
                                onClick={() => onViewJob?.(job.id)}
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

          <div className="w-full lg:w-80 flex-shrink-0">
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
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-2">
                    {unscheduledJobs.length > 0 ? (
                      unscheduledJobs.map(job => {
                        const statusStyle = getStatusStyle(job.status);
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={() => handleDragStart(job, null)}
                            onDragEnd={() => setDraggedJob(null)}
                            onClick={() => onViewJob?.(job.id)}
                            className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${statusStyle.bg} ${statusStyle.border}`}
                            data-testid={`unscheduled-job-${job.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-medium text-sm truncate ${statusStyle.text}`}>
                                  {job.title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                  {job.clientName}
                                </p>
                                {job.address && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{job.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Briefcase className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No unscheduled jobs</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
