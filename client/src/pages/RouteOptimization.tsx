import { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/ThemeProvider";
import { PageShell } from "@/components/layout/PageShell";
import { 
  MapPin, 
  Navigation, 
  Route,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  LocateFixed,
  RefreshCw,
  Calendar
} from "lucide-react";
import { format, isToday, startOfDay, endOfDay } from "date-fns";
import "leaflet/dist/leaflet.css";

interface Job {
  id: string;
  title: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  scheduledAt: string | null;
  clientId: string | null;
}

interface OptimizedRoute {
  jobs: Job[];
  totalDistance: number;
  estimatedTime: number;
  segments: {
    from: Job;
    to: Job;
    distance: number;
  }[];
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#6B7280",
  scheduled: "#3B82F6",
  in_progress: "#F59E0B",
  done: "#10B981",
  invoiced: "#8B5CF6",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Completed",
  invoiced: "Invoiced",
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function nearestNeighborOptimization(
  jobs: Job[], 
  startLocation?: UserLocation
): OptimizedRoute {
  const validJobs = jobs.filter(j => j.latitude !== null && j.longitude !== null);
  
  if (validJobs.length === 0) {
    return { jobs: [], totalDistance: 0, estimatedTime: 0, segments: [] };
  }

  const optimizedJobs: Job[] = [];
  const segments: OptimizedRoute['segments'] = [];
  const remaining = [...validJobs];
  let totalDistance = 0;
  
  let currentLat = startLocation?.latitude ?? validJobs[0].latitude!;
  let currentLon = startLocation?.longitude ?? validJobs[0].longitude!;
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const job = remaining[i];
      const dist = haversineDistance(currentLat, currentLon, job.latitude!, job.longitude!);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    const nearestJob = remaining.splice(nearestIdx, 1)[0];
    
    if (optimizedJobs.length > 0) {
      segments.push({
        from: optimizedJobs[optimizedJobs.length - 1],
        to: nearestJob,
        distance: nearestDist
      });
    }
    
    optimizedJobs.push(nearestJob);
    totalDistance += nearestDist;
    currentLat = nearestJob.latitude!;
    currentLon = nearestJob.longitude!;
  }
  
  const estimatedTime = (totalDistance / 40) * 60;
  
  return {
    jobs: optimizedJobs,
    totalDistance,
    estimatedTime,
    segments
  };
}

function generateGoogleMapsUrl(jobs: Job[], startLocation?: UserLocation): string {
  const validJobs = jobs.filter(j => j.latitude !== null && j.longitude !== null);
  
  if (validJobs.length === 0) return "";
  
  const origin = startLocation 
    ? `${startLocation.latitude},${startLocation.longitude}`
    : `${validJobs[0].latitude},${validJobs[0].longitude}`;
  
  const destination = `${validJobs[validJobs.length - 1].latitude},${validJobs[validJobs.length - 1].longitude}`;
  
  const waypoints = validJobs.slice(startLocation ? 0 : 1, -1)
    .map(j => `${j.latitude},${j.longitude}`)
    .join('|');
  
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  url += `&travelmode=driving`;
  
  return url;
}

function createNumberedIcon(number: number, status: string, isDark: boolean) {
  const color = STATUS_COLORS[status] || '#6B7280';
  const borderColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,1)';
  
  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
        border: 3px solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 14px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      ">
        ${number}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function createUserLocationIcon(isDark: boolean) {
  const color = '#3B82F6';
  
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          top: -8px;
          left: -8px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.2;
          animation: pulse-ring 2s ease-out infinite;
        "></div>
        <div style="
          width: 24px;
          height: 24px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitBoundsController({ jobs, userLocation }: { jobs: Job[], userLocation?: UserLocation }) {
  const map = useMap();
  const hasFittedRef = useRef(false);
  
  useEffect(() => {
    if (hasFittedRef.current) return;
    
    const allPoints: [number, number][] = [];
    
    if (userLocation) {
      allPoints.push([userLocation.latitude, userLocation.longitude]);
    }
    
    jobs.forEach(job => {
      if (job.latitude && job.longitude) {
        allPoints.push([job.latitude, job.longitude]);
      }
    });
    
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasFittedRef.current = true;
    }
  }, [map, jobs, userLocation]);
  
  return null;
}

export default function RouteOptimization() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const { data: allJobs = [], isLoading, error } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });
  
  const todaysJobs = useMemo(() => {
    const today = new Date();
    return allJobs.filter(job => {
      if (!job.scheduledAt) return false;
      const scheduledDate = new Date(job.scheduledAt);
      return isToday(scheduledDate) && 
             job.status !== 'done' && 
             job.status !== 'invoiced' &&
             job.latitude !== null && 
             job.longitude !== null;
    });
  }, [allJobs]);
  
  useEffect(() => {
    if (todaysJobs.length > 0 && selectedJobIds.size === 0) {
      setSelectedJobIds(new Set(todaysJobs.map(j => j.id)));
    }
  }, [todaysJobs]);
  
  const selectedJobs = useMemo(() => {
    return todaysJobs.filter(job => selectedJobIds.has(job.id));
  }, [todaysJobs, selectedJobIds]);
  
  const handleGetLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        setLocationError("Unable to get your location. Using first job as starting point.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const handleToggleJob = (jobId: string) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
    setOptimizedRoute(null);
  };
  
  const handleSelectAll = () => {
    if (selectedJobIds.size === todaysJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(todaysJobs.map(j => j.id)));
    }
    setOptimizedRoute(null);
  };
  
  const handleOptimizeRoute = () => {
    const route = nearestNeighborOptimization(selectedJobs, userLocation || undefined);
    setOptimizedRoute(route);
  };
  
  const handleStartNavigation = () => {
    if (!optimizedRoute || optimizedRoute.jobs.length === 0) return;
    const url = generateGoogleMapsUrl(optimizedRoute.jobs, userLocation || undefined);
    window.open(url, '_blank');
  };
  
  const displayJobs = optimizedRoute ? optimizedRoute.jobs : selectedJobs;
  
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const routeCoordinates = useMemo(() => {
    if (!optimizedRoute) return [];
    return optimizedRoute.jobs
      .filter(j => j.latitude && j.longitude)
      .map(j => [j.latitude!, j.longitude!] as [number, number]);
  }, [optimizedRoute]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="p-4 md:p-6 h-full flex items-center justify-center" data-testid="loading-state">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="p-4 md:p-6 h-full flex items-center justify-center" data-testid="error-state">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8 px-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-semibold text-lg mb-2">Failed to load jobs</h3>
              <p className="text-muted-foreground">Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col h-full" data-testid="route-optimization-page">
        <div className="p-4 md:p-6 border-b bg-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Route className="h-6 w-6 text-primary" />
                Route Optimization
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Plan the optimal order to visit today's job sites
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={isLocating}
                data-testid="button-get-location"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4 mr-2" />
                )}
                {userLocation ? 'Update Location' : 'Use My Location'}
              </Button>
            </div>
          </div>
          {locationError && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2" data-testid="text-location-error">
              {locationError}
            </p>
          )}
          {userLocation && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2" data-testid="text-location-success">
              <CheckCircle2 className="h-4 w-4 inline mr-1" />
              Using your current location as starting point
            </p>
          )}
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="h-[300px] lg:h-auto lg:flex-1 relative" data-testid="map-container">
            {todaysJobs.length > 0 ? (
              <MapContainer
                center={[-27.4698, 153.0251]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url={tileUrl}
                />
                <FitBoundsController jobs={displayJobs} userLocation={userLocation || undefined} />
                
                {userLocation && (
                  <Marker
                    position={[userLocation.latitude, userLocation.longitude]}
                    icon={createUserLocationIcon(isDark)}
                  >
                    <Popup>
                      <div className="text-sm font-medium">Your Location</div>
                    </Popup>
                  </Marker>
                )}
                
                {optimizedRoute && routeCoordinates.length > 1 && (
                  <Polyline
                    positions={routeCoordinates}
                    color="#3B82F6"
                    weight={4}
                    opacity={0.8}
                    dashArray="10, 10"
                  />
                )}
                
                {displayJobs.map((job, index) => (
                  <Marker
                    key={job.id}
                    position={[job.latitude!, job.longitude!]}
                    icon={createNumberedIcon(index + 1, job.status, isDark)}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="font-semibold text-sm mb-1">{job.title}</div>
                        <div className="text-xs text-muted-foreground mb-2">{job.address}</div>
                        <Badge variant="secondary" className="text-xs">
                          {STATUS_LABELS[job.status] || job.status}
                        </Badge>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/30">
                <div className="text-center p-6">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No jobs with locations scheduled for today</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:w-[400px] flex flex-col border-t lg:border-t-0 lg:border-l overflow-hidden">
            {todaysJobs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6" data-testid="empty-state">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">No Jobs Today</h3>
                  <p className="text-muted-foreground text-sm">
                    You don't have any jobs with addresses scheduled for today.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b bg-background">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedJobIds.size === todaysJobs.length && todaysJobs.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                        Select All ({todaysJobs.length} jobs)
                      </label>
                    </div>
                    <Badge variant="secondary" data-testid="badge-selected-count">
                      {selectedJobIds.size} selected
                    </Badge>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="jobs-list">
                  {(optimizedRoute ? optimizedRoute.jobs : todaysJobs).map((job, index) => (
                    <Card 
                      key={job.id} 
                      className={`hover-elevate ${selectedJobIds.has(job.id) ? 'ring-2 ring-primary/50' : ''}`}
                      data-testid={`card-job-${job.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {optimizedRoute ? (
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                              style={{ backgroundColor: STATUS_COLORS[job.status] || '#6B7280' }}
                              data-testid={`badge-order-${index + 1}`}
                            >
                              {index + 1}
                            </div>
                          ) : (
                            <Checkbox
                              id={`job-${job.id}`}
                              checked={selectedJobIds.has(job.id)}
                              onCheckedChange={() => handleToggleJob(job.id)}
                              className="mt-1"
                              data-testid={`checkbox-job-${job.id}`}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">{job.title}</span>
                              <Badge 
                                variant="secondary" 
                                className="text-xs flex-shrink-0"
                                style={{ 
                                  backgroundColor: `${STATUS_COLORS[job.status]}20`,
                                  color: STATUS_COLORS[job.status]
                                }}
                              >
                                {STATUS_LABELS[job.status] || job.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{job.address}</span>
                            </div>
                            {job.scheduledAt && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span>{format(new Date(job.scheduledAt), 'h:mm a')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {optimizedRoute && (
                  <div className="p-4 border-t bg-muted/30" data-testid="route-summary">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Route Optimized
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-background rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-primary" data-testid="text-total-distance">
                          {optimizedRoute.totalDistance.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">km total</div>
                      </div>
                      <div className="bg-background rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-primary" data-testid="text-estimated-time">
                          {Math.round(optimizedRoute.estimatedTime)}
                        </div>
                        <div className="text-xs text-muted-foreground">min driving</div>
                      </div>
                    </div>
                    
                    {optimizedRoute.segments.length > 0 && (
                      <div className="mt-4 space-y-2" data-testid="route-segments">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Route Preview
                        </h4>
                        {optimizedRoute.segments.map((segment, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate flex-1">{segment.from.title}</span>
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                            <span className="text-foreground font-medium">{segment.distance.toFixed(1)} km</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-4 border-t bg-background space-y-2">
                  {!optimizedRoute ? (
                    <Button
                      className="w-full"
                      onClick={handleOptimizeRoute}
                      disabled={selectedJobIds.size < 2}
                      data-testid="button-optimize-route"
                    >
                      <Route className="h-4 w-4 mr-2" />
                      Optimize Route ({selectedJobIds.size} jobs)
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        onClick={handleStartNavigation}
                        data-testid="button-start-navigation"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Start Navigation
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setOptimizedRoute(null)}
                        data-testid="button-reset-route"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset & Edit Selection
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .custom-numbered-marker {
          background: transparent !important;
          border: none !important;
        }
        .user-location-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </PageShell>
  );
}
