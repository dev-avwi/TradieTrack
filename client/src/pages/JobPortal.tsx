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
  MessageCircle, Loader2, Signal, ClipboardCheck, Package
} from "lucide-react";
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
  client: { name: string } | null;
  documents: {
    quotes: Array<{ id: number; title: string; status: string; total: string; token: string; createdAt: string }>;
    invoices: Array<{ id: number; invoiceNumber: string; status: string; total: string; token: string; createdAt: string }>;
  };
  checklist: Array<{ text: string; isCompleted: boolean; sortOrder: number }>;
  materials: Array<{ name: string; quantity: number; unit?: string; status?: string }>;
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
    <div style="width:20px;height:20px;border-radius:50%;background:#0A6A73;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
    <div style="position:absolute;inset:0;width:20px;height:20px;border-radius:50%;background:#0A6A73;opacity:0.4;animation:pulse-ring 2s ease-out infinite;"></div>
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

function LiveTrackingMap({ token, workerName, jobAddress }: { token: string; workerName: string; jobAddress?: string }) {
  const [locationData, setLocationData] = useState<LocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/job-portal/${token}/location`);
      if (res.ok) {
        const data: LocationResponse = await res.json();
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
      <Card className="border-gray-200 rounded-xl shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[250px] w-full rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
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
    <Card className="border-gray-200 rounded-xl shadow-sm">
      <CardContent className="p-0">
        {etaMinutes != null && etaMinutes > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
            <div>
              <span className="text-2xl font-bold text-gray-900">{etaMinutes} min</span>
              <span className="text-sm text-gray-500 ml-2">estimated arrival</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
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

        <div className="overflow-hidden rounded-b-xl" style={{ height: '250px' }}>
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
      </CardContent>
    </Card>
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
      <div className="min-h-screen bg-white">
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-gray-200">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-14 h-14 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Job Not Found</h2>
            <p className="text-gray-500 text-sm">
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#0A6A73] sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {business.logo ? (
              <img src={business.logo} alt={business.name}
                className="w-10 h-10 object-contain rounded-md bg-white/90 p-0.5" />
            ) : (
              <div className="w-10 h-10 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-white text-base truncate">{business.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {business.phone && (
                  <a href={`tel:${business.phone}`} className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {business.phone}
                  </a>
                )}
                {business.email && (
                  <a href={`mailto:${business.email}`} className="text-xs text-white/70 hover:text-white items-center gap-1 hidden sm:flex">
                    <Mail className="w-3 h-3" /> {business.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {client && (
        <div className="bg-[#0A6A73]/5 border-b border-[#0A6A73]/10 px-4 py-3">
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-gray-700">
              Hi <span className="font-semibold">{client.name}</span>, here's your job update
            </p>
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {job.workerStatus && (
            <div className={`rounded-xl ${statusConfig.bg} ${statusConfig.border} border p-4`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.pulse && (
                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusConfig.dot} animate-ping opacity-75`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-lg ${statusConfig.text}`}>{statusConfig.label}</span>
                    {job.workerStatus === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {/* Last Updated indicator */}
                    {job.workerStatusUpdatedAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Location last updated {formatTimeAgo(job.workerStatusUpdatedAt)}
                        </span>
                        {/* GPS tracking indicator when on the way */}
                        {job.workerStatus === 'on_my_way' && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            <Signal className="w-3 h-3" />
                            Live tracking
                          </span>
                        )}
                      </div>
                    )}
                    {/* ETA and Duration badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.workerStatus === 'on_my_way' && job.workerEta && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          ETA: {job.workerEta}
                        </span>
                      )}
                      {job.workerEtaMinutes && job.workerEtaMinutes > 0 && (
                        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          Est. duration: {job.workerEtaMinutes <= 60 ? '30-60 mins' : job.workerEtaMinutes <= 120 ? '1-2 hours' : job.workerEtaMinutes <= 240 ? 'Half day' : job.workerEtaMinutes <= 480 ? 'Full day' : 'Multi-day'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {job.workerStatus === 'on_my_way' && token && (
            <LiveTrackingMap
              token={token}
              workerName={worker ? `${worker.firstName} ${worker.lastName}` : 'Your technician'}
              jobAddress={job.address}
            />
          )}

          {worker && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0A6A73] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {worker.firstName?.[0]}{worker.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{worker.firstName} {worker.lastName}</p>
                    <p className="text-xs text-gray-500">Your assigned technician</p>
                  </div>
                  {worker.phone && (
                    <a href={`tel:${worker.phone}`}>
                      <Button variant="outline" size="icon" className="rounded-full border-[#0A6A73]/30 text-[#0A6A73]">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-gray-200">
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 text-lg">{job.title}</h2>
              {job.description && (
                <p className="text-sm text-gray-600">{job.description}</p>
              )}
              {job.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{job.address}</p>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0A6A73] font-medium hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        Open in Maps <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {(job.scheduledAt || job.scheduledTime) && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{job.scheduledAt ? formatDate(job.scheduledAt) : ''}{job.scheduledTime ? ` at ${job.scheduledTime}` : ''}</span>
                  </div>
                )}
                {job.estimatedDuration && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{job.estimatedDuration} {job.estimatedDuration === 1 ? 'hour' : 'hours'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {job.notes && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" /> Notes
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{job.notes}</p>
              </CardContent>
            </Card>
          )}

          {job.workerStatus && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide">Progress</h3>
                <div className="relative pl-6">
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
                      <div key={step.key} className="relative pb-6 last:pb-0">
                        {!isLast && (
                          <div
                            className={`absolute left-[-18px] top-6 w-0.5 h-full ${
                              isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-[#0A6A73]/30' : 'bg-gray-200'
                            }`}
                          />
                        )}
                        <div className="flex items-start gap-3">
                          <div className="absolute left-[-24px]">
                            {isCompleted ? (
                              <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center mt-1">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="relative mt-1">
                                <div className="w-3 h-3 rounded-full bg-[#0A6A73]" />
                                <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#0A6A73] animate-ping opacity-50" />
                              </div>
                            ) : (
                              <div className="w-3 h-3 rounded-full bg-gray-300 mt-1" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              isCompleted ? 'text-emerald-700' : isCurrent ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {step.label}
                            </p>
                            {step.timestamp && (isCompleted || isCurrent) && (
                              <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(step.timestamp)}</p>
                            )}
                          </div>
                          <StepIcon className={`w-4 h-4 mt-0.5 ${
                            isCompleted ? 'text-emerald-500' : isCurrent ? 'text-[#0A6A73]' : 'text-gray-300'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {data.checklist && data.checklist.length > 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-gray-400" /> Work Scope
                </h3>
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
                      <span className={`text-sm ${item.isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      {data.checklist.filter(c => c.isCompleted).length} of {data.checklist.length} completed
                    </span>
                    <div className="flex-1 max-w-[120px] h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${(data.checklist.filter(c => c.isCompleted).length / data.checklist.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {data.materials && data.materials.length > 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" /> Materials
                </h3>
                <div className="space-y-2">
                  {data.materials.map((material, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-800">{material.name}</span>
                      <div className="flex items-center gap-2">
                        {material.quantity && (
                          <span className="text-xs text-gray-500">
                            {material.quantity}{material.unit ? ` ${material.unit}` : ''}
                          </span>
                        )}
                        {material.status && (
                          <Badge variant="secondary" className={`text-xs no-default-hover-elevate no-default-active-elevate ${
                            material.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                            material.status === 'ordered' ? 'bg-blue-100 text-blue-700' :
                            material.status === 'on_order' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {material.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hasPhotos && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Camera className="w-4 h-4 text-gray-400" /> Photos
                </h3>
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
              </CardContent>
            </Card>
          )}

          {hasDocuments && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" /> Documents
                </h3>
                <div className="space-y-2">
                  {documents.quotes.map((quote) => (
                    <a
                      key={`q-${quote.id}`}
                      href={`/portal/quote/${quote.token}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{quote.title || 'Quote'}</p>
                          <p className="text-xs text-gray-500">{formatDate(quote.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">{formatCurrency(quote.total)}</span>
                        {getDocStatusBadge(quote.status)}
                      </div>
                    </a>
                  ))}
                  {documents.invoices.map((invoice) => (
                    <a
                      key={`i-${invoice.id}`}
                      href={`/portal/invoice/${invoice.token}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">Invoice #{invoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-500">{formatDate(invoice.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">{formatCurrency(invoice.total)}</span>
                        {getDocStatusBadge(invoice.status)}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-gray-200">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-400" /> Send a Message
              </h3>
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
                    <span className="text-xs text-gray-400">{portalMessage.length}/1000</span>
                    <Button
                      type="submit"
                      disabled={!portalMessage.trim() || sendMessageMutation.isPending}
                      className="bg-[#0A6A73] hover:bg-[#085a62] text-white"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          Sending...
                        </>
                      ) : (
                        'Send Message'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 px-4 mt-auto bg-white">
        <div className="max-w-lg mx-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded bg-[#0A6A73] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">J</span>
            </div>
            <span className="text-xs text-gray-500">Powered by <span className="font-semibold text-gray-700">JobRunner</span></span>
          </div>
          {business.abn && (
            <p className="text-xs text-gray-400">ABN: {business.abn}</p>
          )}
        </div>
      </footer>

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
