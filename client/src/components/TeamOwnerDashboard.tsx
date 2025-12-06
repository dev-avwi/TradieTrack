import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TrustBanner from "./TrustBanner";
import ActivityFeed from "./ActivityFeed";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useAppMode } from "@/hooks/use-app-mode";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  Users,
  MapPin,
  Plus,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  GripVertical,
  UserPlus,
  ArrowRight,
  Map
} from "lucide-react";

interface TeamOwnerDashboardProps {
  userName?: string;
  businessName?: string;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  clientName?: string;
  clientPhone?: string;
  address?: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface TeamMember {
  id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  inviteStatus: string;
}

export default function TeamOwnerDashboard({
  userName = "there",
  businessName,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onNavigate,
}: TeamOwnerDashboardProps) {
  const { data: kpis } = useDashboardKPIs();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const { teamMembers, hasActiveTeam } = useAppMode();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dragOverMember, setDragOverMember] = useState<string | null>(null);

  // Fetch all unassigned jobs for the scheduler
  const { data: unassignedJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", { filter: "unassigned" }],
    queryFn: async () => {
      const response = await fetch('/api/jobs?unassigned=true', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch unassigned jobs');
      return response.json();
    },
  });

  // Fetch jobs with their assignments
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Assign job mutation
  const assignJob = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      const response = await fetch(`/api/jobs/${jobId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to assign job');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today"] });
      toast({
        title: "Job assigned",
        description: "The job has been assigned to the team member",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatJobTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, job: Job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverMember(null);
  };

  const handleDragOver = (e: React.DragEvent, memberId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMember(memberId);
  };

  const handleDragLeave = () => {
    setDragOverMember(null);
  };

  const handleDrop = (e: React.DragEvent, member: TeamMember) => {
    e.preventDefault();
    setDragOverMember(null);
    
    if (draggedJob && member.userId) {
      assignJob.mutate({ 
        jobId: draggedJob.id, 
        userId: member.userId 
      });
    }
    setDraggedJob(null);
  };

  const getInitials = (member: TeamMember) => {
    const first = member.firstName?.charAt(0) || '';
    const last = member.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || member.email?.charAt(0).toUpperCase() || 'T';
  };

  const getMemberName = (member: TeamMember) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.email?.split('@')[0] || 'Team Member';
  };

  // Get jobs assigned to a specific member
  const getJobsForMember = (memberId: string) => {
    return allJobs.filter(job => job.assignedTo === memberId && job.status !== 'done' && job.status !== 'invoiced');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-medium">Complete</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs font-medium">Scheduled</Badge>;
  };

  // Filter pending/unassigned jobs
  const jobsToAssign = allJobs.filter(job => 
    !job.assignedTo && 
    job.status !== 'done' && 
    job.status !== 'invoiced'
  );

  return (
    <div className="w-full px-4 sm:px-5 py-5 sm:py-6 pb-28 section-gap" data-testid="team-owner-dashboard">
      {/* iOS-Style Header */}
      <div className="space-y-1 animate-fade-up">
        <h1 className="ios-title">
          {getGreeting()}, {userName}
        </h1>
        <p className="ios-caption">
          {hasActiveTeam 
            ? `Managing ${teamMembers.length} team member${teamMembers.length > 1 ? 's' : ''}`
            : businessName || "Welcome back"}
        </p>
      </div>

      <TrustBanner />

      {/* Quick Stats - KPIs */}
      <section className="animate-fade-up" style={{ animationDelay: '50ms' }}>
        <h2 className="ios-label mb-3">Quick Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/jobs?filter=in_progress')}
            data-testid="kpi-jobs-today"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                >
                  <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.jobsToday || 0}</p>
                  <p className="ios-caption">Jobs Today</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/invoices?filter=overdue')}
            data-testid="kpi-overdue"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (kpis?.unpaidInvoicesCount ?? 0) > 0 ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--muted) / 0.5)' }}
                >
                  <AlertCircle className="h-5 w-5" style={{ color: (kpis?.unpaidInvoicesCount ?? 0) > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.unpaidInvoicesCount ?? 0}</p>
                  <p className="ios-caption">Overdue</p>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/team')}
            data-testid="kpi-team"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
                >
                  <Users className="h-5 w-5" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamMembers.length}</p>
                  <p className="ios-caption">Team Members</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/invoices?filter=paid')}
            data-testid="kpi-earnings"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.1)' }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">${kpis?.monthlyEarnings?.toFixed(0) || "0"}</p>
                  <p className="ios-caption">This Month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <h2 className="ios-label mb-3">Quick Actions</h2>
        <div className="feed-card" data-testid="quick-actions-section">
          <div className="card-padding">
            <div className="flex gap-2 flex-wrap">
              {onCreateJob && (
                <Button 
                  size="sm"
                  className="flex-1 text-white font-medium h-10 px-3 rounded-xl press-scale min-w-[80px]"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={onCreateJob}
                  data-testid="button-quick-create-job"
                >
                  <Briefcase className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Job</span>
                </Button>
              )}
              {onCreateQuote && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                  onClick={onCreateQuote}
                  data-testid="button-quick-create-quote"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Quote</span>
                </Button>
              )}
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                onClick={() => onNavigate?.('/map')}
                data-testid="button-view-map"
              >
                <Map className="h-4 w-4 mr-1.5" />
                <span className="truncate">Map</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Job Scheduler - Drag & Drop */}
      {hasActiveTeam && (
        <section className="space-y-4 animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="ios-section-title flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
              >
                <Users className="h-4 w-4" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
              </div>
              Job Scheduler
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-3 rounded-xl press-scale"
              onClick={() => onNavigate?.('/team')}
              data-testid="button-manage-team"
            >
              Manage Team
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          <p className="ios-caption">
            Drag jobs to assign them to team members
          </p>

          {/* Unassigned Jobs */}
          {jobsToAssign.length > 0 && (
            <Card className="border-dashed" data-testid="unassigned-jobs-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {jobsToAssign.length}
                  </Badge>
                  Unassigned Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-4 pb-4">
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {jobsToAssign.slice(0, 5).map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job)}
                        onDragEnd={handleDragEnd}
                        className="flex-shrink-0 w-44 p-3 rounded-xl border bg-card hover-elevate cursor-grab active:cursor-grabbing transition-all"
                        data-testid={`draggable-job-${job.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm line-clamp-1">{job.title}</p>
                            {job.scheduledAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(job.scheduledAt)} {formatJobTime(job.scheduledAt)}
                              </p>
                            )}
                            {job.clientName && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {job.clientName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {jobsToAssign.length > 5 && (
                      <Button
                        variant="ghost"
                        className="flex-shrink-0 h-auto py-3 px-4 rounded-xl"
                        onClick={() => onNavigate?.('/jobs?filter=unassigned')}
                      >
                        +{jobsToAssign.length - 5} more
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Team Members - Drop Zones */}
          <div className="grid gap-3">
            {teamMembers.map((member) => {
              const memberJobs = getJobsForMember(member.userId || '');
              const isDragOver = dragOverMember === member.id;
              
              return (
                <div
                  key={member.id}
                  onDragOver={(e) => handleDragOver(e, member.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, member)}
                  className={`feed-card transition-all ${
                    isDragOver 
                      ? 'ring-2 ring-primary ring-offset-2' 
                      : ''
                  }`}
                  data-testid={`team-member-drop-zone-${member.id}`}
                >
                  <div className="card-padding">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback 
                          className="text-sm font-medium"
                          style={{ backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' }}
                        >
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{getMemberName(member)}</p>
                        <p className="text-xs text-muted-foreground">
                          {memberJobs.length} active job{memberJobs.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {isDragOver && (
                        <Badge style={{ backgroundColor: 'hsl(var(--trade))' }} className="text-white">
                          Drop here
                        </Badge>
                      )}
                    </div>
                    
                    {/* Member's assigned jobs */}
                    {memberJobs.length > 0 ? (
                      <div className="space-y-2">
                        {memberJobs.slice(0, 3).map((job) => (
                          <div 
                            key={job.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                            onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{job.title}</span>
                            </div>
                            {getStatusBadge(job.status)}
                          </div>
                        ))}
                        {memberJobs.length > 3 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => onNavigate?.(`/jobs?assignedTo=${member.userId}`)}
                          >
                            View all {memberJobs.length} jobs
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        {isDragOver ? 'Release to assign' : 'No jobs assigned'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invite More */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl"
            onClick={() => onNavigate?.('/team?invite=true')}
            data-testid="button-invite-team-member"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Team Member
          </Button>
        </section>
      )}

      {/* No Team Members Yet - Prompt to Add */}
      {!hasActiveTeam && (
        <section className="animate-fade-up" style={{ animationDelay: '150ms' }}>
          <Card className="border-dashed" data-testid="add-team-prompt">
            <CardContent className="py-8 text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
              >
                <Users className="h-8 w-8" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Build Your Team</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
                Invite team members to assign jobs, track locations, and manage your business together.
              </p>
              <Button
                className="text-white font-medium rounded-xl"
                style={{ backgroundColor: 'hsl(217.2, 91.2%, 59.8%)' }}
                onClick={() => onNavigate?.('/team?invite=true')}
                data-testid="button-invite-first-member"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Your First Team Member
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* TODAY'S SCHEDULE */}
      <section className="space-y-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between">
          <h2 className="ios-section-title flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <CalendarDays className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            Today's Jobs
          </h2>
          {todaysJobs.length > 0 && onViewJobs && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-3 rounded-xl press-scale"
              onClick={onViewJobs}
              data-testid="button-view-all-jobs"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>

        {todaysJobs.length === 0 ? (
          <div className="feed-card card-padding text-center" data-testid="no-jobs-card">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
            >
              <Briefcase className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="ios-body text-muted-foreground mb-4">No jobs scheduled for today</p>
            {onCreateJob && (
              <Button 
                size="lg"
                className="text-white font-semibold h-12 px-6 rounded-xl press-scale"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                onClick={onCreateJob}
                data-testid="button-schedule-job"
              >
                <Plus className="h-4 w-4 mr-2" />
                Schedule a Job
              </Button>
            )}
          </div>
        ) : (
          <div className="feed-gap">
            {todaysJobs.slice(0, 5).map((job: any, index: number) => (
              <div 
                key={job.id}
                className="feed-card border card-press cursor-pointer"
                onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                data-testid={`job-card-${job.id}`}
              >
                <div className="card-padding">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                      >
                        <span className="font-bold text-lg" style={{ color: 'hsl(var(--trade))' }}>
                          {formatJobTime(job.scheduledAt).split(' ')[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="ios-label">
                            {formatJobTime(job.scheduledAt).split(' ')[1]}
                          </span>
                          {getStatusBadge(job.status)}
                        </div>
                        <h3 className="font-medium line-clamp-1 mt-0.5">{job.title}</h3>
                        {job.assignedToName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            {job.assignedToName}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onCreateClient={() => onNavigate?.('/clients')}
        onCreateQuote={onCreateQuote}
      />

      <ActivityFeed 
        limit={5}
        onViewAll={() => onNavigate?.('/notifications')}
      />
    </div>
  );
}
