import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Shield, ClipboardList, MapPin, Phone,
  Plus, Trash2, Edit, CheckCircle2, XCircle, Clock,
  Flame, AlertCircle, FileText, HardHat, Activity,
  Users, Siren, Eye, ChevronDown, ChevronUp,
  Building2, Zap, ArrowLeft
} from "lucide-react";
import { useLocation } from "wouter";

const WHS_ROLE_LABELS: Record<string, string> = {
  first_aid_officer: "First Aid Officer",
  hsr: "Health & Safety Rep (HSR)",
  whs_committee: "WHS Committee Member",
  fire_warden: "Fire Warden",
  none: "No WHS Role",
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  near_miss: "Near Miss",
  injury: "Injury",
  property_damage: "Property Damage",
  environmental: "Environmental",
  dangerous_occurrence: "Dangerous Occurrence",
  notifiable_incident: "Notifiable Incident",
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  moderate: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  serious: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  critical: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100",
};

const SIGN_CATEGORY_ICONS: Record<string, { icon: typeof Shield; color: string }> = {
  mandatory: { icon: Shield, color: "text-blue-600" },
  prohibition: { icon: XCircle, color: "text-red-600" },
  warning: { icon: AlertTriangle, color: "text-yellow-600" },
  emergency: { icon: Plus, color: "text-green-600" },
  fire: { icon: Flame, color: "text-red-500" },
};

function IncidentReportsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", incidentType: "near_miss", severity: "minor",
    location: "", reportedTo: "", reportedToRole: "", workerName: "",
    immediateActions: "", injuryDetails: "", bodyPartAffected: "",
    treatmentProvided: "", witnesses: [] as string[], isNotifiable: false,
    followUpActions: "",
  });
  const [witnessInput, setWitnessInput] = useState("");

  const { data: reports = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/incidents"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/incidents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/incidents"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Incident report created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/whs/incidents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/incidents"] });
      setShowForm(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Incident report updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/incidents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/incidents"] });
      toast({ title: "Incident report deleted" });
    },
  });

  function resetForm() {
    setFormData({
      title: "", description: "", incidentType: "near_miss", severity: "minor",
      location: "", reportedTo: "", reportedToRole: "", workerName: "",
      immediateActions: "", injuryDetails: "", bodyPartAffected: "",
      treatmentProvided: "", witnesses: [], isNotifiable: false, followUpActions: "",
    });
    setWitnessInput("");
  }

  function handleEdit(report: any) {
    setFormData({
      title: report.title || "", description: report.description || "",
      incidentType: report.incidentType || "near_miss", severity: report.severity || "minor",
      location: report.location || "", reportedTo: report.reportedTo || "",
      reportedToRole: report.reportedToRole || "", workerName: report.workerName || "",
      immediateActions: report.immediateActions || "", injuryDetails: report.injuryDetails || "",
      bodyPartAffected: report.bodyPartAffected || "", treatmentProvided: report.treatmentProvided || "",
      witnesses: report.witnesses || [], isNotifiable: report.isNotifiable || false,
      followUpActions: report.followUpActions || "",
    });
    setEditingId(report.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!formData.title || !formData.description) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function addWitness() {
    if (witnessInput.trim()) {
      setFormData(prev => ({ ...prev, witnesses: [...prev.witnesses, witnessInput.trim()] }));
      setWitnessInput("");
    }
  }

  const openCount = reports.filter((r: any) => r.status === "open").length;
  const notifiableCount = reports.filter((r: any) => r.isNotifiable).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="w-3 h-3" /> {openCount} Open
          </Badge>
          {notifiableCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Siren className="w-3 h-3" /> {notifiableCount} Notifiable
            </Badge>
          )}
          <Badge variant="secondary">{reports.length} Total</Badge>
        </div>
        <Button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Report Incident
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? "Edit" : "New"} Incident Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Incident Title *</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of the incident" />
              </div>
              <div className="space-y-2">
                <Label>Incident Type</Label>
                <Select value={formData.incidentType} onValueChange={v => setFormData(p => ({ ...p, incidentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={v => setFormData(p => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="serious">Serious</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="Where did it happen?" />
              </div>
              <div className="space-y-2">
                <Label>Reported To</Label>
                <Input value={formData.reportedTo} onChange={e => setFormData(p => ({ ...p, reportedTo: e.target.value }))} placeholder="Name of supervisor/HSR" />
              </div>
              <div className="space-y-2">
                <Label>Their Role</Label>
                <Select value={formData.reportedToRole || "supervisor"} onValueChange={v => setFormData(p => ({ ...p, reportedToRole: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="leading_hand">Leading Hand</SelectItem>
                    <SelectItem value="foreman">Foreman</SelectItem>
                    <SelectItem value="hse_advisor">HSE Advisor</SelectItem>
                    <SelectItem value="hsr">HSR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Worker Involved</Label>
                <Input value={formData.workerName} onChange={e => setFormData(p => ({ ...p, workerName: e.target.value }))} placeholder="Name of injured/involved worker" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description of what happened..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Immediate Actions Taken</Label>
              <Textarea value={formData.immediateActions} onChange={e => setFormData(p => ({ ...p, immediateActions: e.target.value }))} placeholder="What was done immediately after the incident?" rows={2} />
            </div>

            {(formData.incidentType === "injury" || formData.incidentType === "notifiable_incident") && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Injury Details</Label>
                  <Input value={formData.injuryDetails} onChange={e => setFormData(p => ({ ...p, injuryDetails: e.target.value }))} placeholder="Type of injury" />
                </div>
                <div className="space-y-2">
                  <Label>Body Part Affected</Label>
                  <Input value={formData.bodyPartAffected} onChange={e => setFormData(p => ({ ...p, bodyPartAffected: e.target.value }))} placeholder="e.g. Left hand, Head" />
                </div>
                <div className="space-y-2">
                  <Label>Treatment Provided</Label>
                  <Input value={formData.treatmentProvided} onChange={e => setFormData(p => ({ ...p, treatmentProvided: e.target.value }))} placeholder="First aid given" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Witnesses</Label>
              <div className="flex gap-2">
                <Input value={witnessInput} onChange={e => setWitnessInput(e.target.value)} placeholder="Witness name" onKeyDown={e => e.key === "Enter" && addWitness()} />
                <Button type="button" variant="outline" onClick={addWitness}>Add</Button>
              </div>
              {formData.witnesses.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {formData.witnesses.map((w, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {w}
                      <button onClick={() => setFormData(p => ({ ...p, witnesses: p.witnesses.filter((_, idx) => idx !== i) }))}>
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Follow-up Actions Required</Label>
              <Textarea value={formData.followUpActions} onChange={e => setFormData(p => ({ ...p, followUpActions: e.target.value }))} placeholder="What needs to happen next to prevent recurrence?" rows={2} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="notifiable" checked={formData.isNotifiable} onChange={e => setFormData(p => ({ ...p, isNotifiable: e.target.checked }))} />
              <Label htmlFor="notifiable" className="cursor-pointer">This is a notifiable incident (must be reported to WHS regulator)</Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Update" : "Submit"} Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No incident reports yet. Report incidents to keep your site safe.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <Card key={report.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium">{report.title}</span>
                      <Badge className={SEVERITY_COLORS[report.severity] || ""}>{report.severity}</Badge>
                      <Badge variant="outline">{INCIDENT_TYPE_LABELS[report.incidentType] || report.incidentType}</Badge>
                      {report.isNotifiable && <Badge variant="destructive">Notifiable</Badge>}
                      <Badge variant={report.status === "open" ? "default" : "secondary"}>{report.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      {report.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{report.location}</span>}
                      {report.reportedTo && <span>Reported to: {report.reportedTo}</span>}
                      {report.workerName && <span>Worker: {report.workerName}</span>}
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(report)}><Edit className="w-4 h-4" /></Button>
                    {report.status === "open" && (
                      <Button size="icon" variant="ghost" onClick={() => updateMutation.mutate({ id: report.id, data: { status: "closed" } })}>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(report.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmergencyInfoTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    siteName: "", siteAddress: "", assemblyPoint: "", firstAidLocation: "",
    firstAidOfficer: "", firstAidOfficerPhone: "", emergencyNumber: "000",
    nearestHospital: "", nearestHospitalAddress: "", evacuationRoutes: "",
    fireEquipmentLocations: [] as string[], siteSpecificHazards: [] as string[],
    additionalContacts: [] as { name: string; role: string; phone: string }[],
  });
  const [fireEquipInput, setFireEquipInput] = useState("");
  const [hazardInput, setHazardInput] = useState("");

  const { data: infoList = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/emergency-info"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/emergency-info", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/emergency-info"] });
      setShowForm(false);
      toast({ title: "Emergency info saved" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/whs/emergency-info/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/emergency-info"] });
      setShowForm(false);
      setEditingId(null);
      toast({ title: "Emergency info updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/emergency-info/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/emergency-info"] });
      toast({ title: "Emergency info deleted" });
    },
  });

  function handleEdit(info: any) {
    setFormData({
      siteName: info.siteName || "", siteAddress: info.siteAddress || "",
      assemblyPoint: info.assemblyPoint || "", firstAidLocation: info.firstAidLocation || "",
      firstAidOfficer: info.firstAidOfficer || "", firstAidOfficerPhone: info.firstAidOfficerPhone || "",
      emergencyNumber: info.emergencyNumber || "000", nearestHospital: info.nearestHospital || "",
      nearestHospitalAddress: info.nearestHospitalAddress || "", evacuationRoutes: info.evacuationRoutes || "",
      fireEquipmentLocations: info.fireEquipmentLocations || [],
      siteSpecificHazards: info.siteSpecificHazards || [],
      additionalContacts: info.additionalContacts || [],
    });
    setEditingId(info.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!formData.siteName) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Site-specific emergency plans with assembly points, first aid, and evacuation routes.</p>
        <Button onClick={() => { setEditingId(null); setFormData({ siteName: "", siteAddress: "", assemblyPoint: "", firstAidLocation: "", firstAidOfficer: "", firstAidOfficerPhone: "", emergencyNumber: "000", nearestHospital: "", nearestHospitalAddress: "", evacuationRoutes: "", fireEquipmentLocations: [], siteSpecificHazards: [], additionalContacts: [] }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Site Emergency Plan
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{editingId ? "Edit" : "New"} Emergency Plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site Name *</Label>
                <Input value={formData.siteName} onChange={e => setFormData(p => ({ ...p, siteName: e.target.value }))} placeholder="e.g. 42 Smith St Build" />
              </div>
              <div className="space-y-2">
                <Label>Site Address</Label>
                <Input value={formData.siteAddress} onChange={e => setFormData(p => ({ ...p, siteAddress: e.target.value }))} placeholder="Full address" />
              </div>
              <div className="space-y-2">
                <Label>Assembly Point</Label>
                <Input value={formData.assemblyPoint} onChange={e => setFormData(p => ({ ...p, assemblyPoint: e.target.value }))} placeholder="e.g. Front car park" />
              </div>
              <div className="space-y-2">
                <Label>First Aid Station Location</Label>
                <Input value={formData.firstAidLocation} onChange={e => setFormData(p => ({ ...p, firstAidLocation: e.target.value }))} placeholder="e.g. Site office" />
              </div>
              <div className="space-y-2">
                <Label>First Aid Officer</Label>
                <Input value={formData.firstAidOfficer} onChange={e => setFormData(p => ({ ...p, firstAidOfficer: e.target.value }))} placeholder="Name" />
              </div>
              <div className="space-y-2">
                <Label>First Aid Officer Phone</Label>
                <Input value={formData.firstAidOfficerPhone} onChange={e => setFormData(p => ({ ...p, firstAidOfficerPhone: e.target.value }))} placeholder="Phone number" />
              </div>
              <div className="space-y-2">
                <Label>Emergency Number</Label>
                <Input value={formData.emergencyNumber} onChange={e => setFormData(p => ({ ...p, emergencyNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nearest Hospital</Label>
                <Input value={formData.nearestHospital} onChange={e => setFormData(p => ({ ...p, nearestHospital: e.target.value }))} placeholder="Hospital name" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Nearest Hospital Address</Label>
                <Input value={formData.nearestHospitalAddress} onChange={e => setFormData(p => ({ ...p, nearestHospitalAddress: e.target.value }))} placeholder="Hospital address" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Evacuation Routes</Label>
              <Textarea value={formData.evacuationRoutes} onChange={e => setFormData(p => ({ ...p, evacuationRoutes: e.target.value }))} placeholder="Describe evacuation routes..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Fire Equipment Locations</Label>
              <div className="flex gap-2">
                <Input value={fireEquipInput} onChange={e => setFireEquipInput(e.target.value)} placeholder="e.g. Fire extinguisher - near site office" onKeyDown={e => { if (e.key === "Enter") { setFormData(p => ({ ...p, fireEquipmentLocations: [...p.fireEquipmentLocations, fireEquipInput.trim()] })); setFireEquipInput(""); } }} />
                <Button type="button" variant="outline" onClick={() => { if (fireEquipInput.trim()) { setFormData(p => ({ ...p, fireEquipmentLocations: [...p.fireEquipmentLocations, fireEquipInput.trim()] })); setFireEquipInput(""); } }}>Add</Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {formData.fireEquipmentLocations.map((loc, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{loc}<button onClick={() => setFormData(p => ({ ...p, fireEquipmentLocations: p.fireEquipmentLocations.filter((_, idx) => idx !== i) }))}><XCircle className="w-3 h-3" /></button></Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : infoList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Siren className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No emergency plans created yet. Set up emergency info for your sites.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infoList.map((info: any) => (
            <Card key={info.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />{info.siteName}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(info)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(info.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {info.siteAddress && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{info.siteAddress}</p>}
                <div className="grid grid-cols-2 gap-2">
                  {info.assemblyPoint && <div><span className="font-medium text-xs uppercase text-muted-foreground">Assembly Point</span><p>{info.assemblyPoint}</p></div>}
                  {info.firstAidLocation && <div><span className="font-medium text-xs uppercase text-muted-foreground">First Aid</span><p>{info.firstAidLocation}</p></div>}
                  {info.firstAidOfficer && <div><span className="font-medium text-xs uppercase text-muted-foreground">First Aid Officer</span><p>{info.firstAidOfficer} {info.firstAidOfficerPhone && <a href={`tel:${info.firstAidOfficerPhone}`} className="text-primary ml-1"><Phone className="w-3 h-3 inline" /></a>}</p></div>}
                  {info.nearestHospital && <div><span className="font-medium text-xs uppercase text-muted-foreground">Nearest Hospital</span><p>{info.nearestHospital}</p></div>}
                </div>
                {info.emergencyNumber && (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="destructive" className="gap-1"><Phone className="w-3 h-3" /> Emergency: {info.emergencyNumber}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function JsaTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedJsa, setExpandedJsa] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", siteAddress: "", assessedBy: "",
    ppeRequirements: [] as string[],
    steps: [{ taskDescription: "", hazards: "", riskLevel: "medium", controlMeasures: "", responsiblePerson: "" }],
  });

  const PPE_OPTIONS = ["Hard Hat", "Safety Glasses", "Hi-Vis Vest", "Safety Boots", "Hearing Protection", "Gloves", "P2 Respirator", "Safety Harness", "FR Clothing", "Sunscreen SPF50+"];

  const { data: jsaDocs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/jsa"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/jsa", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/jsa"] });
      setShowForm(false);
      toast({ title: "JSA created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/jsa/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/jsa"] });
      toast({ title: "JSA deleted" });
    },
  });

  const RISK_COLORS: Record<string, string> = {
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    extreme: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  function addStep() {
    setFormData(p => ({
      ...p,
      steps: [...p.steps, { taskDescription: "", hazards: "", riskLevel: "medium", controlMeasures: "", responsiblePerson: "" }],
    }));
  }

  function updateStep(index: number, field: string, value: string) {
    setFormData(p => ({
      ...p,
      steps: p.steps.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  }

  function removeStep(index: number) {
    if (formData.steps.length <= 1) return;
    setFormData(p => ({ ...p, steps: p.steps.filter((_, i) => i !== index) }));
  }

  function handleSubmit() {
    if (!formData.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const validSteps = formData.steps.filter(s => s.taskDescription && s.hazards && s.controlMeasures);
    if (validSteps.length === 0) {
      toast({ title: "At least one complete step is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...formData, steps: validSteps });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Break jobs into steps, identify hazards per step, and assign control measures.</p>
        <Button onClick={() => { setFormData({ title: "", description: "", siteAddress: "", assessedBy: "", ppeRequirements: [], steps: [{ taskDescription: "", hazards: "", riskLevel: "medium", controlMeasures: "", responsiblePerson: "" }] }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Create JSA
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">New Job Safety Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Roof Repair - 42 Smith St" />
              </div>
              <div className="space-y-2">
                <Label>Site Address</Label>
                <Input value={formData.siteAddress} onChange={e => setFormData(p => ({ ...p, siteAddress: e.target.value }))} placeholder="Job site address" />
              </div>
              <div className="space-y-2">
                <Label>Assessed By</Label>
                <Input value={formData.assessedBy} onChange={e => setFormData(p => ({ ...p, assessedBy: e.target.value }))} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Brief scope of work" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>PPE Requirements</Label>
              <div className="flex gap-2 flex-wrap">
                {PPE_OPTIONS.map(ppe => (
                  <Badge key={ppe} variant={formData.ppeRequirements.includes(ppe) ? "default" : "outline"} className="cursor-pointer" onClick={() => setFormData(p => ({
                    ...p,
                    ppeRequirements: p.ppeRequirements.includes(ppe) ? p.ppeRequirements.filter(r => r !== ppe) : [...p.ppeRequirements, ppe],
                  }))}>{ppe}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Job Steps</Label>
                <Button variant="outline" size="sm" onClick={addStep}><Plus className="w-3 h-3 mr-1" /> Add Step</Button>
              </div>
              {formData.steps.map((step, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Step {i + 1}</span>
                      {formData.steps.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="w-3 h-3" /></Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Task Description *</Label>
                        <Input value={step.taskDescription} onChange={e => updateStep(i, "taskDescription", e.target.value)} placeholder="What's the task?" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hazards *</Label>
                        <Input value={step.hazards} onChange={e => updateStep(i, "hazards", e.target.value)} placeholder="What could go wrong?" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Risk Level</Label>
                        <Select value={step.riskLevel} onValueChange={v => updateStep(i, "riskLevel", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="extreme">Extreme</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Responsible Person</Label>
                        <Input value={step.responsiblePerson} onChange={e => updateStep(i, "responsiblePerson", e.target.value)} placeholder="Who's responsible?" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Control Measures *</Label>
                      <Textarea value={step.controlMeasures} onChange={e => updateStep(i, "controlMeasures", e.target.value)} placeholder="How will the risk be controlled?" rows={2} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>Create JSA</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : jsaDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No JSAs created yet. Create a Job Safety Analysis before starting work.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jsaDocs.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedJsa(expandedJsa === doc.id ? null : doc.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{doc.title}</span>
                      <Badge variant={doc.status === "active" ? "default" : "secondary"}>{doc.status}</Badge>
                      {expandedJsa === doc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                      {doc.siteAddress && <span><MapPin className="w-3 h-3 inline mr-1" />{doc.siteAddress}</span>}
                      {doc.assessedBy && <span>Assessed by: {doc.assessedBy}</span>}
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(doc.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                {expandedJsa === doc.id && doc.steps && (
                  <div className="mt-3 space-y-2">
                    {doc.ppeRequirements?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        <span className="text-xs font-medium text-muted-foreground mr-1">PPE:</span>
                        {doc.ppeRequirements.map((ppe: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{ppe}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 text-xs font-medium">#</th>
                            <th className="text-left p-2 text-xs font-medium">Task</th>
                            <th className="text-left p-2 text-xs font-medium">Hazards</th>
                            <th className="text-left p-2 text-xs font-medium">Risk</th>
                            <th className="text-left p-2 text-xs font-medium">Controls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doc.steps.map((step: any, i: number) => (
                            <tr key={step.id} className="border-t">
                              <td className="p-2 text-xs">{i + 1}</td>
                              <td className="p-2 text-xs">{step.taskDescription}</td>
                              <td className="p-2 text-xs">{step.hazards}</td>
                              <td className="p-2"><Badge className={`text-xs ${RISK_COLORS[step.riskLevel] || ""}`}>{step.riskLevel}</Badge></td>
                              <td className="p-2 text-xs">{step.controlMeasures}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HazardousEnvironmentsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState("");

  const { data: envs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/hazardous-environments"] });
  const { data: envTypes = [] } = useQuery<any[]>({ queryKey: ["/api/whs/reference/environment-types"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/hazardous-environments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/hazardous-environments"] });
      setShowForm(false);
      setSelectedType("");
      toast({ title: "Hazardous environment added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/hazardous-environments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/hazardous-environments"] });
      toast({ title: "Hazardous environment removed" });
    },
  });

  function handleAddEnvironment() {
    const envType = envTypes.find((t: any) => t.type === selectedType);
    if (!envType) return;
    createMutation.mutate({
      environmentType: envType.type,
      hazards: envType.defaultHazards,
      controlMeasures: [],
      requiredPpe: envType.defaultPpe,
      requiredLicenses: envType.requiredLicenses,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">Track hazardous environments on your sites with pre-loaded hazards and PPE requirements.</p>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Add Environment</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Add Hazardous Environment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Environment Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue placeholder="Select an environment type..." /></SelectTrigger>
                <SelectContent>
                  {envTypes.map((t: any) => (
                    <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedType && (() => {
              const envType = envTypes.find((t: any) => t.type === selectedType);
              if (!envType) return null;
              return (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Default Hazards</span>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {envType.defaultHazards.map((h: string, i: number) => (
                        <Badge key={i} variant="destructive">{h}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Required PPE</span>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {envType.defaultPpe.map((p: string, i: number) => (
                        <Badge key={i} variant="outline">{p}</Badge>
                      ))}
                    </div>
                  </div>
                  {envType.requiredLicenses.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Required Licenses</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {envType.requiredLicenses.map((l: string, i: number) => (
                          <Badge key={i} variant="secondary">{l}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setSelectedType(""); }}>Cancel</Button>
              <Button onClick={handleAddEnvironment} disabled={!selectedType || createMutation.isPending}>Add to Site</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : envs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No hazardous environments tracked yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {envs.map((env: any) => {
            const envType = envTypes.find((t: any) => t.type === env.environmentType);
            return (
              <Card key={env.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{envType?.label || env.environmentType}</CardTitle>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(env.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {env.hazards?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Hazards</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {env.hazards.map((h: string, i: number) => (
                          <Badge key={i} variant="destructive" className="text-xs">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {env.requiredPpe?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">PPE Required</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {env.requiredPpe.map((p: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SafetySignageTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ signType: "", signCategory: "", location: "", description: "" });

  const { data: signs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/safety-signage"] });
  const { data: signTypes = [] } = useQuery<any[]>({ queryKey: ["/api/whs/reference/sign-types"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/safety-signage", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/safety-signage"] });
      setShowForm(false);
      toast({ title: "Safety sign added" });
    },
  });

  const toggleInstalled = useMutation({
    mutationFn: ({ id, isInstalled }: { id: string; isInstalled: boolean }) =>
      apiRequest("PATCH", `/api/whs/safety-signage/${id}`, { isInstalled, installedDate: isInstalled ? new Date().toISOString() : null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/whs/safety-signage"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/safety-signage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/safety-signage"] });
      toast({ title: "Safety sign removed" });
    },
  });

  const selectedCategory = signTypes.find((c: any) => c.category === formData.signCategory);
  const installedCount = signs.filter((s: any) => s.isInstalled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{installedCount}/{signs.length} Installed</Badge>
        </div>
        <Button onClick={() => { setFormData({ signType: "", signCategory: "", location: "", description: "" }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Required Sign
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Add Required Safety Sign</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sign Category</Label>
                <Select value={formData.signCategory} onValueChange={v => setFormData(p => ({ ...p, signCategory: v, signType: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {signTypes.map((c: any) => (
                      <SelectItem key={c.category} value={c.category}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCategory && (
                <div className="space-y-2">
                  <Label>Sign Type</Label>
                  <Select value={formData.signType} onValueChange={v => setFormData(p => ({ ...p, signType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select sign..." /></SelectTrigger>
                    <SelectContent>
                      {selectedCategory.signs.map((s: string) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="Where should this sign be?" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Additional details" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => { if (!formData.signType || !formData.signCategory) { toast({ title: "Select a sign type", variant: "destructive" }); return; } createMutation.mutate(formData); }} disabled={createMutation.isPending}>Add Sign</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : signs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No safety signage requirements tracked yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(
            signs.reduce((acc: Record<string, any[]>, sign: any) => {
              const cat = sign.signCategory || "other";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(sign);
              return acc;
            }, {})
          ).map(([category, categorySigns]) => {
            const catInfo = SIGN_CATEGORY_ICONS[category];
            const catLabel = signTypes.find((c: any) => c.category === category)?.label || category;
            const Icon = catInfo?.icon || Shield;
            return (
              <div key={category}>
                <h3 className={`text-sm font-medium mb-2 flex items-center gap-1 ${catInfo?.color || ""}`}>
                  <Icon className="w-4 h-4" /> {catLabel}
                </h3>
                <div className="space-y-1 ml-5">
                  {(categorySigns as any[]).map((sign: any) => (
                    <div key={sign.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-2 flex-1">
                        <button onClick={() => toggleInstalled.mutate({ id: sign.id, isInstalled: !sign.isInstalled })}>
                          {sign.isInstalled ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />}
                        </button>
                        <span className={`text-sm ${sign.isInstalled ? "line-through text-muted-foreground" : ""}`}>{sign.signType}</span>
                        {sign.location && <span className="text-xs text-muted-foreground">({sign.location})</span>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(sign.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WhsRolesTab() {
  const { toast } = useToast();
  const { data: teamRoles = {} } = useQuery<Record<string, any[]>>({ queryKey: ["/api/whs/team-roles"] });

  const roleCounts = Object.entries(teamRoles).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign WHS roles to team members. Manage roles from the Team section — assign First Aid Officer, HSR, WHS Committee, or Fire Warden roles to your workers.
      </p>
      {roleCounts === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No WHS roles assigned yet. Go to Team to assign roles.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(teamRoles).map(([role, members]) => (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {role === "first_aid_officer" && <Plus className="w-4 h-4 text-green-600" />}
                  {role === "hsr" && <Shield className="w-4 h-4 text-blue-600" />}
                  {role === "whs_committee" && <Users className="w-4 h-4 text-purple-600" />}
                  {role === "fire_warden" && <Flame className="w-4 h-4 text-red-600" />}
                  {WHS_ROLE_LABELS[role] || role}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(members as any[]).map((member: any) => (
                    <div key={member.id} className="flex items-center gap-2 text-sm">
                      <HardHat className="w-4 h-4 text-muted-foreground" />
                      <span>{member.firstName} {member.lastName}</span>
                      {member.phone && (
                        <a href={`tel:${member.phone}`} className="text-primary ml-auto"><Phone className="w-3 h-3" /></a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhsHub() {
  const [, setLocation] = useLocation();

  const { data: incidents = [] } = useQuery<any[]>({ queryKey: ["/api/whs/incidents"] });
  const { data: emergencyInfo = [] } = useQuery<any[]>({ queryKey: ["/api/whs/emergency-info"] });
  const { data: jsaDocs = [] } = useQuery<any[]>({ queryKey: ["/api/whs/jsa"] });

  const openIncidents = incidents.filter((r: any) => r.status === "open").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> WHS Hub
            </h1>
            <p className="text-sm text-muted-foreground">Work Health & Safety Management</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
              <div className="text-2xl font-bold">{openIncidents}</div>
              <div className="text-xs text-muted-foreground">Open Incidents</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Siren className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold">{emergencyInfo.length}</div>
              <div className="text-xs text-muted-foreground">Emergency Plans</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <ClipboardList className="w-5 h-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold">{jsaDocs.length}</div>
              <div className="text-xs text-muted-foreground">JSAs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Activity className="w-5 h-5 mx-auto mb-1 text-purple-600" />
              <div className="text-2xl font-bold">{incidents.length}</div>
              <div className="text-xs text-muted-foreground">Total Reports</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="incidents" className="gap-1"><AlertTriangle className="w-3 h-3" /> Incidents</TabsTrigger>
            <TabsTrigger value="emergency" className="gap-1"><Siren className="w-3 h-3" /> Emergency</TabsTrigger>
            <TabsTrigger value="jsa" className="gap-1"><ClipboardList className="w-3 h-3" /> JSA</TabsTrigger>
            <TabsTrigger value="environments" className="gap-1"><Zap className="w-3 h-3" /> Environments</TabsTrigger>
            <TabsTrigger value="signage" className="gap-1"><Eye className="w-3 h-3" /> Signage</TabsTrigger>
            <TabsTrigger value="roles" className="gap-1"><Users className="w-3 h-3" /> WHS Roles</TabsTrigger>
          </TabsList>

          <TabsContent value="incidents"><IncidentReportsTab /></TabsContent>
          <TabsContent value="emergency"><EmergencyInfoTab /></TabsContent>
          <TabsContent value="jsa"><JsaTab /></TabsContent>
          <TabsContent value="environments"><HazardousEnvironmentsTab /></TabsContent>
          <TabsContent value="signage"><SafetySignageTab /></TabsContent>
          <TabsContent value="roles"><WhsRolesTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
