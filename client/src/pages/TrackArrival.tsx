import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Clock, Phone, RefreshCw, Navigation, AlertCircle, CheckCircle2, Car } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TrackingData {
  id: string;
  isActive: boolean;
  expiresAt: string;
  lastLocation: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
  estimatedArrival: string | null;
  job: {
    id: string;
    title: string;
    address: string;
    scheduledAt: string | null;
    scheduledTime: string | null;
    status: string;
  };
  business: {
    name: string;
    phone: string | null;
    logoUrl: string | null;
  };
  worker: {
    name: string;
  };
  trackingType?: undefined;
}

interface ETATrackingData {
  trackingType: 'eta';
  businessName: string;
  tradieName: string;
  suburb: string;
  sentAt: string;
  estimatedMinutes: number;
  remainingMinutes: number;
  status: 'on_the_way' | 'arrived' | 'completed' | 'arriving_soon';
}

type AnyTrackingData = TrackingData | ETATrackingData;

function createWorkerIcon(name: string) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return L.divIcon({
    className: 'uber-worker-marker',
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          top: -4px;
          left: -4px;
          border-radius: 50%;
          background: #3b82f6;
          opacity: 0.25;
          animation: uber-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(37,99,235,0.4), 0 2px 8px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.5px;
        ">
          ${initials}
        </div>
        <div style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  
  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes === 1) {
    return "1 minute ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else {
    return past.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function formatScheduledTime(scheduledAt: string | null, scheduledTime: string | null): string {
  if (!scheduledAt && !scheduledTime) return "Time not set";
  
  const parts: string[] = [];
  
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    parts.push(date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  
  if (scheduledTime) {
    parts.push(scheduledTime);
  }
  
  return parts.join(' at ');
}

function formatETA(etaString: string): string {
  const eta = new Date(etaString);
  const now = new Date();
  const diffMs = eta.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes <= 0) {
    return "Arriving now";
  } else if (diffMinutes === 1) {
    return "~1 minute away";
  } else if (diffMinutes < 60) {
    return `~${diffMinutes} minutes away`;
  } else {
    return eta.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function ETATrackingView({ data }: { data: ETATrackingData }) {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sentAt = new Date(data.sentAt).getTime();
  const arrivalTime = sentAt + data.estimatedMinutes * 60000;
  const remainingMs = Math.max(0, arrivalTime - now);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const isArrivingSoon = remainingMinutes <= 0;
  const statusText = isArrivingSoon ? 'Arriving soon' : `Arriving in ${remainingMinutes} min`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">{data.businessName}</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Navigation className="h-7 w-7 text-primary" />
                </div>
                <span className="absolute bottom-0 right-0 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{data.tradieName} is on the way</h2>
                <p className="text-sm text-muted-foreground">
                  Heading to {data.suburb}
                </p>
              </div>

              <div className="w-full bg-muted rounded-lg p-4">
                <p className="text-2xl font-bold text-primary">
                  {statusText}
                </p>
                {!isArrivingSoon && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated {data.estimatedMinutes} min travel time
                  </p>
                )}
              </div>

              <Badge variant={isArrivingSoon ? "default" : "secondary"}>
                {isArrivingSoon ? "Arriving Soon" : "On the Way"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Powered by JobRunner</p>
        </div>
      </div>
    </div>
  );
}

interface TrackArrivalProps {
  token: string;
}

export default function TrackArrival({ token }: TrackArrivalProps) {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<AnyTrackingData>({
    queryKey: ['/api/track', token],
    refetchInterval: autoRefreshEnabled ? 10000 : false,
    retry: 1,
  });

  useEffect(() => {
    if (!isFetching) {
      setLastRefresh(new Date());
    }
  }, [isFetching]);

  const handleManualRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || "Unable to load tracking information";
    const isExpired = errorMessage.includes("expired") || errorMessage.includes("410");
    const isNotFound = errorMessage.includes("not found") || errorMessage.includes("404");
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">
              {isExpired ? "Tracking Link Expired" : isNotFound ? "This tracking link has expired" : "Unable to Load"}
            </h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              {isExpired 
                ? "This tracking link has expired. Please contact the business for updated information."
                : isNotFound
                  ? "This tracking link has expired or is no longer available."
                  : "There was a problem loading the tracking information. Please try again later."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.trackingType === 'eta') {
    return <ETATrackingView data={data} />;
  }

  const trackingData = data as TrackingData;
  const { job, business, worker, lastLocation, estimatedArrival, isActive } = trackingData;
  const jobCompleted = job.status === 'done' || job.status === 'completed';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            {business.logoUrl ? (
              <img 
                src={business.logoUrl} 
                alt={business.name} 
                className="h-10 object-contain"
                data-testid="img-business-logo"
              />
            ) : (
              <h1 className="text-xl font-bold" data-testid="text-business-name">{business.name}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isActive && !jobCompleted ? "default" : "secondary"}
              data-testid="badge-status"
            >
              {jobCompleted ? "Completed" : isActive ? "Live Tracking" : "Inactive"}
            </Badge>
          </div>
        </div>

        {jobCompleted ? (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-green-800 dark:text-green-200" data-testid="text-completed-title">
                    Work Completed
                  </h2>
                  <p className="text-sm text-green-700 dark:text-green-300" data-testid="text-completed-message">
                    {worker.name} has finished the job
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-blue-100 dark:border-blue-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                      {worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold" data-testid="text-worker-name">{worker.name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Car className="h-3.5 w-3.5 text-blue-500" />
                      {estimatedArrival ? (
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold" data-testid="text-eta">
                          {formatETA(estimatedArrival)}
                        </p>
                      ) : lastLocation ? (
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium" data-testid="text-on-the-way">
                          On the way
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground" data-testid="text-waiting">
                          Waiting for update
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isFetching}
                  data-testid="button-refresh"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              {lastLocation && (
                <p className="text-xs text-muted-foreground mt-3" data-testid="text-last-updated">
                  Location updated {formatTimeAgo(lastLocation.updatedAt)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {lastLocation && !jobCompleted && (
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <style>{`
                @keyframes uber-pulse {
                  0% { transform: scale(1); opacity: 0.3; }
                  100% { transform: scale(2); opacity: 0; }
                }
                .uber-worker-marker, .uber-destination-marker {
                  background: transparent !important;
                  border: none !important;
                }
                .uber-worker-marker {
                  transition: transform 0.8s ease-out !important;
                }
              `}</style>
              <div className="h-[50vh] min-h-[320px] max-h-[500px] relative" data-testid="container-map">
                <MapContainer
                  center={[lastLocation.lat, lastLocation.lng]}
                  zoom={15}
                  className="h-full w-full"
                  scrollWheelZoom={false}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  />
                  <Marker position={[lastLocation.lat, lastLocation.lng]} icon={createWorkerIcon(worker.name)}>
                    <Popup>
                      <div className="text-center p-1">
                        <p className="font-bold text-sm">{worker.name}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {estimatedArrival ? formatETA(estimatedArrival) : "On the way"}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle 
                    center={[lastLocation.lat, lastLocation.lng]} 
                    radius={100} 
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
                  />
                </MapContainer>
                <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border border-gray-200">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-gray-700">Live tracking</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" data-testid="text-job-title">{job.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="text-sm" data-testid="text-job-address">{job.address}</p>
                </div>
              </div>
            )}
            {(job.scheduledAt || job.scheduledTime) && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-sm" data-testid="text-scheduled-time">
                    {formatScheduledTime(job.scheduledAt, job.scheduledTime)}
                  </p>
                </div>
              </div>
            )}
            {business.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <a 
                    href={`tel:${business.phone}`} 
                    className="text-sm text-primary hover:underline"
                    data-testid="link-phone"
                  >
                    {business.phone}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!jobCompleted && (
          <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-muted-foreground">
            <span data-testid="text-auto-refresh-status">
              Auto-refresh: {autoRefreshEnabled ? "On (every 10s)" : "Off"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              data-testid="button-toggle-auto-refresh"
            >
              {autoRefreshEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Powered by JobRunner</p>
        </div>
      </div>
    </div>
  );
}
