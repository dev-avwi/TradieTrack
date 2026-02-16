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
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
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

interface SubcontractorLocation {
  tokenId: string;
  name: string;
  status: string;
  isSubcontractor: boolean;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    recordedAt: string;
  } | null;
  stale: boolean;
  lastUpdated: string | null;
  etaMinutes: number | null;
}

interface CrewLocationResponse {
  tracking: boolean;
  jobLocation: { latitude: number; longitude: number } | null;
  workers: CrewLocationWorker[];
  subcontractors?: SubcontractorLocation[];
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

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}

const workerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:36px;">
    <div style="width:36px;height:36px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
    </div>
    <div style="position:absolute;inset:0;width:36px;height:36px;border-radius:50%;background:#2563EB;opacity:0.3;animation:pulse-ring 2s ease-out infinite;"></div>
  </div>
  <style>@keyframes pulse-ring{0%{transform:scale(1);opacity:0.3}100%{transform:scale(2.2);opacity:0}}</style>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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

const jobPinIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;">
    <div style="width:32px;height:32px;border-radius:50%;background:#DC2626;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>
    <div style="position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #DC2626;"></div>
  </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

const subbieIcon = new L.DivIcon({
  className: 'custom-subbie-marker',
  html: `<div style="width:32px;height:32px;background:#64748b;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;background:white;border-radius:50%"></div></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const WORKER_COLORS = ['#2563EB', '#E67E22', '#8E44AD', '#E74C3C', '#2ECC71', '#3498DB'];

function createWorkerIcon(color: string, isPrimary: boolean) {
  const size = isPrimary ? 36 : 28;
  const iconSize = isPrimary ? 18 : 14;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
      </div>
      <div style="position:absolute;inset:0;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.3;animation:pulse-ring 2s ease-out infinite;"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function RecenterControl({ center, bounds }: { center: [number, number]; bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const btn = document.createElement('button');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
    btn.style.cssText = 'position:absolute;top:60px;right:12px;z-index:1000;width:40px;height:40px;border-radius:12px;background:white;border:none;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#2563EB;';
    btn.addEventListener('click', () => {
      if (bounds) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else {
        map.setView(center, 15);
      }
    });
    container.appendChild(btn);
    return () => { container.removeChild(btn); };
  }, [map, center, bounds]);

  return null;
}

function RouteLine({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const map = useMap();

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setRouteCoords(coords);
          if (coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            bounds.extend(from);
            bounds.extend(to);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }
      } catch {}
    };
    fetchRoute();
  }, [from[0], from[1], to[0], to[1]]);

  if (routeCoords.length < 2) return null;

  return (
    <Polyline
      positions={routeCoords}
      pathOptions={{
        color: '#2563EB',
        weight: 5,
        opacity: 0.8,
        dashArray: undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  );
}

function HeroMap({ 
  token, 
  jobLat, 
  jobLng, 
  jobAddress,
  workerStatus,
  assignments 
}: { 
  token: string; 
  jobLat?: string; 
  jobLng?: string; 
  jobAddress?: string;
  workerStatus: string | null;
  assignments?: PortalAssignment[];
}) {
  const [crewData, setCrewData] = useState<CrewLocationResponse | null>(null);
  const [locationData, setLocationData] = useState<LocationResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEnRoute = workerStatus === 'on_my_way' || assignments?.some(a => a.status === 'en_route');

  const fetchLocations = useCallback(async () => {
    try {
      const [crewRes, locRes] = await Promise.allSettled([
        fetch(`/api/public/job-portal/${token}/crew-locations`),
        fetch(`/api/public/job-portal/${token}/location`),
      ]);
      if (crewRes.status === 'fulfilled' && crewRes.value.ok) {
        const data: CrewLocationResponse = await crewRes.value.json();
        setCrewData(data);
      }
      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        const data: LocationResponse = await locRes.value.json();
        setLocationData(data);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchLocations();
    const pollInterval = isEnRoute ? 10000 : 60000;
    intervalRef.current = setInterval(fetchLocations, pollInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLocations, isEnRoute]);

  const jobLatNum = jobLat ? parseFloat(jobLat) : null;
  const jobLngNum = jobLng ? parseFloat(jobLng) : null;
  const hasJobCoords = jobLatNum != null && jobLngNum != null && !isNaN(jobLatNum) && !isNaN(jobLngNum);

  const crewWorkers = crewData?.workers?.filter(w => w.location && ['en_route', 'arrived', 'in_progress'].includes(w.status)) || [];
  const singleWorkerLoc = locationData?.workerLocation;
  const hasSingleWorker = singleWorkerLoc && singleWorkerLoc.latitude && singleWorkerLoc.longitude;

  const workerPosition: [number, number] | null = (() => {
    if (crewWorkers.length > 0) {
      const primary = crewWorkers.find(w => w.isPrimary) || crewWorkers[0];
      if (primary.location) return [primary.location.latitude, primary.location.longitude];
    }
    if (hasSingleWorker) return [singleWorkerLoc.latitude, singleWorkerLoc.longitude];
    return null;
  })();

  const allPoints: [number, number][] = [];
  if (hasJobCoords) allPoints.push([jobLatNum, jobLngNum]);
  crewWorkers.forEach(w => {
    if (w.location) allPoints.push([w.location.latitude, w.location.longitude]);
  });
  const subcontractorWorkers = crewData?.subcontractors?.filter(s => s.location) || [];
  subcontractorWorkers.forEach(s => {
    if (s.location) allPoints.push([s.location.latitude, s.location.longitude]);
  });
  if (hasSingleWorker && crewWorkers.length === 0) {
    allPoints.push([singleWorkerLoc.latitude, singleWorkerLoc.longitude]);
  }

  const jobLocFromApi = crewData?.jobLocation || locationData?.jobLocation;
  if (!hasJobCoords && jobLocFromApi) {
    allPoints.push([jobLocFromApi.latitude, jobLocFromApi.longitude]);
  }

  const center: [number, number] = allPoints.length > 0 ? allPoints[0] : [-33.8688, 151.2093];
  const bounds: L.LatLngBoundsExpression | null = allPoints.length >= 2 ? allPoints as L.LatLngBoundsExpression : null;

  const etaMinutes = crewData?.workers?.find(w => w.isPrimary)?.etaMinutes 
    || crewData?.workers?.[0]?.etaMinutes 
    || locationData?.etaMinutes 
    || null;

  const jobPinLat = hasJobCoords ? jobLatNum : jobLocFromApi?.latitude;
  const jobPinLng = hasJobCoords ? jobLngNum : jobLocFromApi?.longitude;
  const hasJobPin = jobPinLat != null && jobPinLng != null;

  if (!hasJobPin && crewWorkers.length === 0 && !hasSingleWorker) {
    return (
      <div className="relative w-full overflow-hidden" style={{ height: '35vh', minHeight: '280px', maxHeight: '350px' }}>
        <MapContainer
          center={[-33.8688, 151.2093]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <RecenterControl center={[-33.8688, 151.2093]} bounds={null} />
        </MapContainer>
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-[999]" style={{ background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,0) 100%)' }} />
        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-xs font-medium text-slate-700">{jobAddress || 'Job location'}</span>
            <span className="text-xs text-slate-400 ml-auto">Location will update soon</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '35vh', minHeight: '280px', maxHeight: '350px' }}>
      <MapContainer
        center={center}
        zoom={hasJobPin && crewWorkers.length === 0 && !hasSingleWorker ? 15 : 13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        <RecenterControl center={center} bounds={bounds} />
        {bounds && <FitBounds bounds={bounds} />}
        {hasJobPin && (
          <Marker position={[jobPinLat!, jobPinLng!]} icon={jobPinIcon}>
            <Popup>
              <span className="text-sm font-medium">{jobAddress || 'Your job location'}</span>
            </Popup>
          </Marker>
        )}

        {crewWorkers.map((w, idx) => {
          if (!w.location) return null;
          const color = WORKER_COLORS[idx % WORKER_COLORS.length];
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

        {subcontractorWorkers.map((s) => {
          if (!s.location) return null;
          return (
            <Marker 
              key={`sub-${s.tokenId}`}
              position={[s.location.latitude, s.location.longitude]} 
              icon={subbieIcon}
            >
              <Popup>
                <span className="text-sm font-medium">{s.name}</span>
                {s.lastUpdated && (
                  <span className="text-xs block text-slate-500">
                    Last updated {formatTimeAgo(s.lastUpdated)}
                  </span>
                )}
              </Popup>
            </Marker>
          );
        })}

        {hasSingleWorker && crewWorkers.length === 0 && (
          <Marker position={[singleWorkerLoc.latitude, singleWorkerLoc.longitude]} icon={workerIcon}>
            <Popup>
              <span className="text-sm font-medium">Technician</span>
            </Popup>
          </Marker>
        )}

        {hasJobPin && workerPosition && (
          <RouteLine from={workerPosition} to={[jobPinLat!, jobPinLng!]} />
        )}
      </MapContainer>
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-[999]" style={{ background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,0) 100%)' }} />

      {isEnRoute && etaMinutes != null && etaMinutes > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{etaMinutes} min</p>
                <p className="text-xs text-slate-500">estimated arrival</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
              <Signal className="w-3 h-3" />
              <span>Live</span>
            </div>
          </div>
        </div>
      )}

      {!isEnRoute && hasJobPin && crewWorkers.length === 0 && !hasSingleWorker && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-xs font-medium text-slate-700">Your job location</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobPortal() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');

    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222.2 84% 4.9%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--muted', '210 40% 96.1%');
    root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('--input', '214.3 31.8% 91.4%');
    root.style.setProperty('--ring', '221.2 83.2% 53.3%');
    root.style.setProperty('color-scheme', 'light');

    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--border');
      root.style.removeProperty('--input');
      root.style.removeProperty('--ring');
      root.style.removeProperty('color-scheme');
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

  const { data: crewLocationData } = useQuery<CrewLocationResponse>({
    queryKey: ['/api/public/job-portal', token, 'crew-locations'],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}/crew-locations`);
      if (!res.ok) return { tracking: false, jobLocation: null, workers: [], subcontractors: [] };
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60000,
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
      <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, rgba(37,99,235,0.05), #ffffff, #eff6ff)' }}>
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-[300px] w-full" />
          <div className="p-4 space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, rgba(37,99,235,0.05), #ffffff, #eff6ff)' }}>
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
  const hasPhotos = job.photos && job.photos.length > 0;
  const hasDocuments = (documents.quotes.length + documents.invoices.length) > 0;

  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`
    : null;

  const progressSteps = [
    { key: 'assigned', label: 'Scheduled' },
    { key: 'on_my_way', label: 'On the Way' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'in_progress', label: 'Working' },
    { key: 'completed', label: 'Complete' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom, rgba(37,99,235,0.05), #ffffff, #eff6ff)' }}>
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

        <div className="relative">
          {token && (
            <HeroMap
              token={token}
              jobLat={job.latitude}
              jobLng={job.longitude}
              jobAddress={job.address}
              workerStatus={job.workerStatus}
              assignments={data.assignments}
            />
          )}

          <div className="absolute top-0 left-0 right-0 z-[1000]">
            <div className="bg-[#2563EB]/90 backdrop-blur-md px-4 py-3">
              <div className="flex items-center gap-3">
                {business.logo ? (
                  <img src={business.logo} alt={business.name}
                    className="w-9 h-9 object-contain rounded-md bg-white/90 p-0.5 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-white/90 flex items-center justify-center flex-shrink-0 p-0.5">
                    <img src={jobrunnerLogo} alt="JobRunner" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-bold text-white text-sm truncate drop-shadow-sm">{business.name}</h1>
                  {client && (
                    <p className="text-xs text-white/70 truncate">Hi {client.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {business.phone && (
                    <a href={`tel:${business.phone}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  {business.phone && (
                    <a href={`sms:${business.phone}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  {business.email && (
                    <a href={`mailto:${business.email}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {job.workerStatus && (
          <div className="-mt-6 relative z-10 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-visible p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.pulse && (
                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusConfig.dot} animate-ping opacity-50`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-lg text-slate-900">{statusConfig.label}</span>
                </div>
                {job.workerStatus === 'completed' && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                )}
                {job.workerStatus === 'on_my_way' && job.workerEta && (
                  <span className="text-sm font-semibold text-[#2563EB] bg-[#2563EB]/10 px-3 py-1 rounded-full flex-shrink-0">
                    ETA: {job.workerEta}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1">
                {progressSteps.map((step, idx) => {
                  const stepIdx = getStatusIndex(step.key);
                  const isCompleted = statusIdx > stepIdx;
                  const isCurrent = statusIdx === stepIdx;
                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
                      <div className="flex items-center w-full">
                        {idx > 0 && (
                          <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-[#2563EB]/30' : 'bg-gray-200'}`} />
                        )}
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-[#2563EB]' : 'bg-gray-200'
                        }`} />
                        {idx < progressSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <span className={`text-[9px] mt-1.5 text-center leading-tight ${
                        isCompleted ? 'text-emerald-600 font-medium' : isCurrent ? 'text-[#2563EB] font-semibold' : 'text-slate-400'
                      }`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {job.workerStatusUpdatedAt && (
                <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                  {job.workerStatus === 'on_my_way' && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Signal className="w-2.5 h-2.5" />
                      Live tracking
                    </span>
                  )}
                  <p className="text-[10px] text-slate-400 ml-auto">
                    Updated {formatTimeAgo(job.workerStatusUpdatedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-4 py-4 space-y-4 flex-1">

          {(data.assignments && data.assignments.length > 0) ? (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
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
                  const isActive = ['en_route', 'arrived', 'in_progress'].includes(a.status);
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md"
                          style={{ backgroundColor: color }}>
                          {initials}
                        </div>
                        {isActive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm truncate">{a.worker.name}</p>
                          {a.isPrimary && (
                            <span className="text-[10px] font-medium text-slate-500 bg-gray-100 px-1.5 py-0.5 rounded">Lead</span>
                          )}
                        </div>
                        <p className={`text-xs ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>{statusLabel}</p>
                        {a.worker.phone && (
                          <p className="text-xs text-slate-400">{a.worker.phone}</p>
                        )}
                      </div>
                      {a.worker.phone && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={`sms:${a.worker.phone}`}>
                            <Button variant="outline" size="icon" className="rounded-full border-slate-200">
                              <MessageCircle className="w-4 h-4 text-[#2563EB]" />
                            </Button>
                          </a>
                          <a href={`tel:${a.worker.phone}`}>
                            <Button variant="default" size="icon" className="rounded-full bg-[#2563EB]">
                              <Phone className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
                {crewLocationData?.subcontractors?.map((s) => {
                  const sConf = getStatusConfig(s.status === 'en_route' ? 'on_my_way' : s.status);
                  return (
                    <div key={`sub-list-${s.tokenId}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-400">
                            {s.status === 'en_route' && s.etaMinutes
                              ? `ETA: ~${s.etaMinutes} min`
                              : s.lastUpdated ? `Last update ${formatTimeAgo(s.lastUpdated)}` : 'No location data'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={sConf.bg + ' ' + sConf.text + ' no-default-hover-elevate no-default-active-elevate'}>
                        {sConf.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : worker && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Your Technician</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold text-base shadow-md">
                      {worker.firstName?.[0]}{worker.lastName?.[0]}
                    </div>
                    {job.workerStatus && ['on_my_way', 'arrived', 'in_progress'].includes(job.workerStatus) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{worker.firstName} {worker.lastName}</p>
                    <p className="text-xs text-slate-500">Your assigned technician</p>
                    {worker.phone && (
                      <p className="text-xs text-slate-500 mt-0.5">{worker.phone}</p>
                    )}
                  </div>
                  {worker.phone && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a href={`sms:${worker.phone}`}>
                        <Button variant="outline" size="icon" className="rounded-full border-slate-200">
                          <MessageCircle className="w-4 h-4 text-[#2563EB]" />
                        </Button>
                      </a>
                      <a href={`tel:${worker.phone}`}>
                        <Button variant="default" size="icon" className="rounded-full bg-[#2563EB]">
                          <Phone className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
                {crewLocationData?.subcontractors?.map((s) => {
                  const sConf2 = getStatusConfig(s.status === 'en_route' ? 'on_my_way' : s.status);
                  return (
                    <div key={`sub-tech-${s.tokenId}`} className="flex items-center justify-between gap-3 py-2 mt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-400">
                            {s.status === 'en_route' && s.etaMinutes
                              ? `ETA: ~${s.etaMinutes} min`
                              : s.lastUpdated ? `Last update ${formatTimeAgo(s.lastUpdated)}` : 'No location data'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={sConf2.bg + ' ' + sConf2.text + ' no-default-hover-elevate no-default-active-elevate'}>
                        {sConf2.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
              <span className="font-semibold text-sm">{job.title}</span>
            </div>
            <div className="p-5 space-y-3">
              {job.description && (
                <p className="text-sm text-slate-600">{job.description}</p>
              )}
              {job.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{job.address}</p>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="mt-2 text-[#2563EB] border-[#2563EB]/30">
                          <Navigation className="w-3.5 h-3.5 mr-1.5" />
                          Navigate
                        </Button>
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Progress</span>
                </div>
              </div>
              <div className="p-5">
                <div className="relative pl-8">
                  {[
                    { key: 'assigned', label: 'Scheduled', icon: Calendar, timestamp: job.scheduledAt },
                    { key: 'on_my_way', label: 'On the Way', icon: Navigation, timestamp: null },
                    { key: 'arrived', label: 'Arrived', icon: MapPin, timestamp: null },
                    { key: 'in_progress', label: 'Work Started', icon: Timer, timestamp: job.startedAt },
                    { key: 'completed', label: 'Completed', icon: CheckCircle2, timestamp: job.completedAt },
                  ].map((step, idx, arr) => {
                    const stepIdx = getStatusIndex(step.key);
                    const isCompleted = statusIdx > stepIdx;
                    const isCurrent = statusIdx === stepIdx;
                    const isFuture = statusIdx < stepIdx;
                    const isLast = idx === arr.length - 1;
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Materials</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {data.materials.map((material, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="text-sm text-slate-800">{material.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
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
              <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Documents & Payments</span>
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
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white px-5 py-3">
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
                    className="resize-none min-h-[100px] border-gray-200 text-sm bg-white text-slate-900 placeholder:text-slate-400"
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

        <div className="text-center py-8 space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/portal'}
            className="text-[#2563EB] border-[#2563EB]/30"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Open Client Portal
          </Button>
          <div className="flex items-center justify-center gap-2.5">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-9 h-9 object-contain" />
            <span className="text-sm font-medium text-[#2563EB]/70">Powered by <strong className="text-[#2563EB]">JobRunner</strong></span>
          </div>
          {business.abn && (
            <p className="text-xs text-slate-400">ABN: {business.abn}</p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#2563EB]/50">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure & encrypted</span>
          </div>
        </div>
      </div>

      {selectedPhoto !== null && hasPhotos && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl max-h-[80vh] w-full">
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
