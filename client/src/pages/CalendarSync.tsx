import { useQuery, useMutation } from "@tanstack/react-query";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSearch } from "wouter";
import { useEffect, useState } from "react";
import {
  Calendar,
  RefreshCw,
  Check,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  CloudOff,
  CloudCog
} from "lucide-react";
import { SiGoogle } from "react-icons/si";

interface CalendarStatus {
  provider: 'google' | 'outlook';
  connected: boolean;
  calendarId?: string;
  calendarName?: string;
  lastSyncAt?: string;
  syncDirection: 'to_calendar' | 'from_calendar' | 'both';
  email?: string;
}

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

interface CalendarOption {
  id: string;
  name: string;
  primary: boolean;
}

export default function CalendarSync() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const connectedParam = urlParams.get('connected');
  const errorParam = urlParams.get('error');
  const [syncDirection, setSyncDirection] = useState<string>('both');

  useEffect(() => {
    if (connectedParam === 'true') {
      toast({
        title: "Calendar Connected",
        description: "Your Google Calendar has been successfully connected.",
      });
      window.history.replaceState({}, '', '/settings/calendar');
    }
    if (errorParam) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect calendar: ${decodeURIComponent(errorParam)}`,
        variant: "destructive"
      });
      window.history.replaceState({}, '', '/settings/calendar');
    }
  }, [connectedParam, errorParam, toast]);

  const { data: status, isLoading: statusLoading } = useQuery<CalendarStatus>({
    queryKey: ["/api/calendar/status"],
  });

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<CalendarOption[]>({
    queryKey: ["/api/calendar/google/calendars"],
    enabled: status?.connected === true,
  });

  useEffect(() => {
    if (status?.syncDirection) {
      setSyncDirection(status.syncDirection);
    }
  }, [status]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/calendar/google/auth', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get auth URL');
      const data = await res.json();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start connection",
        variant: "destructive"
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/calendar/google/disconnect', { method: 'POST' });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({
        title: "Calendar Disconnected",
        description: "Your Google Calendar has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect calendar",
        variant: "destructive"
      });
    }
  });

  const syncMutation = useMutation<SyncResult>({
    mutationFn: async () => {
      const res = await apiRequest('/api/calendar/google/sync', { method: 'POST' });
      return res as SyncResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      if (result.success) {
        toast({
          title: "Sync Complete",
          description: `Created ${result.created} events, updated ${result.updated} events.`,
        });
      } else {
        toast({
          title: "Sync Completed with Errors",
          description: `${result.errors.length} jobs failed to sync.`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync jobs",
        variant: "destructive"
      });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async ({ calendarId, syncDirection }: { calendarId?: string; syncDirection?: string }) => {
      return apiRequest('/api/calendar/settings', {
        method: 'PATCH',
        body: JSON.stringify({ calendarId, syncDirection })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({
        title: "Settings Updated",
        description: "Calendar sync settings have been updated.",
      });
    }
  });

  if (statusLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Calendar Sync"
          subtitle="Connect your calendar for bidirectional sync"
          leading={<Calendar className="h-6 w-6" />}
        />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Calendar Sync"
        subtitle="Sync your jobs with Google Calendar or Outlook"
        leading={<Calendar className="h-6 w-6" />}
      />

      <div className="space-y-6">
        <Card data-testid="card-google-calendar">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <SiGoogle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Calendar</CardTitle>
                  <CardDescription>
                    {status?.connected 
                      ? `Connected to ${status.calendarName || 'Primary Calendar'}`
                      : 'Connect to sync your jobs with Google Calendar'
                    }
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant="secondary"
                className={status?.connected 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }
              >
                {status?.connected ? (
                  <><Check className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><CloudOff className="h-3 w-3 mr-1" /> Not Connected</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!status?.connected ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connect your Google Calendar to automatically sync scheduled jobs. 
                    Your team can see job appointments and TradieTrack will stay updated 
                    when events change in Google Calendar.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  data-testid="button-connect-google"
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <SiGoogle className="h-4 w-4 mr-2" />
                  )}
                  Connect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Calendar</label>
                    <Select
                      value={status.calendarId || 'primary'}
                      onValueChange={(value) => updateSettingsMutation.mutate({ calendarId: value })}
                      disabled={calendarsLoading}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-calendar">
                        <SelectValue placeholder="Select calendar" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((cal) => (
                          <SelectItem key={cal.id} value={cal.id}>
                            {cal.name} {cal.primary && '(Primary)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Sync Direction</label>
                    <Select
                      value={syncDirection}
                      onValueChange={(value) => {
                        setSyncDirection(value);
                        updateSettingsMutation.mutate({ syncDirection: value });
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-sync-direction">
                        <SelectValue placeholder="Sync direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Two-way sync</SelectItem>
                        <SelectItem value="to_calendar">TradieTrack → Google only</SelectItem>
                        <SelectItem value="from_calendar">Google → TradieTrack only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {status.lastSyncAt && (
                  <div className="text-sm text-muted-foreground">
                    Last synced: {new Date(status.lastSyncAt).toLocaleString('en-AU')}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync-now"
                  >
                    {syncMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => window.open('https://calendar.google.com', '_blank')}
                    data-testid="button-open-calendar"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Google Calendar
                  </Button>

                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    data-testid="button-disconnect-google"
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-60" data-testid="card-outlook-calendar">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <CloudCog className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Outlook Calendar</CardTitle>
                  <CardDescription>
                    Connect to sync with Microsoft Outlook
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Outlook Calendar integration is in development. You'll be able to sync 
              your jobs with Microsoft Outlook and Teams calendars.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-sync-info">
          <CardHeader>
            <CardTitle className="text-base">How Calendar Sync Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">1</div>
              <p>When you schedule a job in TradieTrack, it automatically creates a calendar event with the job details, client info, and address.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">2</div>
              <p>If you update the job time in either TradieTrack or your calendar (with two-way sync enabled), the change syncs to the other automatically.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">3</div>
              <p>Your team members will see job appointments on their personal calendars, helping everyone stay coordinated.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
