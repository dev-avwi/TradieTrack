import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, Mail, MapPin, AlertCircle, CheckCircle2, Clock, Calendar,
  User, Navigation, FileText, Camera, ChevronRight, Timer, Building2,
  MessageCircle, Loader2, Signal, ClipboardCheck, Package, CreditCard, Shield
} from "lucide-react";
import jobrunnerLogo from "@assets/ChatGPT_Image_Feb_15,_2026,_08_30_34_PM_1771151701664.png";
import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface JobPortalData {
  job: {
    id: number;
    title: string;
    description?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    status: string;
    notes?: string;
    workerStatus: null | 'assigned' | 'on_my_way' | 'arrived' | 'in_progress' | 'completed';
    workerStatusUpdatedAt?: string;
    workerEta?: string;
    workerEtaMinutes?: number;
    scheduledAt?: string;
    scheduledTime?: string;
    estimatedDuration?: number;
    photos: Array<{ url: string; description?: string; type?: string; uploadedAt?: string }>;
    startedAt?: string;
    completedAt?: string;
  };
  business: {
    name: string;
    phone?: string;
    email?: string;
    logo?: string;
    abn?: string;
  };
  worker: { firstName: string; lastName: string; phone?: string } | null;
  client: { name: string; phone?: string; phoneLast4?: string } | null;
  documents: {
    quotes: Array<{ id: number; title: string; status: string; total: string; token: string; createdAt: string }>;
    invoices: Array<{ id: number; invoiceNumber: string; status: string; total: string; token: string; createdAt: string }>;
  };
  checklist: Array<{ text: string; isCompleted: boolean; sortOrder: number }>;
  materials: Array<{ name: string; quantity: number; unit?: string; status?: string }>;
  assignments?: PortalAssignment[];
}

interface PortalAssignment {
  id: string;
  status: string;
  isPrimary: boolean;
  etaMinutes: number | null;
  etaUpdatedAt: string | null;
  travelStartedAt: string | null;
  arrivedAt: string | null;
  worker: {
    name: string;
    phone: string | null;
  };
}

interface CrewLocationWorker {
  assignmentId: string;
  name: string;
  status: string;
  isPrimary: boolean;
  etaMinutes: number | null;
  etaUpdatedAt: string | null;
  travelStartedAt: string | null;
  arrivedAt: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    recordedAt: string;
  } | null;
  stale: boolean;
}

interface CrewLocationResponse {
  tracking: boolean;
  jobLocation: { latitude: number; longitude: number } | null;
  workers: CrewLocationWorker[];
}

const STATUS_ORDER = ['assigned', 'on_my_way', 'arrived', 'in_progress', 'completed'] as const;

function getStatusIndex(status: string | null): number {
  if (!status) return -1;
  return STATUS_ORDER.indexOf(status as any);
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num || 0);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return formatDate(dateStr);
}

function getStatusConfig(status: string | null) {
  switch (status) {
    case 'assigned':
      return { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500', pulse: false };
    case 'on_my_way':
      return { label: 'On the Way', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500', pulse: true };
    case 'arrived':
      return { label: 'Arrived on Site', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', pulse: false };
    case 'in_progress':
      return { label: 'Work in Progress', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500', pulse: true };
    case 'completed':
      return { label: 'Job Complete', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', pulse: false };
    default:
      return { label: 'Pending', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400', pulse: false };
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'accepted':
    case 'paid':
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    case 'sent':
    case 'viewed':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    case 'overdue':
    case 'declined':
      return <Badge variant="secondary" className="bg-red-100 text-red-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    default:
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
  }
}

interface LocationResponse {
  tracking: boolean;
  status: string;
  message?: string;
  workerLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updatedAt: number;
    stale: boolean;
  } | null;
  jobLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  etaMinutes?: number;
  lastUpdated?: string;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}

const workerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="width:20px;height:20px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
    <div style="position:absolute;inset:0;width:20px;height:20px;border-radius:50%;background:#2563EB;opacity:0.4;animation:pulse-ring 2s ease-out infinite;"></div>
  </div>
  <style>@keyframes pulse-ring{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}</style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const jobIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const WORKER_COLORS = ['#2563EB', '#E67E22', '#8E44AD', '#E74C3C', '#2ECC71', '#3498DB'];

function createWorkerIcon(color: string, isPrimary: boolean) {
  const size = isPrimary ? 24 : 18;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      <div style="position:absolute;inset:0;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.4;animation:pulse-ring 2s ease-out infinite;"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function LiveTrackingMap({ token, workerName, jobAddress }: { token: string; workerName: string; jobAddress?: string }) {
  const [locationData, setLocationData] = useState<LocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/job-portal/${token}/location`);
      if (res.ok) {
        const data: LocationResponse = await res.json();
        
        // Also try new assignment-scoped location endpoint
        try {
          const res2 = await fetch(`/api/portal/${token}/live-location`);
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.tracking && data2.location) {
              // Use newer location data from pings if available
              const pingTime = new Date(data2.location.recordedAt).getTime();
              const existingTime = data.workerLocation?.updatedAt || 0;
              if (pingTime > existingTime || !data.workerLocation) {
                data.workerLocation = {
                  latitude: data2.location.latitude,
                  longitude: data2.location.longitude,
                  heading: undefined,
                  speed: undefined,
                  updatedAt: pingTime,
                  stale: false,
                };
                data.tracking = true;
                if (data2.etaMinutes != null) {
                  data.etaMinutes = data2.etaMinutes;
                }
                data.lastUpdated = data2.location.recordedAt;
              }
            }
          }
        } catch {}
        
        setLocationData(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLocation]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!locationData || !locationData.tracking) {
    return null;
  }

  const { workerLocation, jobLocation, etaMinutes, lastUpdated } = locationData;

  const now = Date.now();
  const updatedAtMs = workerLocation?.updatedAt ? workerLocation.updatedAt : 0;
  const staleThreshold = 5 * 60 * 1000;
  const isStale = workerLocation ? (workerLocation.stale || (now - updatedAtMs > staleThreshold)) : false;

  const timeAgoText = (() => {
    if (!lastUpdated && !updatedAtMs) return '';
    const ts = lastUpdated ? new Date(lastUpdated).getTime() : updatedAtMs;
    const diffMs = now - ts;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
  })();

  const hasWorker = workerLocation && workerLocation.latitude && workerLocation.longitude;
  const hasJob = jobLocation && jobLocation.latitude && jobLocation.longitude;

  const center: [number, number] = hasWorker
    ? [workerLocation.latitude, workerLocation.longitude]
    : hasJob
      ? [jobLocation.latitude, jobLocation.longitude]
      : [-33.8688, 151.2093];

  const bounds: L.LatLngBoundsExpression | null =
    hasWorker && hasJob
      ? [
          [workerLocation.latitude, workerLocation.longitude],
          [jobLocation.latitude, jobLocation.longitude],
        ]
      : null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {etaMinutes != null && etaMinutes > 0 && (
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold">{etaMinutes} min</span>
              <span className="text-sm text-white/70 ml-2">estimated arrival</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Signal className="w-3 h-3" />
            Updated {timeAgoText}
          </div>
        </div>
      )}

      {isStale && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700">Tracking paused - last update {timeAgoText}</span>
        </div>
      )}

      <div className="overflow-hidden" style={{ height: '300px' }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {bounds && <FitBounds bounds={bounds} />}

          {hasWorker && (
            <Marker position={[workerLocation.latitude, workerLocation.longitude]} icon={workerIcon}>
              <Popup>
                <span className="text-sm font-medium">{workerName}</span>
              </Popup>
            </Marker>
          )}

          {hasJob && (
            <Marker position={[jobLocation.latitude, jobLocation.longitude]} icon={jobIcon}>
              <Popup>
                <span className="text-sm">{jobAddress || 'Job location'}</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {!hasWorker && (
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500">Waiting for location update...</p>
        </div>
      )}

      {hasWorker && timeAgoText && !(etaMinutes != null && etaMinutes > 0) && (
        <div className="px-4 py-2 flex items-center justify-end gap-1 text-xs text-gray-400">
          <Signal className="w-3 h-3" />
          Updated {timeAgoText}
        </div>
      )}
    </div>
  );
}

function CrewTrackingMap({ token, assignments, jobAddress }: { 
  token: string; 
  assignments: PortalAssignment[];
  jobAddress?: string;
}) {
  const [crewData, setCrewData] = useState<CrewLocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCrewLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/job-portal/${token}/crew-locations`);
      if (res.ok) {
        const data: CrewLocationResponse = await res.json();
        setCrewData(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCrewLocations();
    intervalRef.current = setInterval(fetchCrewLocations, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchCrewLocations]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!crewData || !crewData.tracking) return null;

  const { jobLocation, workers } = crewData;
  const colorMap = new Map(workers.map((w, i) => [w.assignmentId, WORKER_COLORS[i % WORKER_COLORS.length]]));
  const enRouteWorkers = workers.filter(w => w.status === 'en_route' && w.location);
  const hasJob = jobLocation && jobLocation.latitude && jobLocation.longitude;
  
  const allPoints: [number, number][] = [];
  enRouteWorkers.forEach(w => {
    if (w.location) allPoints.push([w.location.latitude, w.location.longitude]);
  });
  if (hasJob) allPoints.push([jobLocation.latitude, jobLocation.longitude]);
  
  const center: [number, number] = allPoints.length > 0 ? allPoints[0] : [-16.9186, 145.7781];
  const bounds: L.LatLngBoundsExpression | null = allPoints.length >= 2 ? allPoints as L.LatLngBoundsExpression : null;

  const primaryWorker = workers.find(w => w.isPrimary) || workers[0];
  const primaryEta = primaryWorker?.etaMinutes;
  
  const anyStale = enRouteWorkers.some(w => w.stale);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {primaryEta != null && primaryEta > 0 && (
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold">{primaryEta} min</span>
              <span className="text-sm text-white/70 ml-2">estimated arrival</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Signal className="w-3 h-3" />
            Live
          </div>
        </div>
      )}

        {anyStale && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700">Some tracking data may be delayed</span>
          </div>
        )}

        {workers.length > 0 && (
          <div className="border-b border-gray-100">
            {workers.filter(w => ['en_route', 'arrived', 'in_progress', 'assigned'].includes(w.status)).map((w) => {
              const color = colorMap.get(w.assignmentId) || WORKER_COLORS[0];
              const isSelected = selectedWorker === w.assignmentId;
              const statusLabel = w.status === 'en_route' ? 'On the Way' : 
                                  w.status === 'arrived' ? 'Arrived' :
                                  w.status === 'in_progress' ? 'Working' :
                                  w.status === 'assigned' ? 'Scheduled' : w.status;
              const updatedText = w.location?.recordedAt ? formatTimeAgo(w.location.recordedAt) : '';
              
              return (
                <div 
                  key={w.assignmentId}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
                  onClick={() => setSelectedWorker(isSelected ? null : w.assignmentId)}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{w.name}</span>
                      {w.isPrimary && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Lead</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${w.status === 'en_route' ? 'text-amber-600' : w.status === 'arrived' || w.status === 'in_progress' ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {statusLabel}
                      </span>
                      {w.status === 'en_route' && w.etaMinutes != null && w.etaMinutes > 0 && (
                        <span className="text-xs text-gray-500">ETA {w.etaMinutes} min</span>
                      )}
                      {updatedText && w.status === 'en_route' && (
                        <span className="text-xs text-gray-400">{updatedText}</span>
                      )}
                      {w.stale && w.status === 'en_route' && (
                        <span className="text-xs text-amber-500">Paused</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="overflow-hidden" style={{ height: '300px' }}>
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bounds && <FitBounds bounds={bounds} />}

            {enRouteWorkers.map((w, idx) => {
              if (!w.location) return null;
              const color = colorMap.get(w.assignmentId) || WORKER_COLORS[0];
              const icon = createWorkerIcon(color, w.isPrimary);
              return (
                <Marker 
                  key={w.assignmentId}
                  position={[w.location.latitude, w.location.longitude]} 
                  icon={icon}
                >
                  <Popup>
                    <span className="text-sm font-medium">{w.name}</span>
                    {w.etaMinutes && <span className="text-xs block">ETA: {w.etaMinutes} min</span>}
                  </Popup>
                </Marker>
              );
            })}

            {hasJob && (
              <Marker position={[jobLocation.latitude, jobLocation.longitude]} icon={jobIcon}>
                <Popup>
                  <span className="text-sm">{jobAddress || 'Job location'}</span>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
    </div>
  );
}

export default function JobPortal() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');
    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
    };
  }, []);

  const { data, isLoading, error } = useQuery<JobPortalData>({
    queryKey: ['/api/public/job-portal', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Job not found');
      }
      return res.json();
    },
    retry: false,
    refetchInterval: (query) => {
      const d = query.state.data as JobPortalData | undefined;
      if (d?.job?.workerStatus && ['on_my_way', 'arrived', 'in_progress'].includes(d.job.workerStatus)) {
        return 30000;
      }
      return false;
    },
  });

  const [portalMessage, setPortalMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/public/job-portal/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      setPortalMessage('');
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 3000);
    },
  });

  useEffect(() => {
    if (data?.business?.name) {
      document.title = `Job Tracking - ${data.business.name} | JobRunner`;
    } else {
      document.title = 'Job Tracking | JobRunner';
    }
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = 'Track your job progress in real-time. See worker status, ETA, and job details.';
      document.head.appendChild(m);
    }
    return () => { document.title = 'JobRunner'; };
  }, [data?.business?.name]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200/60 rounded-2xl shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-14 h-14 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Job Not Found</h2>
            <p className="text-slate-500 text-sm">
              This link may have expired or the job doesn't exist. Please contact the business directly if you need assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { job, business, worker, client, documents } = data;
  const statusConfig = getStatusConfig(job.workerStatus);
  const statusIdx = getStatusIndex(job.workerStatus);
  const isActive = job.workerStatus && ['on_my_way', 'arrived', 'in_progress'].includes(job.workerStatus);
  const hasPhotos = job.photos && job.photos.length > 0;
  const hasDocuments = (documents.quotes.length + documents.invoices.length) > 0;

  const timelineSteps = [
    { key: 'assigned', label: 'Scheduled', icon: Calendar, timestamp: job.scheduledAt },
    { key: 'on_my_way', label: 'On the Way', icon: Navigation, timestamp: null },
    { key: 'arrived', label: 'Arrived', icon: MapPin, timestamp: null },
    { key: 'in_progress', label: 'Work Started', icon: Timer, timestamp: job.startedAt },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, timestamp: job.completedAt },
  ];

  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`
    : null;

  const getStatusGradient = (status: string | null) => {
    switch (status) {
      case 'on_my_way': return 'from-amber-500 to-orange-500';
      case 'arrived': return 'from-emerald-500 to-green-600';
      case 'in_progress': return 'from-blue-500 to-indigo-600';
      case 'completed': return 'from-emerald-500 to-teal-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#2563EB]/5 flex flex-col">
      <header className="bg-[#2563EB] sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {business.logo ? (
              <img src={business.logo} alt={business.name}
                className="w-10 h-10 object-contain rounded-md bg-white/90 p-0.5" />
            ) : (
              <div className="w-10 h-10 rounded-md bg-white/90 flex items-center justify-center flex-shrink-0 p-0.5">
                <img src={jobrunnerLogo} alt="JobRunner" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-white text-base truncate">{business.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="text-xs text-white/70 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {business.phone}
                  </a>
                )}
                {business.email && (
                  <a href={`mailto:${business.email}`} className="text-xs text-white/70 items-center gap-1 hidden sm:flex">
                    <Mail className="w-3 h-3" /> {business.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {client && (
        <div className="bg-gradient-to-r from-[#2563EB]/5 to-transparent border-b border-[#2563EB]/10 px-4 py-3">
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-slate-700">
              Hi <span className="font-semibold">{client.name}</span>, here's your job update
            </p>
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {token && (data.assignments?.some(a => a.status === 'en_route') || job.workerStatus === 'on_my_way') && (
            <CrewTrackingMap
              token={token}
              assignments={data.assignments || []}
              jobAddress={job.address}
            />
          )}

          {job.workerStatus && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className={`bg-gradient-to-r ${getStatusGradient(job.workerStatus)} text-white px-5 py-4`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full bg-white/30" />
                    {statusConfig.pulse && (
                      <div className="absolute inset-0 w-4 h-4 rounded-full bg-white/30 animate-ping opacity-75" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xl">{statusConfig.label}</span>
                      {job.workerStatus === 'completed' && (
                        <CheckCircle2 className="w-6 h-6 text-white/90" />
                      )}
                    </div>
                    {job.workerStatus === 'on_my_way' && job.workerEta && (
                      <div className="mt-1.5">
                        <span className="text-sm font-medium bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          ETA: {job.workerEta}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 space-y-2">
                {job.workerStatusUpdatedAt && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">
                      Updated {formatTimeAgo(job.workerStatusUpdatedAt)}
                    </span>
                    {job.workerStatus === 'on_my_way' && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Signal className="w-3 h-3" />
                        Live tracking
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(data.assignments && data.assignments.length > 0) ? (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Your Team</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {data.assignments.map((a, idx) => {
                  const color = WORKER_COLORS[idx % WORKER_COLORS.length];
                  const statusLabel = a.status === 'en_route' ? 'On the Way' : 
                                      a.status === 'arrived' ? 'Arrived' :
                                      a.status === 'in_progress' ? 'Working' :
                                      a.status === 'completed' ? 'Done' :
                                      a.status === 'assigned' ? 'Scheduled' : a.status;
                  const initials = a.worker.name === 'Support Crew' ? 'SC' : 
                    a.worker.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-md"
                        style={{ backgroundColor: color }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm truncate">{a.worker.name}</p>
                          {a.isPrimary && (
                            <span className="text-[10px] font-medium text-slate-500 bg-gray-100 px-1.5 py-0.5 rounded">Lead</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{statusLabel}</p>
                      </div>
                      {a.worker.phone && (
                        <a href={`tel:${a.worker.phone}`}>
                          <Button variant="default" size="icon" className="rounded-full bg-[#2563EB]">
                            <Phone className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : worker && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Your Technician</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold text-base flex-shrink-0 shadow-md">
                    {worker.firstName?.[0]}{worker.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{worker.firstName} {worker.lastName}</p>
                    <p className="text-xs text-slate-500">Your assigned technician</p>
                  </div>
                  {worker.phone && (
                    <a href={`tel:${worker.phone}`}>
                      <Button variant="default" size="icon" className="rounded-full bg-[#2563EB]">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
              <span className="font-semibold text-sm">{job.title}</span>
            </div>
            <div className="p-5 space-y-3">
              {job.description && (
                <p className="text-sm text-slate-600">{job.description}</p>
              )}
              {job.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{job.address}</p>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#2563EB] font-medium hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        Open in Maps <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {(job.scheduledAt || job.scheduledTime) && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{job.scheduledAt ? formatDate(job.scheduledAt) : ''}{job.scheduledTime ? ` at ${job.scheduledTime}` : ''}</span>
                  </div>
                )}
                {job.estimatedDuration && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{job.estimatedDuration} {job.estimatedDuration === 1 ? 'hour' : 'hours'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {job.notes && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Notes</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-600 whitespace-pre-line">{job.notes}</p>
              </div>
            </div>
          )}

          {job.workerStatus && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Progress</span>
                </div>
              </div>
              <div className="p-5">
                <div className="relative pl-8">
                  {timelineSteps.map((step, idx) => {
                    const stepIdx = getStatusIndex(step.key);
                    const isCompleted = statusIdx > stepIdx;
                    const isCurrent = statusIdx === stepIdx;
                    const isFuture = statusIdx < stepIdx;
                    const isLast = idx === timelineSteps.length - 1;
                    const StepIcon = step.icon;

                    if (isFuture && step.key !== 'completed') {
                      if (statusIdx < 0) return null;
                    }

                    return (
                      <div key={step.key} className="relative pb-7 last:pb-0">
                        {!isLast && (
                          <div
                            className={`absolute left-[-20px] top-8 w-0.5 h-full ${
                              isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-[#2563EB]/30' : 'bg-gray-200'
                            }`}
                          />
                        )}
                        <div className="flex items-start gap-3">
                          <div className="absolute left-[-28px]">
                            {isCompleted ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center mt-0.5 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="relative mt-0.5">
                                <div className="w-5 h-5 rounded-full bg-[#2563EB] shadow-sm" />
                                <div className="absolute inset-0 w-5 h-5 rounded-full bg-[#2563EB] animate-ping opacity-50" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 mt-0.5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${
                              isCompleted ? 'text-emerald-700' : isCurrent ? 'text-slate-900' : 'text-slate-400'
                            }`}>
                              {step.label}
                            </p>
                            {step.timestamp && (isCompleted || isCurrent) && (
                              <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(step.timestamp)}</p>
                            )}
                          </div>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-emerald-50' : isCurrent ? 'bg-blue-50' : 'bg-gray-50'
                          }`}>
                            <StepIcon className={`w-3.5 h-3.5 ${
                              isCompleted ? 'text-emerald-500' : isCurrent ? 'text-[#2563EB]' : 'text-gray-300'
                            }`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {data.checklist && data.checklist.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Work Scope</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {data.checklist
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-1.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.isCompleted 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-gray-300'
                      }`}>
                        {item.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {data.checklist.filter(c => c.isCompleted).length} of {data.checklist.length} completed
                    </span>
                    <div className="flex-1 max-w-[120px] h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#2563EB] rounded-full transition-all"
                        style={{ width: `${(data.checklist.filter(c => c.isCompleted).length / data.checklist.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.materials && data.materials.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Materials</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {data.materials.map((material, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-slate-800">{material.name}</span>
                      <div className="flex items-center gap-2">
                        {material.quantity && (
                          <span className="text-xs text-slate-500">
                            {material.quantity}{material.unit ? ` ${material.unit}` : ''}
                          </span>
                        )}
                        {material.status && (
                          <Badge variant="secondary" className={`text-xs no-default-hover-elevate no-default-active-elevate ${
                            material.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                            material.status === 'ordered' ? 'bg-blue-100 text-blue-700' :
                            material.status === 'on_order' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-slate-600'
                          }`}>
                            {material.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasPhotos && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Photos</span>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {job.photos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() => setSelectedPhoto(idx)}>
                      <img
                        src={photo.url}
                        alt={photo.description || `Job photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {photo.type && (photo.type === 'before' || photo.type === 'after') && (
                        <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                          photo.type === 'before' ? 'bg-gray-900/60 text-white' : 'bg-emerald-600/80 text-white'
                        }`}>
                          {photo.type === 'before' ? 'Before' : 'After'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasDocuments && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Documents</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {documents.quotes.map((quote) => (
                  <a
                    key={`q-${quote.id}`}
                    href={`/portal/quote/${quote.token}`}
                    className="block rounded-xl border border-slate-200 overflow-hidden hover-elevate active-elevate-2"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{quote.title || 'Quote'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(quote.createdAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-bold text-slate-900">{formatCurrency(quote.total)}</p>
                          <div className="mt-1">{getDocStatusBadge(quote.status)}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <Button variant="outline" size="sm" className="w-full text-[#2563EB] border-[#2563EB]/30">
                          View Quote
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </a>
                ))}
                {documents.invoices.map((invoice) => {
                  const isPayable = invoice.status !== 'paid';
                  return (
                    <a
                      key={`i-${invoice.id}`}
                      href={`/portal/invoice/${invoice.token}`}
                      className={`block rounded-xl overflow-hidden hover-elevate active-elevate-2 ${
                        isPayable 
                          ? 'bg-[#2563EB]/5 border-2 border-[#2563EB]/20' 
                          : 'border border-slate-200'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPayable ? 'bg-[#2563EB]/10' : 'bg-slate-100'
                          }`}>
                            <CreditCard className={`w-5 h-5 ${isPayable ? 'text-[#2563EB]' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">Invoice #{invoice.invoiceNumber}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{formatDate(invoice.createdAt)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-bold ${isPayable ? 'text-[#2563EB]' : 'text-slate-900'}`}>{formatCurrency(invoice.total)}</p>
                            <div className="mt-1">{getDocStatusBadge(invoice.status)}</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <Button 
                            variant={isPayable ? 'default' : 'outline'} 
                            size="sm" 
                            className={`w-full ${isPayable ? 'bg-[#2563EB]' : 'text-[#2563EB] border-[#2563EB]/30'}`}
                          >
                            {isPayable ? (
                              <>
                                <CreditCard className="w-4 h-4 mr-1.5" />
                                Pay Invoice
                              </>
                            ) : (
                              <>
                                View Invoice
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-slate-300" />
                <span className="font-semibold text-sm">Send a Message</span>
              </div>
            </div>
            <div className="p-5">
              {messageSent ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700">Message sent! The team will get back to you.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (portalMessage.trim()) {
                      sendMessageMutation.mutate(portalMessage.trim());
                    }
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    value={portalMessage}
                    onChange={(e) => setPortalMessage(e.target.value)}
                    placeholder="Have a question or update? Send a message to the team..."
                    maxLength={1000}
                    className="resize-none min-h-[100px] border-gray-200 text-sm"
                  />
                  {sendMessageMutation.isError && (
                    <p className="text-xs text-red-600">
                      {sendMessageMutation.error?.message || 'Failed to send message. Please try again.'}
                    </p>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-slate-400">{portalMessage.length}/1000</span>
                    <Button
                      type="submit"
                      disabled={!portalMessage.trim() || sendMessageMutation.isPending}
                      variant="default"
                      size="lg"
                      className="bg-[#2563EB]"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4 mr-1.5" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm">Your Documents</h3>
                <p className="text-xs text-slate-600 mt-0.5">View invoices, quotes, and make secure payments</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Button 
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (client?.phone) params.set('phone', client.phone);
                      window.location.href = `/portal${params.toString() ? '?' + params.toString() : ''}`;
                    }}
                    variant="outline"
                    size="sm"
                    className="text-sm text-[#2563EB] border-[#2563EB]/30"
                  >
                    View Documents
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Secure
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-6 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm font-medium text-slate-500">Powered by <strong className="text-slate-700">JobRunner</strong></span>
        </div>
        {business.abn && (
          <p className="text-xs text-slate-400">ABN: {business.abn}</p>
        )}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Secure & encrypted</span>
        </div>
      </div>

      {selectedPhoto !== null && hasPhotos && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-lg max-h-[80vh] w-full">
            <img
              src={job.photos[selectedPhoto].url}
              alt={job.photos[selectedPhoto].description || 'Job photo'}
              className="w-full h-full object-contain rounded-lg"
            />
            {job.photos[selectedPhoto].description && (
              <p className="text-white/80 text-sm text-center mt-3">{job.photos[selectedPhoto].description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
