import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Calendar,
  DollarSign,
  Users,
  AlertCircle,
  ExternalLink,
  Briefcase,
  MapPin,
  CheckCircle2,
  Timer
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

// Types for time tracking
interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime?: string;
  jobId?: string;
  hourlyRate?: number;
  breakTime?: number;
  isBreak?: boolean;
  userId: string;
  jobTitle?: string;
  clientName?: string;
}

interface ActiveTimer {
  id: string;
  description: string;
  startTime: string;
  jobId?: string;
  elapsedSeconds: number;
}

// Timer Widget Component - Enhanced with brand colors, animations, GPS status
export function TimerWidget({ 
  jobId, 
  jobTitle, 
  onTimerStart, 
  onTimerStop,
  compact = false
}: {
  jobId?: string;
  jobTitle?: string;
  onTimerStart?: () => void;
  onTimerStop?: () => void;
  compact?: boolean;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'checking' | 'captured' | 'unavailable' | 'idle'>('idle');
  const { toast } = useToast();

  // Get active timer
  const { data: globalActiveTimer, isLoading } = useQuery({
    queryKey: ['/api/time-entries/active/current'],
    refetchInterval: 1000,
  });

  // Get ALL time entries for this job (not just today's) to show total time
  const { data: allTimeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['/api/time-entries', jobId],
    enabled: !!jobId,
  });

  // Filter to get today's entries for this job
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysJobEntries = jobId ? (allTimeEntries as TimeEntry[])
    .filter((entry: TimeEntry) => {
      if (entry.jobId !== jobId) return false;
      const entryDate = new Date(entry.startTime);
      return entryDate >= todayStart && entry.endTime;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  : [];

  // Calculate TOTAL time for this job (all time, not just today)
  const totalMinutesAllTime = jobId ? (allTimeEntries as TimeEntry[])
    .filter((entry: TimeEntry) => entry.jobId === jobId && entry.endTime)
    .reduce((total: number, entry: TimeEntry) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime!).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0)
  : 0;

  // Calculate total time today for this job
  const totalMinutesToday = todaysJobEntries.reduce((total: number, entry: TimeEntry) => {
    if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      return total + Math.floor((end - start) / 60000);
    }
    return total;
  }, 0);

  const latestCompletedEntry = todaysJobEntries[0];

  const activeTimer = jobId 
    ? (globalActiveTimer && (globalActiveTimer as any).jobId === jobId ? globalActiveTimer : null)
    : globalActiveTimer;

  // Check location when timer starts
  const captureLocation = () => {
    setLocationStatus('checking');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('captured'),
        () => setLocationStatus('unavailable'),
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setLocationStatus('unavailable');
    }
  };

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data: { description: string; jobId?: string; hourlyRate?: string }) => {
      return apiRequest('POST', '/api/time-entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      captureLocation();
      onTimerStart?.();
      toast({
        title: "Timer Started",
        description: "Time tracking has begun for this task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Timer Error",
        description: error?.message || "Failed to start timer",
        variant: "destructive",
      });
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      return apiRequest('POST', `/api/time-entries/${timerId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      setLocationStatus('idle');
      onTimerStop?.();
      toast({
        title: "Time Saved",
        description: "Your time has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Timer Error",
        description: error?.message || "Failed to stop timer",
        variant: "destructive",
      });
    },
  });

  // Delete time entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest('DELETE', `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Entry Deleted",
        description: "Time entry removed. You can start a new timer.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error?.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // If timer is active but location wasn't captured, try now
  useEffect(() => {
    if (activeTimer && locationStatus === 'idle') {
      captureLocation();
    }
  }, [activeTimer]);

  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleStartTimer = () => {
    if (globalActiveTimer) {
      if (jobId && (globalActiveTimer as any).jobId !== jobId) {
        toast({
          title: "Timer Already Running",
          description: `Stop the current timer for "${(globalActiveTimer as any).description || 'another job'}" before starting a new one.`,
          variant: "destructive",
        });
        return;
      }
      if (!jobId || (globalActiveTimer as any).jobId === jobId) {
        toast({
          title: "Timer Already Running", 
          description: "A timer is already active. Stop it before starting a new one.",
          variant: "destructive",
        });
        return;
      }
    }

    const description = jobTitle ? `Working on ${jobTitle}` : 'General work';
    startTimerMutation.mutate({
      description,
      ...(jobId && { jobId }),
      hourlyRate: '85.00',
    });
  };

  const handleStopTimer = () => {
    if (activeTimer && typeof activeTimer === 'object' && 'id' in activeTimer && activeTimer.id) {
      stopTimerMutation.mutate(activeTimer.id as string);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    if (window.confirm('Delete this time entry? You can then start a new timer.')) {
      deleteEntryMutation.mutate(entryId);
    }
  };

  // GPS Location status indicator
  const LocationIndicator = () => {
    if (locationStatus === 'idle') return null;
    return (
      <div className="flex items-center justify-center gap-1 text-xs mt-2" data-testid="location-status">
        {locationStatus === 'checking' && (
          <>
            <MapPin className="h-3 w-3 text-muted-foreground animate-pulse" />
            <span className="text-muted-foreground">Capturing location...</span>
          </>
        )}
        {locationStatus === 'captured' && (
          <>
            <MapPin className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">Location captured</span>
          </>
        )}
        {locationStatus === 'unavailable' && (
          <>
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Location unavailable</span>
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4" data-testid="timer-loading-state">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ACTIVE TIMER STATE - Enhanced with pulsing animation and brand colors
  if (activeTimer && typeof activeTimer === 'object' && 'startTime' in activeTimer) {
    return (
      <div 
        className="relative rounded-xl overflow-hidden" 
        style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
        data-testid="timer-running-state"
      >
        {/* Pulsing border animation */}
        <div 
          className="absolute inset-0 rounded-xl animate-pulse"
          style={{ 
            border: '2px solid hsl(var(--trade) / 0.5)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
        
        <div className="relative p-4 space-y-3">
          {/* Live timer display */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full animate-pulse" 
                style={{ backgroundColor: 'hsl(var(--trade))' }}
              />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--trade))' }}>
                Timer Running
              </span>
            </div>
            <div 
              className="text-4xl font-mono font-bold tracking-wider" 
              style={{ color: 'hsl(var(--trade))' }}
              data-testid="text-elapsed-time"
            >
              {getElapsedTime(activeTimer.startTime as string)}
            </div>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-timer-description">
              {(activeTimer as any).description || 'Working...'}
            </p>
            <LocationIndicator />
          </div>

          {/* Total time on job */}
          {totalMinutesAllTime > 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
              <Clock className="h-3 w-3" />
              <span>Total on job: {formatDuration(totalMinutesAllTime)}</span>
            </div>
          )}
          
          {/* Stop button - prominent */}
          <Button 
            variant="destructive" 
            className="w-full h-12 text-base font-semibold" 
            onClick={handleStopTimer}
            disabled={stopTimerMutation.isPending}
            data-testid="button-stop-timer"
          >
            <Square className="h-5 w-5 mr-2" />
            {stopTimerMutation.isPending ? 'Saving...' : 'Clock Out'}
          </Button>
        </div>
      </div>
    );
  }

  // SAVED TIME STATE - Show today's entries and allow adding more
  if (jobId && todaysJobEntries.length > 0) {
    return (
      <div className="space-y-3" data-testid="timer-saved-state">
        {/* Today's summary */}
        <div 
          className="rounded-xl p-4"
          style={{ backgroundColor: 'hsl(var(--trade) / 0.08)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
              >
                <Timer className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div>
                <div className="text-lg font-bold" data-testid="text-time-saved">
                  {formatDuration(totalMinutesToday)}
                </div>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
            {totalMinutesAllTime !== totalMinutesToday && (
              <div className="text-right">
                <div className="text-sm font-medium text-muted-foreground">
                  {formatDuration(totalMinutesAllTime)}
                </div>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            )}
          </div>

          {/* Today's entries quick view */}
          <div className="border-t border-border/50 pt-2 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Today's entries:</p>
            <div className="space-y-1">
              {todaysJobEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {format(new Date(entry.startTime), 'h:mm a')} - {entry.endTime ? format(new Date(entry.endTime), 'h:mm a') : 'Now'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatDuration(Math.floor((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / 60000))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={deleteEntryMutation.isPending}
                      data-testid={`button-delete-entry-${entry.id}`}
                    >
                      <AlertCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {todaysJobEntries.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{todaysJobEntries.length - 3} more entries
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Add more time button */}
        <Button 
          className="w-full h-12 text-base font-semibold text-white" 
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          onClick={handleStartTimer}
          disabled={startTimerMutation.isPending || !!globalActiveTimer}
          data-testid="button-start-timer"
        >
          <Play className="h-5 w-5 mr-2" />
          Clock In Again
        </Button>
        
        {globalActiveTimer && (globalActiveTimer as any).jobId !== jobId && (
          <p className="text-xs text-center text-amber-600">
            Timer running on another job
          </p>
        )}
      </div>
    );
  }

  // READY TO START STATE
  return (
    <div className="space-y-3" data-testid="timer-ready-state">
      {/* Total time on job (if any previous entries exist) */}
      {totalMinutesAllTime > 0 && (
        <div 
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ backgroundColor: 'hsl(var(--trade) / 0.08)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            <span className="text-sm font-medium">Total on job:</span>
          </div>
          <span className="font-bold">{formatDuration(totalMinutesAllTime)}</span>
        </div>
      )}
      
      <div className="text-center py-2">
        <div className="text-3xl font-mono text-muted-foreground mb-1">
          00:00:00
        </div>
        <p className="text-sm text-muted-foreground">
          Ready to track time
        </p>
      </div>
      
      <Button 
        className="w-full h-12 text-base font-semibold text-white" 
        style={{ backgroundColor: 'hsl(var(--trade))' }}
        onClick={handleStartTimer}
        disabled={startTimerMutation.isPending || !!globalActiveTimer}
        data-testid="button-start-timer"
      >
        <Play className="h-5 w-5 mr-2" />
        Clock In
      </Button>
      
      {globalActiveTimer && (globalActiveTimer as any).jobId !== jobId && (
        <p className="text-xs text-center text-amber-600">
          Timer running on another job
        </p>
      )}
    </div>
  );
}

// Timesheet List Component
export function TimesheetList({ 
  showJobInfo = true,
  limit = 10 
}: {
  showJobInfo?: boolean;
  limit?: number;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Get time entries
  const { data: timeEntries, isLoading, error } = useQuery({
    queryKey: ['/api/time-entries'],
  });

  // Delete time entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest('DELETE', `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Entry Deleted",
        description: "Time entry has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error?.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return `${hours.toFixed(2)}h`;
  };

  const calculateEarnings = (startTime: string, endTime?: string, hourlyRate?: number) => {
    if (!endTime || !hourlyRate) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours * hourlyRate;
  };

  if (isLoading) {
    return (
      <Card className="w-full" data-testid="card-timesheet-loading">
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-timesheet-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load time entries. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const entriesToShow = Array.isArray(timeEntries) ? timeEntries.slice(0, limit) : [];

  return (
    <Card className="w-full" data-testid="card-timesheet-list">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Recent Time Entries
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entriesToShow.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-entries">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No time entries yet</p>
            <p className="text-sm">Start a timer to begin tracking your work</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entriesToShow.map((entry: TimeEntry) => (
              <div 
                key={entry.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`row-time-entry-${entry.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate" data-testid={`text-entry-description-${entry.id}`}>
                      {entry.description}
                    </h4>
                    {!entry.endTime && (
                      <Badge variant="outline" className="text-success border-success">
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  {showJobInfo && entry.jobTitle && (
                    <div className="flex items-center gap-1 mb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-sm text-muted-foreground hover:text-primary"
                        onClick={() => entry.jobId && setLocation(`/jobs/${entry.jobId}`)}
                        data-testid={`button-view-job-${entry.id}`}
                      >
                        <Briefcase className="h-3 w-3 mr-1" />
                        Job: {entry.jobTitle}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      {entry.clientName && (
                        <span className="text-sm text-muted-foreground">• {entry.clientName}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span data-testid={`text-start-time-${entry.id}`}>
                      {format(new Date(entry.startTime), 'MMM d, h:mm a')}
                    </span>
                    {entry.endTime && (
                      <>
                        <span>→</span>
                        <span data-testid={`text-end-time-${entry.id}`}>
                          {format(new Date(entry.endTime), 'h:mm a')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="font-medium" data-testid={`text-duration-${entry.id}`}>
                      {formatDuration(entry.startTime, entry.endTime)}
                    </div>
                    {entry.endTime && entry.hourlyRate && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1" data-testid={`text-earnings-${entry.id}`}>
                        <DollarSign className="h-3 w-3" />
                        ${calculateEarnings(entry.startTime, entry.endTime, entry.hourlyRate)?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {entry.endTime && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntryMutation.mutate(entry.id)}
                      disabled={deleteEntryMutation.isPending}
                      data-testid={`button-delete-entry-${entry.id}`}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Time Tracking Dashboard Component
export function TimeTrackingDashboard() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/time-tracking/dashboard'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border rounded-md p-4" data-testid="card-dashboard-loading">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-8 w-12 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const safeDashboard = dashboard as any || {};
  const todayData = safeDashboard.today || {};
  const weekData = safeDashboard.week || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-today-hours"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Clock 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {typeof todayData.totalHours === 'number' ? todayData.totalHours.toFixed(1) : '0.0'}h
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Today
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-week-hours"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Calendar 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {typeof weekData.totalHours === 'number' ? weekData.totalHours.toFixed(1) : '0.0'}h
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                This Week
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-active-jobs"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Users 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {safeDashboard.activeJobs || 0}
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Active Jobs
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-avg-rate"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <DollarSign 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                ${typeof safeDashboard.averageRate === 'number' ? safeDashboard.averageRate.toFixed(0) : '0'}/hr
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Avg Rate
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}