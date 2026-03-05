import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  AlertTriangle,
  HardHat,
  Loader2,
  FileText,
  X,
} from "lucide-react";

interface SwmsBuilderProps {
  jobId: string;
  jobTitle?: string;
  jobAddress?: string;
  swmsId?: string;
  onClose?: () => void;
}

interface SwmsTemplate {
  id: string;
  title: string;
  description: string;
}

interface SwmsTemplateDetail {
  id: string;
  title: string;
  description: string;
  hazards: HazardRow[];
  ppeRequirements: string[];
}

interface HazardRow {
  id?: string;
  hazardDescription: string;
  riskConsequence: string;
  likelihood: string;
  consequence: string;
  riskRating: string;
  controlMeasures: string;
  residualLikelihood: string;
  residualConsequence: string;
  residualRiskRating: string;
  responsiblePerson: string;
}

interface SwmsDocument {
  id: string;
  title: string;
  description?: string;
  jobId: string;
  siteAddress?: string;
  workActivityDescription?: string;
  ppeRequirements?: string[];
  emergencyContact?: string;
  firstAidLocation?: string;
  status: string;
  hazards: HazardRow[];
  signatures: any[];
}

type RiskMatrix = Record<string, Record<string, string>>;

const LIKELIHOOD_OPTIONS = [
  { value: "rare", label: "Rare" },
  { value: "unlikely", label: "Unlikely" },
  { value: "possible", label: "Possible" },
  { value: "likely", label: "Likely" },
  { value: "almost_certain", label: "Almost Certain" },
];

const CONSEQUENCE_OPTIONS = [
  { value: "insignificant", label: "Insignificant" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "catastrophic", label: "Catastrophic" },
];

const PPE_OPTIONS = [
  { value: "hard_hat", label: "Hard Hat" },
  { value: "safety_glasses", label: "Safety Glasses" },
  { value: "hi_vis", label: "Hi-Vis Vest" },
  { value: "steel_caps", label: "Steel Cap Boots" },
  { value: "hearing_protection", label: "Hearing Protection" },
  { value: "dust_mask", label: "Dust Mask" },
  { value: "gloves", label: "Gloves" },
  { value: "fall_harness", label: "Fall Harness" },
  { value: "face_shield", label: "Face Shield" },
  { value: "sun_protection", label: "Sun Protection" },
];

function emptyHazard(): HazardRow {
  return {
    hazardDescription: "",
    riskConsequence: "",
    likelihood: "possible",
    consequence: "moderate",
    riskRating: "",
    controlMeasures: "",
    residualLikelihood: "unlikely",
    residualConsequence: "minor",
    residualRiskRating: "",
    responsiblePerson: "",
  };
}

function getRiskBadgeClass(risk: string): string {
  switch (risk) {
    case "low":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "high":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "extreme":
      return "bg-red-900/15 text-red-900 dark:text-red-300 border-red-900/30";
    default:
      return "";
  }
}

function calculateRisk(
  likelihood: string,
  consequence: string,
  matrix: RiskMatrix | undefined
): string {
  if (!matrix || !likelihood || !consequence) return "";
  return matrix[likelihood]?.[consequence] || "";
}

export function SwmsBuilder({
  jobId,
  jobTitle,
  jobAddress,
  swmsId,
  onClose,
}: SwmsBuilderProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(jobTitle ? `SWMS - ${jobTitle}` : "");
  const [siteAddress, setSiteAddress] = useState(jobAddress || "");
  const [workActivityDescription, setWorkActivityDescription] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [selectedPpe, setSelectedPpe] = useState<string[]>([]);
  const [hazards, setHazards] = useState<HazardRow[]>([emptyHazard()]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: riskMatrix } = useQuery<RiskMatrix>({
    queryKey: ["/api/swms/risk-matrix"],
    staleTime: 60000,
  });

  const { data: templates } = useQuery<SwmsTemplate[]>({
    queryKey: ["/api/swms/templates"],
    staleTime: 60000,
  });

  const { data: existingSwms, isLoading: loadingExisting } =
    useQuery<SwmsDocument>({
      queryKey: ["/api/swms", swmsId],
      enabled: !!swmsId,
    });

  useEffect(() => {
    if (existingSwms) {
      setTitle(existingSwms.title || "");
      setSiteAddress(existingSwms.siteAddress || "");
      setWorkActivityDescription(existingSwms.workActivityDescription || "");
      setEmergencyContact(existingSwms.emergencyContact || "");
      setFirstAidLocation(existingSwms.firstAidLocation || "");
      setSelectedPpe(existingSwms.ppeRequirements || []);
      if (existingSwms.hazards && existingSwms.hazards.length > 0) {
        setHazards(existingSwms.hazards);
      }
    }
  }, [existingSwms]);

  const loadTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest(
        "GET",
        `/api/swms/templates/${templateId}`
      );
      return (await res.json()) as SwmsTemplateDetail;
    },
    onSuccess: (template) => {
      setTitle(template.title || title);
      if (template.ppeRequirements) {
        setSelectedPpe(template.ppeRequirements);
      }
      if (template.workActivityDescription) {
        setWorkActivityDescription(template.workActivityDescription);
      }
      if (template.hazards && template.hazards.length > 0) {
        setHazards(
          template.hazards.map((h: any) => ({
            hazardDescription: h.activityTask || h.hazardDescription || "",
            riskConsequence: h.hazard || h.riskConsequence || "",
            likelihood: h.likelihood || "possible",
            consequence: h.consequence || "moderate",
            riskRating: h.riskBefore || h.riskRating || "",
            controlMeasures: h.controlMeasures || "",
            residualLikelihood: "unlikely",
            residualConsequence: "minor",
            residualRiskRating: h.riskAfter || h.residualRiskRating || "",
            responsiblePerson: h.responsiblePerson || "",
          }))
        );
      }
      toast({ title: "Template loaded", description: `Applied "${template.title}" template` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to load template", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const body = {
        title,
        description: title,
        jobId,
        siteAddress,
        workActivityDescription,
        ppeRequirements: selectedPpe,
        emergencyContact,
        firstAidLocation,
        status,
        hazards: hazards.map((h) => ({
          activityTask: h.hazardDescription || 'Activity',
          hazard: h.riskConsequence || 'Hazard',
          likelihood: h.likelihood,
          consequence: h.consequence,
          riskBefore: calculateRisk(h.likelihood, h.consequence, riskMatrix) || 'medium',
          controlMeasures: h.controlMeasures,
          riskAfter: calculateRisk(h.residualLikelihood, h.residualConsequence, riskMatrix) || 'low',
        })),
      };

      if (swmsId) {
        const res = await apiRequest("PATCH", `/api/swms/${swmsId}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/swms", body);
        return res.json();
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "swms"] });
      if (swmsId) {
        queryClient.invalidateQueries({ queryKey: ["/api/swms", swmsId] });
      }
      toast({
        title: status === "draft" ? "Draft saved" : "SWMS activated",
        description:
          status === "draft"
            ? "SWMS saved as draft"
            : "SWMS is now active and ready for signatures",
      });
      onClose?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save SWMS", variant: "destructive" });
    },
  });

  useEffect(() => {
    setHazards((prev) =>
      prev.map((h) => ({
        ...h,
        riskRating: calculateRisk(h.likelihood, h.consequence, riskMatrix),
        residualRiskRating: calculateRisk(
          h.residualLikelihood,
          h.residualConsequence,
          riskMatrix
        ),
      }))
    );
  }, [riskMatrix]);

  const updateHazard = (index: number, field: keyof HazardRow, value: string) => {
    setHazards((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (
        field === "likelihood" ||
        field === "consequence"
      ) {
        updated[index].riskRating = calculateRisk(
          field === "likelihood" ? value : updated[index].likelihood,
          field === "consequence" ? value : updated[index].consequence,
          riskMatrix
        );
      }
      if (
        field === "residualLikelihood" ||
        field === "residualConsequence"
      ) {
        updated[index].residualRiskRating = calculateRisk(
          field === "residualLikelihood" ? value : updated[index].residualLikelihood,
          field === "residualConsequence" ? value : updated[index].residualConsequence,
          riskMatrix
        );
      }
      return updated;
    });
  };

  const addHazard = () => setHazards((prev) => [...prev, emptyHazard()]);
  const removeHazard = (index: number) =>
    setHazards((prev) => prev.filter((_, i) => i !== index));

  const togglePpe = (value: string) => {
    setSelectedPpe((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  if (swmsId && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {swmsId ? "Edit SWMS" : "Create SWMS"}
        </h2>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!swmsId && templates && templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Start from Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="flex-1 min-w-[200px]">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={
                  !selectedTemplateId || loadTemplateMutation.isPending
                }
                onClick={() => {
                  if (selectedTemplateId)
                    loadTemplateMutation.mutate(selectedTemplateId);
                }}
              >
                {loadTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Apply Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="swms-title">Title</Label>
            <Input
              id="swms-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="SWMS document title"
            />
          </div>
          <div>
            <Label htmlFor="swms-site-address">Site Address</Label>
            <Input
              id="swms-site-address"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Work site address"
            />
          </div>
          <div>
            <Label htmlFor="swms-date">Date</Label>
            <Input
              id="swms-date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Work Activity Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={workActivityDescription}
            onChange={(e) => setWorkActivityDescription(e.target.value)}
            placeholder="Describe the high-risk construction work being performed..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Hazard & Risk Assessment
            </span>
            <Button size="sm" variant="outline" onClick={addHazard}>
              <Plus className="h-4 w-4 mr-1" />
              Add Hazard
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hazards.map((hazard, idx) => (
            <div
              key={idx}
              className="border rounded-md p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Hazard {idx + 1}
                </span>
                {hazards.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeHazard(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div>
                <Label>Hazard Description</Label>
                <Textarea
                  value={hazard.hazardDescription}
                  onChange={(e) =>
                    updateHazard(idx, "hazardDescription", e.target.value)
                  }
                  placeholder="Describe the hazard..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Potential Consequence</Label>
                <Input
                  value={hazard.riskConsequence}
                  onChange={(e) =>
                    updateHazard(idx, "riskConsequence", e.target.value)
                  }
                  placeholder="What could happen if not controlled?"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Initial Likelihood</Label>
                  <Select
                    value={hazard.likelihood}
                    onValueChange={(v) => updateHazard(idx, "likelihood", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIKELIHOOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Initial Consequence</Label>
                  <Select
                    value={hazard.consequence}
                    onValueChange={(v) => updateHazard(idx, "consequence", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSEQUENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hazard.riskRating && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Initial Risk:
                  </span>
                  <Badge
                    variant="outline"
                    className={getRiskBadgeClass(hazard.riskRating)}
                  >
                    {hazard.riskRating.toUpperCase()}
                  </Badge>
                </div>
              )}

              <div>
                <Label>Control Measures</Label>
                <Textarea
                  value={hazard.controlMeasures}
                  onChange={(e) =>
                    updateHazard(idx, "controlMeasures", e.target.value)
                  }
                  placeholder="How will this hazard be controlled?"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Residual Likelihood</Label>
                  <Select
                    value={hazard.residualLikelihood}
                    onValueChange={(v) =>
                      updateHazard(idx, "residualLikelihood", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIKELIHOOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Residual Consequence</Label>
                  <Select
                    value={hazard.residualConsequence}
                    onValueChange={(v) =>
                      updateHazard(idx, "residualConsequence", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSEQUENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hazard.residualRiskRating && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Residual Risk:
                  </span>
                  <Badge
                    variant="outline"
                    className={getRiskBadgeClass(hazard.residualRiskRating)}
                  >
                    {hazard.residualRiskRating.toUpperCase()}
                  </Badge>
                </div>
              )}

              <div>
                <Label>Responsible Person</Label>
                <Input
                  value={hazard.responsiblePerson}
                  onChange={(e) =>
                    updateHazard(idx, "responsiblePerson", e.target.value)
                  }
                  placeholder="Who is responsible for this control?"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardHat className="h-4 w-4" />
            PPE Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PPE_OPTIONS.map((ppe) => (
              <label
                key={ppe.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selectedPpe.includes(ppe.value)}
                  onCheckedChange={() => togglePpe(ppe.value)}
                />
                {ppe.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Emergency Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="swms-emergency">Emergency Contact</Label>
            <Input
              id="swms-emergency"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Emergency contact name and number"
            />
          </div>
          <div>
            <Label htmlFor="swms-firstaid">First Aid Location</Label>
            <Input
              id="swms-firstaid"
              value={firstAidLocation}
              onChange={(e) => setFirstAidLocation(e.target.value)}
              placeholder="Location of first aid kit"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          disabled={saveMutation.isPending || !title.trim()}
          onClick={() => saveMutation.mutate("draft")}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save as Draft
        </Button>
        <Button
          disabled={saveMutation.isPending || !title.trim()}
          onClick={() => saveMutation.mutate("active")}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Activate SWMS
        </Button>
      </div>
    </div>
  );
}
