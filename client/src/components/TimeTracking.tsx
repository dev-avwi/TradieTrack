import { useState, useEffect, useCallback } from "react";
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
  Navigation,
  Loader2
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

// GPS Location capture hook for mobile-first time tracking
function useGpsLocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const getLocation = useCallback((): Promise<{ 
    latitude: number; 
    longitude: number; 
    accuracy: number;
    address?: string;
  } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation not supported");
        resolve(null);
        return;
      }
      
      setIsLocating(true);
      setLocationError(null);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          
          // Try to get address via reverse geocoding (optional)
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
            );
            if (response.ok) {
              const data = await response.json();
              coords.address = data.display_name;
            }
          } catch (e) {
            // Ignore geocoding errors - location is still captured
          }
          
          setIsLocating(false);
          resolve(coords);
        },
        (error) => {
          setIsLocating(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError("Location access denied");
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError("Location unavailable");
              break;
            case error.TIMEOUT:
              setLocationError("Location request timed out");
              break;
            default:
              setLocationError("Could not get location");
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);
  
  return { getLocation, isLocating, locationError };
}

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

// Timer Widget Component with GPS location tracking
export function TimerWidget({ 
  jobId, 
  jobTitle, 
  onTimerStart, 
  onTimerStop 
}: {
  jobId?: string;
  jobTitle?: string;
  onTimerStart?: () => void;
  onTimerStop?: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastLocation, setLastLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const { toast } = useToast();
  const { getLocation, isLocating, locationError } = useGpsLocation();

  // Get active timer
  const { data: globalActiveTimer, isLoading } = useQuery({
    queryKey: ['/api/time-entries/active/current'],
    refetchInterval: 1000, // Update every second
  });

  // If no jobId provided (global view), show any active timer
  // If jobId provided (job-specific view), only show timer if it belongs to this job
  const activeTimer = jobId 
    ? (globalActiveTimer && (globalActiveTimer as any).jobId === jobId ? globalActiveTimer : null)
    : globalActiveTimer;

  // Start timer mutation with GPS location
  const startTimerMutation = useMutation({
    mutationFn: async (data: { 
      description: string; 
      jobId?: string; 
      hourlyRate?: string;
      startLatitude?: number;
      startLongitude?: number;
      startAddress?: string;
    }) => {
      return apiRequest('POST', '/api/time-entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      onTimerStart?.();
      toast({
        title: "Timer Started",
        description: lastLocation 
          ? "Time tracking started with GPS location captured." 
          : "Time tracking has begun for this task.",
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

  // Stop timer mutation with GPS location
  const stopTimerMutation = useMutation({
    mutationFn: async (data: { 
      timerId: string;
      endLatitude?: number;
      endLongitude?: number;
      endAddress?: string;
    }) => {
      return apiRequest('POST', `/api/time-entries/${data.timerId}/stop`, {
        endLatitude: data.endLatitude,
        endLongitude: data.endLongitude,
        endAddress: data.endAddress,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      setLastLocation(null);
      onTimerStop?.();
      toast({
        title: "Timer Stopped",
        description: "Time has been recorded with location verification.",
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

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate elapsed time
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

  const handleStartTimer = () => {
    // Prevent starting if any timer is already active
    if (globalActiveTimer) {
      // If it's a different job, show which job is running
      if (jobId && (globalActiveTimer as any).jobId !== jobId) {
        toast({
          title: "Timer Already Running",
          description: `Stop the current timer for "${(globalActiveTimer as any).description || 'another job'}" before starting a new one.`,
          variant: "destructive",
        });
        return;
      }
      // If it's the same job or global view, still prevent duplicate starts
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
    
    // Try to get GPS location with a short timeout, but start timer immediately if it fails
    const startTimer = (locationData?: { latitude: number; longitude: number; address?: string }) => {
      if (locationData) {
        setLastLocation(locationData);
      }
      
      startTimerMutation.mutate({
        description,
        ...(jobId && { jobId }),
        hourlyRate: '85.00',
        ...(locationData && {
          startLatitude: locationData.latitude,
          startLongitude: locationData.longitude,
          startAddress: locationData.address,
        }),
      });
    };

    // Attempt GPS capture with short timeout (3 seconds) - don't block timer start
    const locationPromise = getLocation();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    
    Promise.race([locationPromise, timeoutPromise])
      .then((location) => startTimer(location || undefined))
      .catch(() => startTimer());
  };

  const handleStopTimer = () => {
    if (activeTimer && typeof activeTimer === 'object' && 'id' in activeTimer && activeTimer.id) {
      const timerId = activeTimer.id as string;
      
      // Stop timer immediately, try to capture GPS in background
      const stopTimer = (locationData?: { latitude: number; longitude: number; address?: string }) => {
        stopTimerMutation.mutate({
          timerId,
          ...(locationData && {
            endLatitude: locationData.latitude,
            endLongitude: locationData.longitude,
            endAddress: locationData.address,
          }),
        });
      };

      // Attempt GPS capture with short timeout - don't block timer stop
      const locationPromise = getLocation();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      
      Promise.race([locationPromise, timeoutPromise])
        .then((location) => stopTimer(location || undefined))
        .catch(() => stopTimer());
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full" data-testid="card-timer-loading">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full hover-elevate" data-testid="card-timer-widget">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Time Tracker
          {isLocating && (
            <Badge variant="outline" className="ml-auto">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Getting location...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeTimer && typeof activeTimer === 'object' && 'startTime' in activeTimer ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-primary mb-2" data-testid="text-elapsed-time">
                {getElapsedTime(activeTimer.startTime as string)}
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-timer-description">
                {(activeTimer as any).description || 'Working...'}
              </p>
              {jobTitle && (
                <Badge variant="secondary" className="mt-2" data-testid="badge-job-title">
                  {jobTitle}
                </Badge>
              )}
              {/* Show clock-in location if captured */}
              {(activeTimer as any).startAddress && (
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]" data-testid="text-start-location">
                    {(activeTimer as any).startAddress.split(',')[0]}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={handleStopTimer}
                disabled={stopTimerMutation.isPending}
                data-testid="button-stop-timer"
              >
                {stopTimerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Clock Out
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-mono text-muted-foreground mb-2">
                00:00:00
              </div>
              <p className="text-sm text-muted-foreground">
                Ready to start tracking time
              </p>
              {locationError && (
                <p className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {locationError} (timer will still work)
                </p>
              )}
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleStartTimer}
              disabled={startTimerMutation.isPending}
              data-testid="button-start-timer"
            >
              {startTimerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Clock In
                </>
              )}
            </Button>

            {/* Location info for mobile users */}
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Navigation className="h-3 w-3" />
              <span>GPS location will be captured for verification</span>
            </div>
          </div>
        )}
        
        {/* Current time display */}
        <Separator />
        <div className="text-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 inline mr-1" />
          {format(currentTime, 'h:mm:ss a')}
        </div>
      </CardContent>
    </Card>
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