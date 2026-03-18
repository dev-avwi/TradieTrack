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
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Shield, ClipboardList, MapPin, Phone,
  Plus, Trash2, Edit, CheckCircle2, XCircle, Clock,
  Flame, AlertCircle, FileText, HardHat, Activity,
  Siren, Eye, ChevronDown, ChevronUp,
  ArrowLeft, Download, TrendingUp,
  ShieldCheck, ShieldAlert, ArrowRight, CircleAlert,
  BookOpen, BadgeCheck, HeartPulse, ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";


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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3">
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

          <Card className="lg:col-span-2 lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 bg-card space-y-3 text-sm">
                <div className="border-b pb-2 mb-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Incident Report</div>
                  <p className="font-semibold text-base mt-1">{formData.title || "Untitled Incident"}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Type</div>
                    <div>{INCIDENT_TYPE_LABELS[formData.incidentType] || formData.incidentType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Severity</div>
                    <Badge variant={formData.severity === 'critical' || formData.severity === 'serious' ? 'destructive' : 'secondary'} className="text-xs mt-0.5">
                      {formData.severity}
                    </Badge>
                  </div>
                  {formData.location && (
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {formData.location}</div>
                    </div>
                  )}
                  {formData.workerName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Worker</div>
                      <div>{formData.workerName}</div>
                    </div>
                  )}
                  {formData.reportedTo && (
                    <div>
                      <div className="text-xs text-muted-foreground">Reported To</div>
                      <div>{formData.reportedTo}</div>
                    </div>
                  )}
                </div>
                {formData.description && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Description</div>
                    <p className="mt-1 whitespace-pre-wrap">{formData.description}</p>
                  </div>
                )}
                {formData.immediateActions && (
                  <div>
                    <div className="text-xs text-muted-foreground">Immediate Actions</div>
                    <p className="mt-1">{formData.immediateActions}</p>
                  </div>
                )}
                {formData.injuryDetails && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Injury</div>
                    <p>{formData.injuryDetails}{formData.bodyPartAffected ? ` — ${formData.bodyPartAffected}` : ''}</p>
                    {formData.treatmentProvided && <p className="text-xs text-muted-foreground">Treatment: {formData.treatmentProvided}</p>}
                  </div>
                )}
                {formData.witnesses.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Witnesses</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {formData.witnesses.map((w, i) => <Badge key={i} variant="outline" className="text-xs">{w}</Badge>)}
                    </div>
                  </div>
                )}
                {formData.followUpActions && (
                  <div>
                    <div className="text-xs text-muted-foreground">Follow-up Actions</div>
                    <p className="mt-1">{formData.followUpActions}</p>
                  </div>
                )}
                {formData.isNotifiable && (
                  <div className="flex items-center gap-1 text-destructive text-xs font-medium pt-2 border-t">
                    <Siren className="w-3 h-3" /> Notifiable Incident — Must be reported to WHS Regulator
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.1)' }}>
              <CheckCircle2 className="w-6 h-6" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
            </div>
            <h3 className="font-semibold mb-1">No incidents reported</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your safety record is clean. Report any workplace incidents here to maintain compliance.
            </p>
            <Button size="sm" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Report Incident
            </Button>
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
                    <a href={`/api/whs/incidents/${report.id}/pdf`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost"><Download className="w-4 h-4" /></Button>
                    </a>
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

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100",
};

const HAZARD_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function PpeChecklistTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    workerName: "", date: today, hardHat: false, hiVis: false,
    safetyBoots: false, safetyGlasses: false, hearingProtection: false,
    gloves: false, sunscreen: false, respirator: false, safetyHarness: false,
    otherPpe: "", allCorrect: false, supervisorName: "", notes: "",
  });

  const { data: checklists = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/ppe-checklists"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/ppe-checklists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/ppe-checklists"] });
      toast({ title: "PPE checklist saved" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/ppe-checklists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/ppe-checklists"] });
      toast({ title: "Checklist deleted" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setForm({
      workerName: "", date: today, hardHat: false, hiVis: false,
      safetyBoots: false, safetyGlasses: false, hearingProtection: false,
      gloves: false, sunscreen: false, respirator: false, safetyHarness: false,
      otherPpe: "", allCorrect: false, supervisorName: "", notes: "",
    });
  };

  const ppeItems = [
    { key: "hardHat", label: "Hard Hat" },
    { key: "hiVis", label: "Hi-Vis Vest/Shirt" },
    { key: "safetyBoots", label: "Safety Boots" },
    { key: "safetyGlasses", label: "Safety Glasses" },
    { key: "hearingProtection", label: "Hearing Protection" },
    { key: "gloves", label: "Gloves" },
    { key: "sunscreen", label: "Sunscreen" },
    { key: "respirator", label: "Respirator/Mask" },
    { key: "safetyHarness", label: "Safety Harness" },
  ];

  const checkedCount = (c: any) => ppeItems.filter(p => c[p.key]).length;

  const handleSubmit = () => {
    if (!form.workerName) {
      toast({ title: "Worker name is required", variant: "destructive" });
      return;
    }
    const allCorrect = ppeItems.every(p => form[p.key as keyof typeof form]);
    createMutation.mutate({ ...form, allCorrect });
  };

  if (isLoading) return <div className="flex justify-center p-8"><Clock className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">PPE Checklists</h3>
          <p className="text-sm text-muted-foreground">Daily PPE check-in for workers. Based on White Card PPE fitting requirements (CPCCWHS1001).</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> New Check-in
        </Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">PPE Check-in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Worker Name *</Label>
                  <Input value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} placeholder="Worker name" />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">PPE Items — tick what the worker is wearing correctly</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ppeItems.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[item.key as keyof typeof form] as boolean}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Other PPE</Label>
                <Input value={form.otherPpe} onChange={(e) => setForm({ ...form, otherPpe: e.target.value })} placeholder="Any additional PPE worn..." />
              </div>

              <div>
                <Label>Supervisor Name</Label>
                <Input value={form.supervisorName} onChange={(e) => setForm({ ...form, supervisorName: e.target.value })} placeholder="Supervisor who verified" />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any issues or observations..." />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save PPE Check-in"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 bg-card space-y-3 text-sm">
                <div className="border-b pb-2 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">PPE Checklist</div>
                    <p className="font-semibold mt-1">{form.workerName || "Worker Name"}</p>
                    <p className="text-xs text-muted-foreground">{form.date}</p>
                  </div>
                  <Badge variant={ppeItems.every(p => form[p.key as keyof typeof form]) ? "default" : "secondary"}>
                    {checkedCount(form)}/{ppeItems.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {ppeItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-xs">
                      <span>{item.label}</span>
                      {form[item.key as keyof typeof form] ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
                {form.otherPpe && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Other PPE</div>
                    <p>{form.otherPpe}</p>
                  </div>
                )}
                {form.supervisorName && (
                  <div>
                    <div className="text-xs text-muted-foreground">Verified by</div>
                    <p>{form.supervisorName}</p>
                  </div>
                )}
                {form.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <p>{form.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {checklists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardHat className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No PPE check-ins yet</p>
            <p className="text-sm text-muted-foreground">Start a daily PPE check-in to track what your workers are wearing on site.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {checklists.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold">{c.workerName}</p>
                    <p className="text-sm text-muted-foreground">{c.date}{c.supervisorName ? ` — Verified by ${c.supervisorName}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.allCorrect ? "default" : "secondary"}>
                      {checkedCount(c)}/{ppeItems.length} items
                    </Badge>
                    <a href={`/api/whs/ppe-checklists/${c.id}/pdf`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost"><Download className="w-4 h-4" /></Button>
                    </a>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ppeItems.map((item) => (
                    <Badge key={item.key} variant={c[item.key] ? "default" : "outline"} className="text-xs">
                      {c[item.key] ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {item.label}
                    </Badge>
                  ))}
                </div>
                {c.otherPpe && <p className="text-xs text-muted-foreground mt-1">Other: {c.otherPpe}</p>}
                {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingRecordsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    workerName: "", courseCode: "CPCCWHS1001", courseName: "Prepare to Work Safely in the Construction Industry (White Card)",
    rtoName: "", completionDate: "", expiryDate: "",
    certificateNumber: "", status: "current", notes: "",
  });

  const commonCourses = [
    { code: "CPCCWHS1001", name: "Prepare to Work Safely in the Construction Industry (White Card)" },
    { code: "HLTAID011", name: "Provide First Aid" },
    { code: "HLTAID009", name: "Provide Cardiopulmonary Resuscitation (CPR)" },
    { code: "TLILIC0003", name: "Licence to Operate a Forklift Truck" },
    { code: "RIIWHS204E", name: "Work Safely at Heights" },
    { code: "CPCCLSF2001A", name: "Licence to Erect, Alter and Dismantle Scaffolding — Basic Level" },
    { code: "CPCCLDG3001A", name: "Licence to Perform Dogging" },
    { code: "TLILIC0005", name: "Licence to Operate a Boom-Type Elevating Work Platform" },
    { code: "UETTDRRF06B", name: "Perform Rescue from a Live LV Panel" },
    { code: "CUSTOM", name: "Other (specify below)" },
  ];

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/training-records"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/training-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/training-records"] });
      toast({ title: "Training record added" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/whs/training-records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/training-records"] });
      toast({ title: "Training record updated" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/training-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/training-records"] });
      toast({ title: "Training record deleted" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      workerName: "", courseCode: "CPCCWHS1001",
      courseName: "Prepare to Work Safely in the Construction Industry (White Card)",
      rtoName: "", completionDate: "", expiryDate: "",
      certificateNumber: "", status: "current", notes: "",
    });
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      workerName: r.workerName || "", courseCode: r.courseCode || "",
      courseName: r.courseName || "", rtoName: r.rtoName || "",
      completionDate: r.completionDate || "", expiryDate: r.expiryDate || "",
      certificateNumber: r.certificateNumber || "", status: r.status || "current",
      notes: r.notes || "",
    });
    setShowForm(true);
  };

  const handleCourseSelect = (code: string) => {
    const course = commonCourses.find(c => c.code === code);
    if (course && code !== "CUSTOM") {
      setForm({ ...form, courseCode: course.code, courseName: course.name });
    } else {
      setForm({ ...form, courseCode: "", courseName: "" });
    }
  };

  const handleSubmit = () => {
    if (!form.workerName || !form.courseCode || !form.courseName || !form.completionDate) {
      toast({ title: "Please fill in worker name, course, and completion date", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "current": return "default";
      case "expiring_soon": return "secondary";
      case "expired": return "destructive";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "current": return "Current";
      case "expiring_soon": return "Expiring Soon";
      case "expired": return "Expired";
      default: return status;
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  };

  if (isLoading) return <div className="flex justify-center p-8"><Clock className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Training Records</h3>
          <p className="text-sm text-muted-foreground">Track team qualifications, licences, and certifications. Get notified before they expire.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> Add Record
        </Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? "Edit Training Record" : "Add Training Record"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Worker Name *</Label>
                <Input value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} placeholder="Worker name" />
              </div>

              <div>
                <Label>Course</Label>
                <Select value={commonCourses.find(c => c.code === form.courseCode)?.code || "CUSTOM"} onValueChange={handleCourseSelect}>
                  <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                  <SelectContent>
                    {commonCourses.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code === "CUSTOM" ? "Other (specify below)" : `${c.code} — ${c.name}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(!commonCourses.find(c => c.code === form.courseCode) || form.courseCode === "") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Course Code *</Label>
                    <Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. CPCCWHS1001" />
                  </div>
                  <div>
                    <Label>Course Name *</Label>
                    <Input value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} placeholder="Course name" />
                  </div>
                </div>
              )}

              <div>
                <Label>RTO / Training Provider</Label>
                <Input value={form.rtoName} onChange={(e) => setForm({ ...form, rtoName: e.target.value })} placeholder="e.g. Blue Dog Training" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Completion Date *</Label>
                  <Input type="date" value={form.completionDate} onChange={(e) => setForm({ ...form, completionDate: e.target.value })} />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Certificate Number</Label>
                <Input value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} placeholder="Certificate or licence number" />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingId ? "Update Record" : "Add Record"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 bg-card space-y-3 text-sm">
                <div className="border-b pb-2 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Training Record</div>
                    <p className="font-semibold mt-1">{form.workerName || "Worker Name"}</p>
                  </div>
                  <Badge variant={getStatusColor(form.status) as any} className="text-xs">
                    {getStatusLabel(form.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Course</div>
                    <div className="font-medium">{form.courseCode || "—"}</div>
                    <div className="text-xs text-muted-foreground">{form.courseName || "—"}</div>
                  </div>
                  {form.rtoName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Training Provider</div>
                      <div>{form.rtoName}</div>
                    </div>
                  )}
                  {form.certificateNumber && (
                    <div>
                      <div className="text-xs text-muted-foreground">Certificate No.</div>
                      <div>{form.certificateNumber}</div>
                    </div>
                  )}
                  {form.completionDate && (
                    <div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                      <div>{form.completionDate}</div>
                    </div>
                  )}
                  {form.expiryDate && (
                    <div>
                      <div className="text-xs text-muted-foreground">Expires</div>
                      <div className={isExpiringSoon(form.expiryDate) ? "text-yellow-600 font-medium" : ""}>
                        {form.expiryDate}
                        {isExpiringSoon(form.expiryDate) && " (soon)"}
                      </div>
                    </div>
                  )}
                </div>
                {form.notes && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <p className="mt-1">{form.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No training records yet</p>
            <p className="text-sm text-muted-foreground">Track your team's White Cards, licences, first aid certs, and other qualifications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r: any) => {
            const expiringSoon = r.expiryDate && isExpiringSoon(r.expiryDate);
            const effectiveStatus = expiringSoon && r.status === "current" ? "expiring_soon" : r.status;
            return (
              <Card key={r.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold">{r.workerName}</p>
                      <p className="text-sm font-medium">{r.courseCode} — {r.courseName}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.rtoName ? `${r.rtoName} | ` : ""}Completed: {r.completionDate}
                        {r.expiryDate ? ` | Expires: ${r.expiryDate}` : ""}
                      </p>
                      {r.certificateNumber && <p className="text-xs text-muted-foreground">Cert #: {r.certificateNumber}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(effectiveStatus) as any}>{getStatusLabel(effectiveStatus)}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HazardReportsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: "", location: "", dateIdentified: new Date().toISOString().split('T')[0],
    timeIdentified: "", recommendedAction: "", dateReportedToSupervisor: "",
    timeReportedToSupervisor: "", reportedBy: "", supervisorName: "",
    riskLevel: "medium", status: "open", notes: "",
  });

  const { data: hazards = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/whs/hazard-reports"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/whs/hazard-reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/hazard-reports"] });
      toast({ title: "Hazard report created" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/whs/hazard-reports/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/hazard-reports"] });
      toast({ title: "Hazard report updated" });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whs/hazard-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whs/hazard-reports"] });
      toast({ title: "Hazard report deleted" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      description: "", location: "", dateIdentified: new Date().toISOString().split('T')[0],
      timeIdentified: "", recommendedAction: "", dateReportedToSupervisor: "",
      timeReportedToSupervisor: "", reportedBy: "", supervisorName: "",
      riskLevel: "medium", status: "open", notes: "",
    });
  };

  const startEdit = (h: any) => {
    setEditingId(h.id);
    setForm({
      description: h.description || "", location: h.location || "",
      dateIdentified: h.dateIdentified || "", timeIdentified: h.timeIdentified || "",
      recommendedAction: h.recommendedAction || "",
      dateReportedToSupervisor: h.dateReportedToSupervisor || "",
      timeReportedToSupervisor: h.timeReportedToSupervisor || "",
      reportedBy: h.reportedBy || "", supervisorName: h.supervisorName || "",
      riskLevel: h.riskLevel || "medium", status: h.status || "open",
      notes: h.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.description || !form.location || !form.reportedBy || !form.recommendedAction) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Clock className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Hazard Reports</h3>
          <p className="text-sm text-muted-foreground">Report hazards spotted on site before they cause an incident. Based on White Card hazard reporting requirements.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1">
          <Plus className="w-4 h-4" /> Report Hazard
        </Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? "Edit Hazard Report" : "Report a Hazard"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Hazard Description *</Label>
                <Textarea placeholder="Briefly describe the hazard..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Location *</Label>
                <Input placeholder="Where is the hazard located?" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date Identified *</Label>
                  <Input type="date" value={form.dateIdentified} onChange={(e) => setForm({ ...form, dateIdentified: e.target.value })} />
                </div>
                <div>
                  <Label>Time Identified</Label>
                  <Input type="time" value={form.timeIdentified} onChange={(e) => setForm({ ...form, timeIdentified: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Recommended Action to Control Hazard *</Label>
                <Textarea placeholder="How would you eliminate or minimise the risk?" value={form.recommendedAction} onChange={(e) => setForm({ ...form, recommendedAction: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date Reported to Supervisor</Label>
                  <Input type="date" value={form.dateReportedToSupervisor} onChange={(e) => setForm({ ...form, dateReportedToSupervisor: e.target.value })} />
                </div>
                <div>
                  <Label>Time Reported</Label>
                  <Input type="time" value={form.timeReportedToSupervisor} onChange={(e) => setForm({ ...form, timeReportedToSupervisor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Reported By *</Label>
                  <Input placeholder="Your name" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} />
                </div>
                <div>
                  <Label>Supervisor Name</Label>
                  <Input placeholder="Supervisor name" value={form.supervisorName} onChange={(e) => setForm({ ...form, supervisorName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Risk Level</Label>
                  <Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea placeholder="Any other details..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update Report" : "Submit Hazard Report"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 bg-card space-y-3 text-sm">
                <div className="border-b pb-2 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Hazard Report</div>
                    <p className="font-semibold mt-1">{form.description || "No description yet"}</p>
                  </div>
                  <Badge variant={form.riskLevel === 'critical' || form.riskLevel === 'high' ? 'destructive' : form.riskLevel === 'medium' ? 'secondary' : 'outline'}>
                    {form.riskLevel.toUpperCase()} RISK
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {form.location && (
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {form.location}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <Badge variant="outline" className="text-xs mt-0.5">{form.status === 'in_progress' ? 'In Progress' : form.status}</Badge>
                  </div>
                  {form.dateIdentified && (
                    <div>
                      <div className="text-xs text-muted-foreground">Date Identified</div>
                      <div>{form.dateIdentified}{form.timeIdentified ? ` at ${form.timeIdentified}` : ''}</div>
                    </div>
                  )}
                  {form.reportedBy && (
                    <div>
                      <div className="text-xs text-muted-foreground">Reported By</div>
                      <div>{form.reportedBy}</div>
                    </div>
                  )}
                  {form.supervisorName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Supervisor</div>
                      <div>{form.supervisorName}</div>
                    </div>
                  )}
                </div>
                {form.recommendedAction && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Recommended Action</div>
                    <p className="mt-1 whitespace-pre-wrap">{form.recommendedAction}</p>
                  </div>
                )}
                {form.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <p className="mt-1">{form.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hazards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hazard reports yet. Spot a hazard? Report it before someone gets hurt.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hazards.map((h: any) => (
            <Card key={h.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={RISK_LEVEL_COLORS[h.riskLevel] || ""}>{h.riskLevel}</Badge>
                      <Badge className={HAZARD_STATUS_COLORS[h.status] || ""}>{h.status === 'in_progress' ? 'In Progress' : h.status}</Badge>
                    </div>
                    <p className="font-medium">{h.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {h.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {h.dateIdentified} {h.timeIdentified && `at ${h.timeIdentified}`}</span>
                      <span>Reported by: {h.reportedBy}</span>
                    </div>
                    {h.recommendedAction && (
                      <p className="text-sm mt-2"><span className="font-medium">Action:</span> {h.recommendedAction}</p>
                    )}
                    {h.supervisorName && (
                      <p className="text-sm text-muted-foreground mt-1">Supervisor: {h.supervisorName}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <a href={`/api/whs/hazard-reports/${h.id}/pdf`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost"><Download className="w-4 h-4" /></Button>
                    </a>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(h)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(h.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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

function SwmsDocumentsTab() {
  const { data: swmsDocs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/swms"] });
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="flex justify-center p-8"><Clock className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Safe Work Method Statements</h3>
          <p className="text-sm text-muted-foreground">All SWMS documents across your jobs. Create new SWMS from a job's safety section.</p>
        </div>
      </div>

      {swmsDocs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No SWMS documents yet</p>
            <p className="text-sm text-muted-foreground">Create a SWMS from a job's safety section to see it here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {swmsDocs.map((doc: any) => (
            <Card key={doc.id} className="hover-elevate cursor-pointer" onClick={() => doc.jobId && setLocation(`/jobs/${doc.jobId}`)}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="font-semibold truncate">{doc.title}</p>
                    </div>
                    {doc.siteAddress && <p className="text-sm text-muted-foreground truncate">{doc.siteAddress}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {doc.hazardCount !== undefined && <span>{doc.hazardCount} hazards</span>}
                      {doc.signatureCount !== undefined && <span>{doc.signatureCount} signatures</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={doc.status === 'approved' || doc.status === 'signed' ? 'default' : 'secondary'}>
                      {doc.status || 'Draft'}
                    </Badge>
                    {doc.jobId && (
                      <a href={`/api/swms/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PDF
                      </a>
                    )}
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

export default function WhsHub() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<string>("overview");

  const { data: incidents = [] } = useQuery<any[]>({ queryKey: ["/api/whs/incidents"] });
  const { data: emergencyInfo = [] } = useQuery<any[]>({ queryKey: ["/api/whs/emergency-info"] });
  const { data: jsaDocs = [] } = useQuery<any[]>({ queryKey: ["/api/whs/jsa"] });
  const { data: hazardReports = [] } = useQuery<any[]>({ queryKey: ["/api/whs/hazard-reports"] });
  const { data: ppeChecklists = [] } = useQuery<any[]>({ queryKey: ["/api/whs/ppe-checklists"] });
  const { data: trainingRecords = [] } = useQuery<any[]>({ queryKey: ["/api/whs/training-records"] });
  const { data: swmsDocs = [] } = useQuery<any[]>({ queryKey: ["/api/swms"] });

  const openIncidents = incidents.filter((r: any) => r.status === "open").length;
  const openHazards = hazardReports.filter((r: any) => r.status === "open").length;
  const expiringTraining = trainingRecords.filter((r: any) => {
    if (!r.expiryDate) return false;
    const diff = new Date(r.expiryDate).getTime() - Date.now();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  }).length;
  const expiredTraining = trainingRecords.filter((r: any) => r.status === 'expired').length;
  const totalDocs = incidents.length + hazardReports.length + jsaDocs.length + swmsDocs.length;

  const sections = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "incidents", label: "Incidents", icon: AlertTriangle, count: openIncidents + openHazards },
    { key: "swms", label: "SWMS & JSA", icon: ClipboardList, count: swmsDocs.length },
    { key: "training", label: "Training", icon: Shield, count: expiringTraining + expiredTraining },
    { key: "compliance", label: "Compliance", icon: HardHat, count: ppeChecklists.length + emergencyInfo.length },
  ];

  const actionItems = openIncidents + openHazards + expiredTraining;
  const complianceItems = [
    { label: "PPE Checked", done: ppeChecklists.length > 0, action: "Add Checklist" },
    { label: "SWMS Current", done: swmsDocs.some((d: any) => d.status === 'approved' || d.status === 'signed'), action: "Create SWMS" },
    { label: "Training Up-to-date", done: trainingRecords.length > 0 && expiredTraining === 0, action: expiredTraining > 0 ? "Renew" : "Add Record" },
    { label: "Emergency Plan", done: emergencyInfo.length > 0, action: "Set Up" },
    { label: "No Open Incidents", done: openIncidents === 0, action: "Review" },
    { label: "No Open Hazards", done: openHazards === 0, action: "Review" },
  ];
  const complianceMet = complianceItems.filter(i => i.done).length;
  const compliancePercent = Math.round((complianceMet / complianceItems.length) * 100);

  const renderOverview = () => {
    const complianceColor = compliancePercent >= 80 ? 'hsl(142.1 76.2% 36.3%)' : compliancePercent >= 50 ? 'hsl(38 92% 50%)' : 'hsl(0 84.2% 60.2%)';
    const complianceStrokeClass = compliancePercent >= 80 ? "stroke-green-500" : compliancePercent >= 50 ? "stroke-yellow-500" : "stroke-red-500";
    const todoCount = complianceItems.filter(i => !i.done).length;

    const navigateToSection = (label: string) => {
      if (label.includes('PPE')) setActiveSection('compliance');
      else if (label.includes('SWMS')) setActiveSection('swms');
      else if (label.includes('Training')) setActiveSection('training');
      else if (label.includes('Emergency')) setActiveSection('compliance');
      else if (label.includes('Incident')) setActiveSection('incidents');
      else if (label.includes('Hazard')) setActiveSection('incidents');
    };

    return (
    <div className="space-y-4">

      {/* Compliance Checklist — the single most important card */}
      <Card>
        <CardContent className="p-4">
          {/* Header with ring + score */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-11 h-11 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground/10" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" strokeWidth="2.5" strokeDasharray={`${compliancePercent}, 100`} strokeLinecap="round"
                  className={complianceStrokeClass} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold" style={{ color: complianceColor }}>{compliancePercent}%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold" style={{ color: complianceColor }}>
                {complianceMet}/{complianceItems.length} Compliant
              </p>
              <p className="text-xs text-muted-foreground">
                {compliancePercent === 100 ? "All safety checks passed" :
                 `${todoCount} item${todoCount !== 1 ? 's' : ''} need attention`}
              </p>
            </div>
          </div>
          {/* Inline checklist items */}
          <div className="space-y-0.5">
            {complianceItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-md hover-elevate cursor-pointer"
                role="button" tabIndex={0}
                onClick={() => navigateToSection(item.label)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToSection(item.label); } }}>
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/25 flex-shrink-0" />
                )}
                <span className={`text-sm flex-1 ${item.done ? 'font-medium' : 'text-muted-foreground'}`}>{item.label}</span>
                {item.done ? (
                  <span className="text-xs font-medium" style={{ color: 'hsl(142.1 76.2% 36.3%)' }}>Done</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary flex-shrink-0">
                    {item.action}
                    <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Required — only shows when there are real issues */}
      {(openIncidents > 0 || openHazards > 0 || expiredTraining > 0 || expiringTraining > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4" style={{ color: 'hsl(0 84.2% 60.2%)' }} />
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Action Required</p>
              <Badge variant="destructive" className="text-xs ml-auto">{actionItems}</Badge>
            </div>
            <div className="space-y-1">
              {openIncidents > 0 && (
                <div className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("incidents")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("incidents"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: 'hsl(38 92% 50% / 0.1)' }}>
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'hsl(38 92% 50%)' }} />
                  </div>
                  <p className="text-sm flex-1">{openIncidents} open incident{openIncidents !== 1 ? 's' : ''}</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              )}
              {openHazards > 0 && (
                <div className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("incidents")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("incidents"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: 'hsl(0 84.2% 60.2% / 0.1)' }}>
                    <ShieldAlert className="h-3.5 w-3.5" style={{ color: 'hsl(0 84.2% 60.2%)' }} />
                  </div>
                  <p className="text-sm flex-1">{openHazards} open hazard{openHazards !== 1 ? 's' : ''}</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              )}
              {expiredTraining > 0 && (
                <div className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("training")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("training"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: 'hsl(0 84.2% 60.2% / 0.1)' }}>
                    <XCircle className="h-3.5 w-3.5" style={{ color: 'hsl(0 84.2% 60.2%)' }} />
                  </div>
                  <p className="text-sm flex-1">{expiredTraining} expired training</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              )}
              {expiringTraining > 0 && (
                <div className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("training")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("training"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: 'hsl(38 92% 50% / 0.1)' }}>
                    <Clock className="h-3.5 w-3.5" style={{ color: 'hsl(38 92% 50%)' }} />
                  </div>
                  <p className="text-sm flex-1">{expiringTraining} expiring soon</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SWMS Documents */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SWMS Documents</p>
            </div>
            {swmsDocs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("swms")}>
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            )}
          </div>
          {swmsDocs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No SWMS documents yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create one from a job's safety section</p>
            </div>
          ) : (
            <div className="space-y-1">
              {swmsDocs.slice(0, 4).map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("swms")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("swms"); } }}>
                  <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                  </div>
                  <Badge variant={doc.status === 'approved' || doc.status === 'signed' ? 'default' : 'outline'} className="text-xs flex-shrink-0">
                    {doc.status || 'draft'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Incidents + Training — only if data exists */}
      {incidents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: 'hsl(38 92% 50%)' }} />
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Incidents</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("incidents")}>
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
            <div className="space-y-1">
              {incidents.slice(0, 3).map((inc: any) => (
                <div key={inc.id} className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("incidents")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("incidents"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: inc.status === 'open' ? 'hsl(38 92% 50% / 0.1)' : 'hsl(142.1 76.2% 36.3% / 0.1)' }}>
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: inc.status === 'open' ? 'hsl(38 92% 50%)' : 'hsl(142.1 76.2% 36.3%)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inc.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{inc.incidentType?.replace(/_/g, ' ')}</p>
                  </div>
                  <Badge variant={inc.status === 'open' ? 'destructive' : 'default'} className="text-xs flex-shrink-0">
                    {inc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {trainingRecords.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Training & Licences</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection("training")}>
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
            <div className="space-y-1">
              {trainingRecords.slice(0, 3).map((rec: any) => (
                <div key={rec.id} className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover-elevate"
                  role="button" tabIndex={0} onClick={() => setActiveSection("training")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSection("training"); } }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: rec.status === 'current' ? 'hsl(142.1 76.2% 36.3% / 0.1)' : rec.status === 'expired' ? 'hsl(0 84.2% 60.2% / 0.1)' : 'hsl(38 92% 50% / 0.1)' }}>
                    <BadgeCheck className="h-3.5 w-3.5" style={{ color: rec.status === 'current' ? 'hsl(142.1 76.2% 36.3%)' : rec.status === 'expired' ? 'hsl(0 84.2% 60.2%)' : 'hsl(38 92% 50%)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rec.workerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{rec.courseCode || rec.courseName}</p>
                  </div>
                  <Badge variant={rec.status === 'current' ? 'default' : rec.status === 'expired' ? 'destructive' : 'outline'} className="text-xs flex-shrink-0">
                    {rec.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">WHS Safety</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {actionItems > 0 ? `${actionItems} item${actionItems !== 1 ? 's' : ''} need attention` : "Compliance, Reporting & Documentation"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-12 sm:pl-0">
            <Button size="sm" className="text-white font-medium press-scale" style={{ backgroundColor: 'hsl(var(--trade))' }}
              onClick={() => setActiveSection("incidents")}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Incident
            </Button>
            <Button variant="outline" size="sm" className="press-scale" onClick={() => setActiveSection("swms")}>
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              SWMS
            </Button>
            <Button variant="outline" size="sm" className="press-scale" onClick={() => setActiveSection("compliance")}>
              <HardHat className="h-3.5 w-3.5 mr-1" />
              PPE
            </Button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.key;
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover-elevate'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {s.label}
                {s.count !== undefined && s.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeSection === "overview" && renderOverview()}
        {activeSection === "incidents" && (
          <div className="space-y-6">
            <IncidentReportsTab />
            <HazardReportsTab />
          </div>
        )}
        {activeSection === "swms" && (
          <div className="space-y-6">
            <SwmsDocumentsTab />
            <JsaTab />
          </div>
        )}
        {activeSection === "training" && <TrainingRecordsTab />}
        {activeSection === "compliance" && (
          <div className="space-y-6">
            <PpeChecklistTab />
            <EmergencyInfoTab />
          </div>
        )}
      </div>
    </div>
  );
}
