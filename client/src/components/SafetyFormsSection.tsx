import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  PenLine,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { FormRenderer } from "./CustomFormRenderer";
import type { CustomForm, FormSubmission } from "@shared/schema";
import { SAFETY_FORM_TYPES } from "@shared/schema";

interface SafetyFormsSectionProps {
  jobId: string;
  jobStatus: string;
  onSafetyCheckRequired?: () => void;
}

export function SafetyFormsSection({ jobId, jobStatus, onSafetyCheckRequired }: SafetyFormsSectionProps) {
  const { toast } = useToast();
  const [showFormPicker, setShowFormPicker] = useState(false);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);

  const { data: submissions, isLoading: loadingSubmissions } = useQuery<FormSubmission[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
  });

  const { data: forms, isLoading: loadingForms } = useQuery<CustomForm[]>({
    queryKey: ['/api/custom-forms'],
  });

  const isLoading = loadingSubmissions || loadingForms;

  const safetyForms = forms?.filter(f => 
    f.isActive && (f.formType === 'safety' || f.formType === 'compliance' || f.formType === 'inspection')
  ) || [];

  const safetySubmissions = submissions?.filter(s => {
    const form = forms?.find(f => f.id === s.formId);
    return form && (form.formType === 'safety' || form.formType === 'compliance' || form.formType === 'inspection');
  }) || [];

  const getFormById = (formId: string) => forms?.find(f => f.id === formId);

  const hasPendingSignatures = safetySubmissions.some(s => {
    const data = s.submissionData as Record<string, any>;
    const form = getFormById(s.formId);
    return form?.requiresSignature && !data?._signature;
  });

  const hasCompletedSafetyForm = safetySubmissions.some(s => {
    const data = s.submissionData as Record<string, any>;
    const form = getFormById(s.formId);
    return !form?.requiresSignature || data?._signature;
  });

  const getStatusBadge = (submission: FormSubmission) => {
    const form = getFormById(submission.formId);
    const data = submission.submissionData as Record<string, any>;
    const hasSig = data?._signature;

    if (submission.status === 'approved') {
      return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    }
    if (submission.status === 'rejected') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    }
    if (form?.requiresSignature && !hasSig) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400"><PenLine className="h-3 w-3 mr-1" />Pending Signature</Badge>;
    }
    if (submission.status === 'submitted') {
      return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{submission.status}</Badge>;
  };

  const handleSelectForm = (form: CustomForm) => {
    setSelectedForm(form);
    setShowFormPicker(false);
    setShowFormDialog(true);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    const form = getFormById(submission.formId);
    if (form) {
      setSelectedForm(form);
      setViewingSubmission(submission);
      setShowFormDialog(true);
    }
  };

  const getSafetyStatus = () => {
    if (safetyForms.length === 0) {
      return { status: 'none', icon: Shield, color: 'text-muted-foreground' };
    }
    if (safetySubmissions.length === 0) {
      return { status: 'required', icon: ShieldAlert, color: 'text-amber-500' };
    }
    if (hasPendingSignatures) {
      return { status: 'pending', icon: ShieldAlert, color: 'text-amber-500' };
    }
    return { status: 'complete', icon: ShieldCheck, color: 'text-green-500' };
  };

  const safetyStatus = getSafetyStatus();

  if (isLoading) {
    return (
      <Card data-testid="card-safety-forms-loading">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-safety-forms">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <safetyStatus.icon className={`h-4 w-4 ${safetyStatus.color}`} />
              Safety Forms
            </span>
            {safetyStatus.status === 'required' && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Required
              </Badge>
            )}
            {safetyStatus.status === 'complete' && (
              <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {safetyForms.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No safety forms configured</p>
              <p className="text-xs">Create SWMS/JSA forms in Settings</p>
            </div>
          ) : (
            <>
              {safetySubmissions.length === 0 && jobStatus !== 'invoiced' && (
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Safety documentation required</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Complete a SWMS or JSA before starting high-risk work
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {safetySubmissions.length > 0 && (
                <div className="space-y-2">
                  {safetySubmissions.map(submission => {
                    const form = getFormById(submission.formId);
                    return (
                      <button
                        key={submission.id}
                        onClick={() => handleViewSubmission(submission)}
                        className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                        data-testid={`safety-submission-${submission.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{form?.name || 'Safety Form'}</p>
                              <p className="text-xs text-muted-foreground">
                                {submission.submittedAt && format(new Date(submission.submittedAt), 'dd MMM yyyy, h:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(submission)}
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {jobStatus !== 'invoiced' && (
                <Button
                  onClick={() => setShowFormPicker(true)}
                  className="w-full"
                  variant={safetySubmissions.length === 0 ? "default" : "outline"}
                  data-testid="button-add-safety-form"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {safetySubmissions.length === 0 ? 'Complete Safety Form' : 'Add Another Form'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showFormPicker} onOpenChange={setShowFormPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Select Safety Form
            </DialogTitle>
            <DialogDescription>Choose a safety form to complete for this job</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
            {safetyForms.map(form => (
              <button
                key={form.id}
                onClick={() => handleSelectForm(form)}
                className="w-full p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                data-testid={`safety-form-picker-${form.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{form.name}</p>
                    {form.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{form.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {form.requiresSignature && (
                        <Badge variant="outline" className="text-xs">
                          <PenLine className="h-3 w-3 mr-1" />
                          Signature Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {safetyForms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No safety forms available</p>
                <p className="text-xs">Create SWMS/JSA templates in Settings</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) {
          setViewingSubmission(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedForm && (
            <FormRenderer
              form={selectedForm}
              jobId={jobId}
              onSubmit={() => {
                setShowFormDialog(false);
                setViewingSubmission(null);
              }}
              onCancel={() => {
                setShowFormDialog(false);
                setViewingSubmission(null);
              }}
              existingSubmission={viewingSubmission || undefined}
              readOnly={!!viewingSubmission}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SafetyCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onAddSafetyForm: () => void;
  hasSafetyForms: boolean;
}

export function SafetyCheckDialog({ 
  open, 
  onOpenChange, 
  onContinue, 
  onAddSafetyForm,
  hasSafetyForms 
}: SafetyCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-safety-check">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Safety Check Required
          </DialogTitle>
          <DialogDescription className="pt-2">
            {hasSafetyForms 
              ? "This job has no completed safety forms. For high-risk construction work, Australian WHS regulations require a Safe Work Method Statement (SWMS) before starting work."
              : "Consider completing a safety form before starting work on this job."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-300">WHS Compliance Reminder</p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">
                  SWMS documents are legally required for high-risk construction work including:
                </p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Work at heights over 2 meters</li>
                  <li>Work near electrical installations</li>
                  <li>Work in confined spaces</li>
                  <li>Work involving hazardous substances</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onAddSafetyForm} data-testid="button-add-safety-form-dialog">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Complete Safety Form First
          </Button>
          <Button variant="outline" onClick={onContinue} data-testid="button-continue-without-safety">
            Continue Without Safety Form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
