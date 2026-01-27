import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { 
  Briefcase, 
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Calendar,
  Play,
  Square,
  Timer,
  CheckCircle2,
  Navigation,
  Wrench,
  ChevronRight,
  AlertCircle,
  Users,
  Bell,
  TrendingUp,
  Target,
  Award,
  DollarSign,
  FileText,
  Receipt,
  FolderOpen,
  Zap
} from "lucide-react";

interface StaffTradieDashboardProps {
  userName?: string;
  onViewJob?: (id: string) => void;
  onViewJobs?: () => void;
  onOpenTeamChat?: () => void;
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
  description?: string;
}

export default function StaffTradieDashboard({
  userName = "there",
  onViewJob,
  onViewJobs,
  onOpenTeamChat,
  onNavigate
}: StaffTradieDashboardProps) {
  const { toast } = useToast();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user session data including worker permissions
  const { data: userSession } = useQuery<{
    workerPermissions?: string[];
    role?: string;
  }>({
    queryKey: ["/api/auth/me"],
    staleTime: 300000,
  });

  // Helper function to check if user has a specific permission
  const hasPermission = (permission: string): boolean => {
    if (!userSession?.workerPermissions) return false;
    // Handle wildcard "*" permission (Administrator and other full-access roles)
    if (userSession.workerPermissions.includes('*')) return true;
    return userSession.workerPermissions.includes(permission);
  };

  // Check if any quick action permissions are available
  // Note: Log Hours is always available for staff
  const hasAnyQuickActionPermission = true; // Always show quick actions for basic features

  // Fetch only jobs assigned to this user
  const { data: myJobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my-jobs"],
    staleTime: 60000,
  });

  // Fetch available jobs for assignment (if user has permission)
  const { data: availableJobs = [], isLoading: availableJobsLoading } = useQuery<Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    scheduledAt: string | null;
    scheduledEndAt: string | null;
    estimatedDuration: number | null;
    priority: string | null;
    suburb: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/jobs/available"],
    staleTime: 60000,
    enabled: hasPermission('request_job_assignment'),
  });

  // Request job assignment mutation
  const requestAssignment = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason?: string }) => {
      const response = await fetch(`/api/jobs/${jobId}/request-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request assignment');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your job assignment request has been sent to the business owner.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-assignment-requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch active time entry
  const { data: activeTimeEntry } = useQuery<any>({
    queryKey: ["/api/time-entries/active/current"],
    refetchInterval: 30000,
  });

  // Fetch today's time tracking data
  const { data: timeTrackingData } = useQuery<any>({
    queryKey: ["/api/time-tracking/dashboard"],
    staleTime: 60000,
  });

  const todaysTimeEntries = timeTrackingData?.recentEntries || [];
  const totalMinutesToday = todaysTimeEntries.reduce((total: number, entry: any) => {
    if (entry.duration) return total + entry.duration;
    if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      return total + Math.floor((end - start) / 60000);
    }
    return total;
  }, 0);

  // Calculate weekly stats from jobs
  const getWeeklyStats = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    
    // Count jobs scheduled this week that are completed
    const completedThisWeek = myJobs.filter(job => {
      if (job.status !== 'done' && job.status !== 'invoiced') return false;
      // Filter by scheduled date being this week (best proxy for completion date)
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate >= startOfWeek && jobDate < endOfWeek;
    });
    
    // Count all jobs scheduled this week (regardless of status)
    const scheduledThisWeek = myJobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate >= startOfWeek && jobDate < endOfWeek;
    });
    
    // Use actual time tracking data
    const hoursWorked = Math.floor(totalMinutesToday / 60);
    
    return {
      completedCount: completedThisWeek.length,
      scheduledCount: scheduledThisWeek.length,
      weeklyHours: hoursWorked,
    };
  };
  
  const weeklyStats = getWeeklyStats();

  // Format elapsed time
  const formatElapsedTime = () => {
    if (!activeTimeEntry) return "00:00:00";
    const startTime = new Date(activeTimeEntry.startTime).getTime();
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update timer every second
  useEffect(() => {
    if (activeTimeEntry) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedSeconds(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimeEntry]);

  // Start work mutation
  const startWork = useMutation({
    mutationFn: async (job: Job) => {
      // Start timer
      const timerResponse = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: job.id, startTime: new Date().toISOString() }),
      });
      if (!timerResponse.ok) {
        const error = await timerResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start timer');
      }
      
      // Update job status (use staff-specific status endpoint)
      const statusResponse = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      
      if (!statusResponse.ok) {
        const error = await statusResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update job status');
      }
      
      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Work started!", description: `Timer running for: ${job.title}` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start", description: error.message, variant: "destructive" });
    },
  });

  // Stop timer mutation
  const stopTimer = useMutation({
    mutationFn: async () => {
      if (!activeTimeEntry) throw new Error('No active timer');
      const endTime = new Date();
      const startTime = new Date(activeTimeEntry.startTime);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      
      const response = await fetch(`/api/time-entries/${activeTimeEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endTime: endTime.toISOString(), duration: durationMinutes }),
      });
      if (!response.ok) throw new Error('Failed to stop timer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Timer stopped", description: "Time has been recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop", description: error.message, variant: "destructive" });
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit' 
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

  // Filter jobs by status
  const activeJobs = myJobs.filter(job => job.status !== 'done' && job.status !== 'invoiced');
  const todaysJobs = activeJobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  });
  
  // This week's jobs (next 7 days, excluding today)
  const thisWeeksJobs = activeJobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    return jobDate > today && jobDate <= endOfWeek && jobDate.toDateString() !== today.toDateString();
  });
  
  const upcomingJobs = activeJobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    const today = new Date();
    return jobDate > today && jobDate.toDateString() !== today.toDateString();
  });

  const nextJob = activeJobs.find(job => job.status === 'in_progress') || 
                  todaysJobs.find(job => job.status === 'scheduled') ||
                  todaysJobs[0];

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Complete</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Scheduled</Badge>;
  };

  return (
    <div className="w-full px-4 sm:px-5 py-5 sm:py-6 pb-28 space-y-6" data-testid="staff-tradie-dashboard">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {userName}
        </h1>
        <p className="text-muted-foreground">
          {activeJobs.length > 0 
            ? `You have ${activeJobs.length} assigned job${activeJobs.length > 1 ? 's' : ''}`
            : "Waiting for job assignments"}
        </p>
      </div>

      {/* Time Tracking Widget */}
      <Card 
        className="border-2" 
        style={{ borderColor: activeTimeEntry ? 'hsl(var(--trade))' : 'hsl(var(--border))' }}
        data-testid="time-tracking-widget"
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ 
                  backgroundColor: activeTimeEntry ? 'hsl(var(--trade) / 0.15)' : 'hsl(var(--muted))'
                }}
              >
                <Timer 
                  className="h-6 w-6" 
                  style={{ color: activeTimeEntry ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))' }}
                />
              </div>
              <div>
                {activeTimeEntry ? (
                  <>
                    <p className="text-2xl font-bold font-mono" style={{ color: 'hsl(var(--trade))' }}>
                      {formatElapsedTime()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Working on: {activeTimeEntry.jobTitle || 'Current job'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">
                      {Math.floor(totalMinutesToday / 60)}h {totalMinutesToday % 60}m today
                    </p>
                    <p className="text-sm text-muted-foreground">No active timer</p>
                  </>
                )}
              </div>
            </div>
            
            {activeTimeEntry && (
              <Button
                size="lg"
                variant="destructive"
                onClick={() => stopTimer.mutate()}
                disabled={stopTimer.isPending}
                data-testid="button-stop-timer"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary Stats */}
      <section className="space-y-3" data-testid="weekly-summary-section">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          This Week
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-muted/30" data-testid="stat-completed">
            <CardContent className="py-4 px-3 text-center">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)' }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
              </div>
              <p className="text-2xl font-bold">{weeklyStats.completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30" data-testid="stat-scheduled">
            <CardContent className="py-4 px-3 text-center">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
              >
                <Target className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <p className="text-2xl font-bold">{weeklyStats.scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30" data-testid="stat-hours">
            <CardContent className="py-4 px-3 text-center">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: 'hsl(var(--muted))' }}
              >
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{weeklyStats.weeklyHours}<span className="text-base font-normal">h</span></p>
              <p className="text-xs text-muted-foreground">Hours</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions - Permission Gated */}
      {hasAnyQuickActionPermission && (
        <section className="space-y-3" data-testid="quick-actions-section">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Log Hours - Always Available */}
            <Card className="hover-elevate active-elevate-2" data-testid="quick-action-log-hours">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"
                onClick={() => onNavigate?.('/time-tracking')}
                data-testid="button-log-hours"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(220 70% 50% / 0.15)' }}
                >
                  <Timer className="h-6 w-6" style={{ color: 'hsl(220 70% 50%)' }} />
                </div>
                <span className="text-sm font-medium">Log Hours</span>
              </Button>
            </Card>
            
            {hasPermission('collect_payments') && (
              <Card className="hover-elevate active-elevate-2" data-testid="quick-action-collect-payment">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"
                  onClick={() => onNavigate?.('/payments')}
                  data-testid="button-collect-payment"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)' }}
                  >
                    <DollarSign className="h-6 w-6" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
                  </div>
                  <span className="text-sm font-medium">Collect Payment</span>
                </Button>
              </Card>
            )}
            
            {hasPermission('create_quotes') && (
              <Card className="hover-elevate active-elevate-2" data-testid="quick-action-create-quote">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"
                  onClick={() => onNavigate?.('/quotes/new')}
                  data-testid="button-create-quote"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
                  >
                    <FileText className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <span className="text-sm font-medium">Create Quote</span>
                </Button>
              </Card>
            )}
            
            {hasPermission('create_invoices') && (
              <Card className="hover-elevate active-elevate-2" data-testid="quick-action-create-invoice">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"
                  onClick={() => onNavigate?.('/invoices/new')}
                  data-testid="button-create-invoice"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(35 90% 55% / 0.15)' }}
                  >
                    <Receipt className="h-6 w-6" style={{ color: 'hsl(35 90% 55%)' }} />
                  </div>
                  <span className="text-sm font-medium">Create Invoice</span>
                </Button>
              </Card>
            )}
            
            {(hasPermission('view_invoices') || hasPermission('view_quotes')) && (
              <Card className="hover-elevate active-elevate-2" data-testid="quick-action-view-documents">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 flex flex-col items-center gap-2 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"
                  onClick={() => onNavigate?.('/documents')}
                  data-testid="button-view-documents"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                  >
                    <FolderOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">View Documents</span>
                </Button>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* No Jobs Assigned */}
      {activeJobs.length === 0 && (
        <Card className="border-dashed" data-testid="no-jobs-assigned">
          <CardContent className="py-12 text-center">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
            >
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Jobs Assigned Yet</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
              Your manager will assign jobs to you. You'll see them here when they do.
            </p>
            {onOpenTeamChat && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onOpenTeamChat}
                data-testid="button-open-team-chat"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Team Chat
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current/Next Job */}
      {nextJob && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {nextJob.status === 'in_progress' ? 'Current Job' : 'Next Job'}
          </h2>
          
          <Card 
            className="border-2"
            style={{ borderColor: nextJob.status === 'in_progress' ? 'hsl(var(--trade))' : 'hsl(var(--border))' }}
            data-testid="current-job-card"
          >
            <CardContent className="py-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getStatusBadge(nextJob.status)}
                    {nextJob.scheduledAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(nextJob.scheduledAt)} {formatTime(nextJob.scheduledAt)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg">{nextJob.title}</h3>
                </div>
              </div>

              {(nextJob.clientName || nextJob.address) && (
                <div className="space-y-2">
                  {nextJob.clientName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4 flex-shrink-0" />
                      <span>{nextJob.clientName}</span>
                    </div>
                  )}
                  {nextJob.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{nextJob.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                {nextJob.clientPhone && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-w-[100px] h-10 rounded-xl"
                      onClick={() => window.location.href = `tel:${nextJob.clientPhone}`}
                      data-testid="button-call-client"
                    >
                      <Phone className="h-4 w-4 mr-1.5" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-w-[100px] h-10 rounded-xl"
                      onClick={() => window.location.href = `sms:${nextJob.clientPhone}`}
                      data-testid="button-sms-client"
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      SMS
                    </Button>
                  </>
                )}
                {nextJob.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[100px] h-10 rounded-xl"
                    onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(nextJob.address!)}`, '_blank')}
                    data-testid="button-navigate"
                  >
                    <Navigation className="h-4 w-4 mr-1.5" />
                    Navigate
                  </Button>
                )}
              </div>

              {/* Primary Action */}
              {nextJob.status === 'scheduled' || nextJob.status === 'pending' ? (
                <Button
                  size="lg"
                  className="w-full h-12 text-white font-semibold rounded-xl"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={() => startWork.mutate(nextJob)}
                  disabled={startWork.isPending}
                  data-testid="button-start-work"
                >
                  <Wrench className="h-5 w-5 mr-2" />
                  Start Work
                </Button>
              ) : nextJob.status === 'in_progress' ? (
                <Button
                  size="lg"
                  className="w-full h-12 text-white font-semibold rounded-xl"
                  style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)' }}
                  onClick={() => onViewJob?.(nextJob.id)}
                  data-testid="button-go-complete-job"
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Go Complete Job
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 rounded-xl"
                  onClick={() => onViewJob?.(nextJob.id)}
                  data-testid="button-view-job"
                >
                  View Details
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Today's Jobs - Empty State when no jobs today but has upcoming */}
      {todaysJobs.length === 0 && activeJobs.length > 0 && (
        <section className="space-y-3" data-testid="today-empty-state">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today
          </h2>
          <Card className="border-dashed bg-muted/30">
            <CardContent className="py-6 text-center">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'hsl(var(--muted))' }}
              >
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No jobs scheduled for today</h3>
              <p className="text-sm text-muted-foreground">
                You've got {upcomingJobs.length} job{upcomingJobs.length > 1 ? 's' : ''} coming up. Enjoy your day off!
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Today's Jobs */}
      {todaysJobs.length > 1 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today's Schedule
            </h2>
            <Badge variant="secondary">{todaysJobs.length}</Badge>
          </div>
          
          <div className="space-y-2">
            {todaysJobs.filter(job => job.id !== nextJob?.id).map((job) => (
              <Card 
                key={job.id}
                className="cursor-pointer hover-elevate"
                onClick={() => onViewJob?.(job.id)}
                data-testid={`job-card-${job.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--muted))' }}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.scheduledAt && formatTime(job.scheduledAt)}
                          {job.clientName && ` - ${job.clientName}`}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* This Week Overview */}
      {thisWeeksJobs.length > 0 && (
        <section className="space-y-3" data-testid="this-week-section">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              This Week
            </h2>
            <Badge variant="secondary">{thisWeeksJobs.length} jobs</Badge>
          </div>
          
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="space-y-2">
                {thisWeeksJobs.slice(0, 5).map((job) => (
                  <div 
                    key={job.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-background/80 cursor-pointer transition-colors"
                    onClick={() => onViewJob?.(job.id)}
                    data-testid={`week-job-${job.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.scheduledAt && formatDate(job.scheduledAt)}
                        {job.clientName && ` - ${job.clientName}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
                {thisWeeksJobs.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={onViewJobs}
                    data-testid="button-view-all-week"
                  >
                    View all {thisWeeksJobs.length} jobs this week
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Upcoming Jobs (beyond this week) */}
      {upcomingJobs.length > thisWeeksJobs.length && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Later
            </h2>
            <Badge variant="secondary">{upcomingJobs.length - thisWeeksJobs.length}</Badge>
          </div>
          
          <div className="space-y-2">
            {upcomingJobs.filter(job => !thisWeeksJobs.some(wj => wj.id === job.id)).slice(0, 3).map((job) => (
              <Card 
                key={job.id}
                className="cursor-pointer hover-elevate"
                onClick={() => onViewJob?.(job.id)}
                data-testid={`upcoming-job-${job.id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.scheduledAt && formatDate(job.scheduledAt)}
                        {job.clientName && ` - ${job.clientName}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Available Jobs Section - For team members with request_job_assignment permission */}
      {hasPermission('request_job_assignment') && availableJobs.length > 0 && (
        <section className="space-y-3" data-testid="available-jobs-section">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4" />
              Available Jobs
            </h2>
            <Badge variant="outline">{availableJobs.length} available</Badge>
          </div>
          
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground mb-3">
                Request to be assigned to these jobs. Limited info shown for privacy.
              </p>
              <div className="space-y-2">
                {availableJobs.slice(0, 5).map((job) => (
                  <div 
                    key={job.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border"
                    data-testid={`available-job-${job.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{job.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {job.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.scheduledAt).toLocaleDateString()}
                          </span>
                        )}
                        {job.suburb && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.suburb}
                          </span>
                        )}
                        {job.estimatedDuration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.estimatedDuration}min
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => requestAssignment.mutate({ jobId: job.id })}
                      disabled={requestAssignment.isPending}
                      data-testid={`request-job-${job.id}`}
                    >
                      {requestAssignment.isPending ? (
                        <Clock className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-3 w-3 mr-1" />
                          Request
                        </>
                      )}
                    </Button>
                  </div>
                ))}
                {availableJobs.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    And {availableJobs.length - 5} more available...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Team Chat Button */}
      {onOpenTeamChat && (
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl"
          onClick={onOpenTeamChat}
          data-testid="button-team-chat"
        >
          <Users className="h-4 w-4 mr-2" />
          Team Chat
        </Button>
      )}
    </div>
  );
}
