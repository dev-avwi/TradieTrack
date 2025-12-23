import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useAppMode } from "@/hooks/use-app-mode";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import UpgradeToTeamCard from "./UpgradeToTeamCard";
import AIAssistant from "./AIAssistant";
import { 
  Briefcase, 
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Camera,
  Calendar,
  Sparkles,
  Plus,
  Play,
  Square,
  MapPinCheck,
  Timer,
  CheckCircle2,
  Navigation,
  PhoneCall,
  Wrench,
  Flag,
  ChevronDown
} from "lucide-react";

interface TradieDashboardProps {
  userName?: string;
  onViewJob?: (id: string) => void;
  onViewJobs?: () => void;
  onOpenTeamChat?: () => void;
  onNavigate?: (path: string) => void;
}

export default function TradieDashboard({
  userName = "there",
  onViewJob,
  onViewJobs,
  onOpenTeamChat,
  onNavigate
}: TradieDashboardProps) {
  const { toast } = useToast();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const { data: businessSettings } = useBusinessSettings();
  const { isTeam, shouldShowLocationCheckin } = useAppMode();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: myJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs/my-jobs"],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch active time entry across all jobs
  const { data: activeTimeEntry } = useQuery<any>({
    queryKey: ["/api/time-entries/active/current"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch today's time entries for summary using time-tracking dashboard
  const { data: timeTrackingData } = useQuery<any>({
    queryKey: ["/api/time-tracking/dashboard"],
    staleTime: 60000, // 1 minute
  });
  
  const todaysTimeEntries = timeTrackingData?.recentEntries || [];

  // Calculate total time worked today
  const totalMinutesToday = todaysTimeEntries.reduce((total: number, entry: any) => {
    if (entry.duration) return total + entry.duration;
    if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      return total + Math.floor((end - start) / 60000);
    }
    return total;
  }, 0);

  // Format elapsed time for active entry - use elapsedSeconds as trigger for re-render
  const formatElapsedTime = () => {
    if (!activeTimeEntry) return "00:00:00";
    const startTime = new Date(activeTimeEntry.startTime).getTime();
    // elapsedSeconds is only used to trigger re-renders, we compute fresh elapsed time
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update elapsed time every second when timer is running
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

  // Start timer mutation - use existing /api/time-entries endpoint
  const startTimer = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, startTime: new Date().toISOString() }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start timer');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant time tracking queries
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Timer started", description: "Time tracking is now active" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start timer", description: error.message, variant: "destructive" });
    },
  });

  // Stop timer mutation - use existing PUT /api/time-entries/:id endpoint
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
        body: JSON.stringify({ 
          endTime: endTime.toISOString(),
          duration: durationMinutes
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to stop timer');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant time tracking queries
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Timer stopped", description: "Time has been recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop timer", description: error.message, variant: "destructive" });
    },
  });

  // Get current GPS position helper
  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 60000 
      });
    });
  };

  // Record location check-in (non-blocking but surfaces errors)
  const recordCheckin = async (jobId: string, type: 'arrival' | 'start' | 'completion') => {
    try {
      const position = await getCurrentPosition();
      const response = await fetch('/api/job-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId,
          type,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
          accuracy: position.coords.accuracy.toString(),
        }),
      });
      if (response.ok) {
        return { success: true };
      } else {
        console.warn('GPS check-in API failed, continuing anyway');
        return { success: false, error: 'Server error' };
      }
    } catch (error: any) {
      // Surface GPS errors but don't block the job action
      if (error.message?.includes('Location not supported')) {
        return { success: false, error: 'Location not supported on this device' };
      }
      console.warn('GPS check-in failed:', error.message);
      return { success: false, error: 'Could not get location' };
    }
  };

  // "I've Arrived" - Check in at job site (for scheduled jobs)
  const arriveAtJob = useMutation({
    mutationFn: async (job: any) => {
      setIsCheckingIn(true);
      // Record arrival location (surfaces GPS result for feedback)
      const gpsResult = await recordCheckin(job.id, 'arrival');
      return { job, gpsSuccess: gpsResult.success, gpsError: gpsResult.success ? null : gpsResult.error };
    },
    onSuccess: ({ job, gpsSuccess, gpsError }) => {
      toast({ 
        title: "Arrived at job site", 
        description: gpsSuccess 
          ? `Ready to start work on: ${job.title} (location recorded)` 
          : `Ready to start: ${job.title}${gpsError ? ` (${gpsError})` : ''}`
      });
      // Invalidate ALL job-related queries for immediate UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/this-week'] });
    },
    onError: () => {
      toast({ title: "Check-in failed", variant: "destructive" });
    },
    onSettled: () => setIsCheckingIn(false),
  });

  // "Start Work" - Begin job + start timer (ATOMIC with rollback on failure)
  const startWork = useMutation({
    mutationFn: async (job: any) => {
      // Record start location (surfaces GPS result for feedback)
      const gpsResult = await recordCheckin(job.id, 'start');
      
      // Start timer FIRST
      const timerResponse = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: job.id, startTime: new Date().toISOString() }),
      });
      if (!timerResponse.ok) {
        const error = await timerResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Timer failed to start');
      }
      
      const timerData = await timerResponse.json().catch(() => null);
      
      // Timer started - now update job status
      const statusResponse = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      
      if (!statusResponse.ok) {
        // ROLLBACK: Status change failed, stop the timer we just started
        if (timerData?.id) {
          await fetch(`/api/time-entries/${timerData.id}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {}); // Best effort rollback
        }
        const error = await statusResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update job status');
      }
      
      return { job, gpsSuccess: gpsResult.success };
    },
    onSuccess: ({ job, gpsSuccess }) => {
      toast({ 
        title: "Work started!", 
        description: gpsSuccess 
          ? `Timer is running for: ${job.title} (location recorded)` 
          : `Timer is running for: ${job.title}`
      });
      // Invalidate ALL job-related queries for immediate UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/this-week'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
    },
    onError: (error: any) => {
      // Invalidate time entries in case rollback happened
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      toast({ 
        title: "Failed to start work", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  // "Complete Job" - Finish job + stop timer (ATOMIC: status first, then timer)
  // Rationale: Update status first so if timer fails, job is still marked done
  // and timer can be handled separately (preferable to timer stopped but job stuck)
  const completeJob = useMutation({
    mutationFn: async (job: any) => {
      // Record completion location with GPS (surfaces result for feedback)
      const gpsResult = await recordCheckin(job.id, 'completion');
      
      // Update job status to done FIRST
      const statusResponse = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'done' }),
      });
      
      if (!statusResponse.ok) {
        const error = await statusResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to complete job');
      }
      
      // Job status updated successfully, now stop any running timer
      let timerStopFailed = false;
      if (activeTimeEntry && activeTimeEntry.jobId === job.id) {
        const endTime = new Date();
        const startTime = new Date(activeTimeEntry.startTime);
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
        
        const timerResponse = await fetch(`/api/time-entries/${activeTimeEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endTime: endTime.toISOString(), duration: durationMinutes }),
        });
        if (!timerResponse.ok) {
          timerStopFailed = true;
          // Don't throw - job is already done, timer issue is secondary
        }
      }
      
      return { job, gpsSuccess: gpsResult.success, timerStopFailed };
    },
    onSuccess: ({ job, gpsSuccess, timerStopFailed }) => {
      if (timerStopFailed) {
        toast({ 
          title: "Job completed!", 
          description: `${job.title} done, but timer failed to stop. Please check timesheets.`,
          variant: "default"
        });
      } else {
        toast({ 
          title: "Job completed!", 
          description: gpsSuccess 
            ? `Great work on: ${job.title} (location recorded)` 
            : `Great work on: ${job.title}`
        });
      }
      // Invalidate ALL job-related queries for immediate UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/this-week'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to complete job", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  // Legacy location check-in handler (for backwards compatibility)
  const handleLocationCheckin = async (jobId: string) => {
    setIsCheckingIn(true);
    try {
      await recordCheckin(jobId, 'arrival');
      toast({ 
        title: "Checked in!", 
        description: "Your location has been recorded for this job" 
      });
    } catch (error: any) {
      toast({ 
        title: "Check-in failed", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Get the primary action for a job based on its status
  const getJobAction = (job: any) => {
    const isTimerRunningOnJob = activeTimeEntry && activeTimeEntry.jobId === job.id;
    
    switch (job.status) {
      case 'scheduled':
        return {
          label: "Start Work",
          icon: Wrench,
          action: () => startWork.mutate(job),
          isPending: startWork.isPending,
          variant: 'default' as const,
          style: { backgroundColor: 'hsl(var(--trade))' },
        };
      case 'in_progress':
        return {
          label: isTimerRunningOnJob ? "Complete Job" : "Complete Job",
          icon: CheckCircle2,
          action: () => completeJob.mutate(job),
          isPending: completeJob.isPending,
          variant: 'default' as const,
          style: { backgroundColor: 'hsl(142.1 76.2% 36.3%)' }, // green
        };
      case 'done':
        return {
          label: "View Details",
          icon: Briefcase,
          action: () => onViewJob?.(job.id),
          isPending: false,
          variant: 'outline' as const,
          style: {},
        };
      default:
        return {
          label: "Open Job",
          icon: Briefcase,
          action: () => onViewJob?.(job.id),
          isPending: false,
          variant: 'outline' as const,
          style: {},
        };
    }
  };
  
  // Check if this is a solo business (no team)
  const isSoloBusiness = businessSettings?.teamSize === 'solo' || !businessSettings?.teamSize;

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Get next job (first pending or in-progress job)
  const nextJob = todaysJobs.find((job: any) => 
    job.status === 'pending' || job.status === 'in_progress'
  ) || todaysJobs[0];

  // Get this week's jobs
  const { data: weekJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs/this-week"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <PageShell data-testid="tradie-dashboard">
      <PageHeader
        title={`${getGreeting()}, ${userName}`}
        subtitle="Here's what you have today"
      />

      {/* Time Tracking Widget - Prominent for Tradies */}
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
            
            <div className="flex gap-2">
              {activeTimeEntry ? (
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
              ) : nextJob ? (
                <Button
                  size="lg"
                  onClick={() => startTimer.mutate(nextJob.id)}
                  disabled={startTimer.isPending}
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  data-testid="button-start-timer"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate?.('/time-tracking')}
                  data-testid="button-view-timesheet"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Timesheet
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Assistant - Collapsible Section */}
      <section data-testid="ai-assistant-section">
        <Collapsible open={isAIAssistantOpen} onOpenChange={setIsAIAssistantOpen}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger asChild>
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
                style={{ 
                  background: 'linear-gradient(135deg, hsl(var(--trade) / 0.1) 0%, hsl(var(--trade) / 0.05) 100%)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
                  >
                    <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base">AI Assistant</h2>
                    <p className="text-xs text-muted-foreground">Ask me anything about your business</p>
                  </div>
                </div>
                <ChevronDown 
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isAIAssistantOpen ? 'rotate-180' : ''}`} 
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <AIAssistant onNavigate={onNavigate} embedded={true} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </section>

      {/* Next Job Card - Real-World Actions */}
      {nextJob ? (
        <Card className="border-2 border-primary/20" data-testid="next-job-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">
                {nextJob.status === 'in_progress' ? 'Current Job' : 'Next Job'}
              </CardTitle>
              <Badge 
                variant={nextJob.status === 'in_progress' ? 'default' : 'secondary'}
                style={nextJob.status === 'in_progress' ? { backgroundColor: 'hsl(var(--trade))' } : {}}
              >
                {nextJob.status === 'in_progress' ? 'In Progress' : 
                 nextJob.status === 'scheduled' ? 'Scheduled' : nextJob.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-xl">{nextJob.title}</h3>
              
              {nextJob.scheduledAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(nextJob.scheduledAt)}</span>
                </div>
              )}
              
              {nextJob.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="line-clamp-1">{nextJob.address}</span>
                </div>
              )}
              
              {nextJob.clientName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{nextJob.clientName}</span>
                </div>
              )}
            </div>

            {/* One-Tap Real-World Actions */}
            <div className="grid grid-cols-2 gap-2">
              {/* Primary Action - Start Work or Complete Job */}
              {(() => {
                const action = getJobAction(nextJob);
                const ActionIcon = action.icon;
                return (
                  <Button 
                    onClick={action.action}
                    disabled={action.isPending}
                    variant={action.variant}
                    style={action.style}
                    className="col-span-2"
                    size="lg"
                    data-testid="button-primary-job-action"
                  >
                    <ActionIcon className="h-5 w-5 mr-2" />
                    {action.isPending ? 'Processing...' : action.label}
                  </Button>
                );
              })()}
              
              {/* Quick Actions Row */}
              {nextJob.clientPhone && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`tel:${nextJob.clientPhone}`)}
                  data-testid="button-call-client"
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
              
              {nextJob.address && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(nextJob.address)}`)}
                  data-testid="button-navigate"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate
                </Button>
              )}
              
              {/* View Details */}
              {onViewJob && (
                <Button 
                  variant="ghost"
                  onClick={() => onViewJob(nextJob.id)}
                  data-testid="button-view-job-details"
                  className={!nextJob.clientPhone || !nextJob.address ? 'col-span-2' : ''}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Details
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="no-next-job-card">
          <CardContent className="py-8 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-muted-foreground">No jobs scheduled for today</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isSoloBusiness 
                ? "Create a new job to get started" 
                : "Check with your manager for assignments"}
            </p>
            {isSoloBusiness && onNavigate && (
              <Button 
                size="sm" 
                className="mt-4"
                onClick={() => onNavigate('/jobs/new')}
                data-testid="button-create-first-job"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Jobs Today */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Jobs Today</h2>
          {todaysJobs.length > 0 && (
            <Badge variant="outline">{todaysJobs.length} {todaysJobs.length === 1 ? 'job' : 'jobs'}</Badge>
          )}
        </div>

        {todaysJobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No jobs assigned to you today</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todaysJobs.map((job: any) => (
              <Card 
                key={job.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => onViewJob && onViewJob(job.id)}
                data-testid={`my-job-card-${job.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">{job.title}</CardTitle>
                    <Badge 
                      variant={job.status === 'done' ? 'default' : job.status === 'in_progress' ? 'secondary' : 'outline'}
                      className="flex-shrink-0"
                    >
                      {job.status === 'done' ? 'Done' : job.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {job.scheduledAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(job.scheduledAt)}</span>
                    </div>
                  )}
                  {job.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{job.address}</span>
                    </div>
                  )}
                  {job.clientName && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{job.clientName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card data-testid="tradie-quick-actions">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {onViewJobs && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onViewJobs}
              data-testid="button-view-all-jobs"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              All Jobs
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              const event = new CustomEvent('openAIChat');
              window.dispatchEvent(event);
            }}
            data-testid="button-ask-ai"
            style={{
              backgroundColor: 'hsl(var(--trade) / 0.05)',
              borderColor: 'hsl(var(--trade) / 0.3)'
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" style={{ color: 'hsl(var(--trade))' }} />
            Ask AI
          </Button>
          {onOpenTeamChat && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onOpenTeamChat}
              data-testid="button-open-team-chat"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Team
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              if (nextJob && onViewJob) {
                onViewJob(nextJob.id);
              } else if (onViewJobs) {
                onViewJobs();
              }
            }}
            data-testid="button-upload-photos"
          >
            <Camera className="h-4 w-4 mr-2" />
            Photos
          </Button>
        </CardContent>
      </Card>

      {/* Upgrade to Team Mode (for solo tradies) */}
      <UpgradeToTeamCard onNavigate={onNavigate} />

      {/* This Week's Jobs (Optional) */}
      {weekJobs.length > 0 && (
        <Card data-testid="week-jobs-section">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">This Week</CardTitle>
              <Badge variant="outline">{weekJobs.length} jobs</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weekJobs.slice(0, 5).map((job: any) => (
                <div 
                  key={job.id}
                  className="flex items-center justify-between p-2 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => onViewJob && onViewJob(job.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.scheduledAt).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
